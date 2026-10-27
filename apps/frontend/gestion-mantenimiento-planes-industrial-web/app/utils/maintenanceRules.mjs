/**
 * Reglas de negocio puras del front de mantenimiento.
 *
 * Se mantienen en JavaScript para poder ejecutarlas con `node --test` sin
 * transpilación. TypeScript consume las firmas declaradas en
 * `maintenanceRules.d.mts`.
 */

export const SEVERITIES = ["Alta", "Media", "Baja"];
export const MAINTENANCE_TYPES = ["Preventivo", "Correctivo", "Predictivo"];
const ACTIVE_PLAN_STATUSES = ["Aprobado", "En ejecución"];

/** Normaliza texto para comparar sin mayúsculas, tildes ni espacios extra. */
export function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/** Distancia de Levenshtein usada para avisos de tareas parecidas. */
function levenshtein(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Regla compartida: una tarea se identifica por nombre, sistema y línea.
 * `excludeId` permite editar una tarea sin compararla consigo misma.
 */
export function isDuplicateTask(candidate, tasks, excludeId = "") {
  const name = normalize(candidate.name);
  const system = normalize(candidate.system);
  const line = normalize(candidate.line);
  return tasks.some(
    (task) =>
      task.id !== excludeId &&
      normalize(task.name) === name &&
      normalize(task.system) === system &&
      normalize(task.line) === line,
  );
}

/**
 * Devuelve tareas parecidas que deben mostrarse como aviso antes de guardar.
 * No reemplaza a `isDuplicateTask`: solo ayuda al administrador a decidir.
 */
export function findSimilarTasks(candidate, tasks, excludeId = "") {
  const name = normalize(candidate.name);
  const system = normalize(candidate.system);
  const line = normalize(candidate.line);
  return tasks.filter((task) => {
    if (task.id === excludeId) return false;
    const sameLine = normalize(task.line) === line;
    const sameSystem = normalize(task.system) === system;
    const sameName = normalize(task.name) === name;
    const similarName =
      name.length > 3 &&
      (normalize(task.name).includes(name) ||
        name.includes(normalize(task.name)) ||
        levenshtein(task.name, candidate.name) <= 2);
    return (sameLine && sameSystem && sameName) || (sameLine && similarName) || (sameName && sameSystem);
  });
}

/** Valida los campos obligatorios del formulario de tareas. */
export function validateTaskDraft(draft) {
  const errors = [];
  if (!normalize(draft.name)) errors.push("El nombre de la tarea es obligatorio.");
  if (!normalize(draft.system)) errors.push("El sistema o equipo es obligatorio.");
  if (!normalize(draft.line)) errors.push("La línea de producción es obligatoria.");
  if (!MAINTENANCE_TYPES.includes(draft.type)) errors.push("Selecciona un tipo de mantenimiento válido.");
  if (!SEVERITIES.includes(draft.severity)) errors.push("Selecciona una criticidad válida.");
  if (!Number.isFinite(Number(draft.duration)) || Number(draft.duration) <= 0)
    errors.push("La duración debe ser mayor que cero.");
  if (!normalize(draft.author)) errors.push("El técnico creador es obligatorio.");
  return errors;
}

/**
 * Valida los parámetros de generación automática antes de crear un plan.
 * `availableCount` es la cantidad de tareas elegibles para la línea y sistemas.
 */
export function validateGenerationParams(params, availableCount) {
  const errors = [];
  const total = Number(params.total);
  const preventive = Number(params.preventive);
  const corrective = Number(params.corrective);
  const predictive = Number(params.predictive);
  if (!Number.isInteger(total) || total < 1) errors.push("La cantidad total de tareas debe ser un entero mayor que cero.");
  if (Number.isFinite(availableCount) && total > availableCount)
    errors.push(`Solo hay ${availableCount} tareas elegibles para esa selección.`);
  if ([preventive, corrective, predictive].some((value) => !Number.isFinite(value) || value < 0 || value > 100))
    errors.push("Los porcentajes deben estar entre 0 y 100.");
  if (preventive + corrective + predictive !== 100)
    errors.push("La proporción preventivo + correctivo + predictivo debe sumar 100%.");
  if (!Array.isArray(params.systems) || params.systems.length === 0)
    errors.push("Selecciona al menos un sistema o equipo a cubrir.");
  const balance = Number(params.balance);
  if (!Number.isFinite(balance) || balance < 1 || balance > 100)
    errors.push("El nivel de equilibrio debe estar entre 1 y 100.");
  return errors;
}

/**
 * Sugiere tareas para cumplir la mezcla configurada, priorizando criticidad
 * alta y baja cantidad de ejecuciones.
 */
export function suggestTaskSelection(tasks, params) {
  const total = Math.max(0, Number(params.total) || 0);
  const weight = { Alta: 3, Media: 2, Baja: 1 };
  const ordered = [...tasks].sort(
    (a, b) =>
      (weight[b.severity] ?? 0) - (weight[a.severity] ?? 0) ||
      (a.timesExecuted ?? 0) - (b.timesExecuted ?? 0) ||
      String(a.name).localeCompare(String(b.name), "es"),
  );
  const quotas = {
    Preventivo: Math.round((total * Number(params.preventive || 0)) / 100),
    Correctivo: Math.round((total * Number(params.corrective || 0)) / 100),
    Predictivo: Math.round((total * Number(params.predictive || 0)) / 100),
  };
  const selected = [];
  for (const type of MAINTENANCE_TYPES) {
    ordered
      .filter((task) => task.type === type)
      .slice(0, quotas[type])
      .forEach((task) => selected.push(task.id));
  }
  for (const task of ordered) {
    if (selected.length >= total) break;
    if (!selected.includes(task.id)) selected.push(task.id);
  }
  return selected.slice(0, total);
}

/** Calcula la distribución real y el equilibrio respecto de la configuración. */
export function buildPlanParams(tasks, target) {
  const total = tasks.length;
  const count = (type) => tasks.filter((task) => task.type === type).length;
  const percentage = (value) => (total ? Math.round((value / total) * 100) : 0);
  return {
    total,
    preventive: percentage(count("Preventivo")),
    corrective: percentage(count("Correctivo")),
    predictive: percentage(count("Predictivo")),
    systems: [...new Set(tasks.map((task) => task.system))],
    balance: balanceScore(tasks, target),
    target: {
      total: Number(target.total),
      preventive: Number(target.preventive),
      corrective: Number(target.corrective),
      predictive: Number(target.predictive),
    },
  };
}

/**
 * Equilibrio = 100 menos la desviación media absoluta entre la mezcla real y
 * la mezcla objetivo. Se limita al rango 0..100.
 */
export function balanceScore(tasks, target) {
  const total = tasks.length;
  if (!total) return 0;
  const actual = {
    preventive: (tasks.filter((task) => task.type === "Preventivo").length / total) * 100,
    corrective: (tasks.filter((task) => task.type === "Correctivo").length / total) * 100,
    predictive: (tasks.filter((task) => task.type === "Predictivo").length / total) * 100,
  };
  const deviation =
    (Math.abs(actual.preventive - Number(target.preventive || 0)) +
      Math.abs(actual.corrective - Number(target.corrective || 0)) +
      Math.abs(actual.predictive - Number(target.predictive || 0))) /
    2;
  return Math.max(0, Math.min(100, Math.round(100 - deviation)));
}

/**
 * Un operario no puede tener dos planes activos (aprobados o en ejecución).
 * Devuelve el plan en conflicto o `null`.
 */
export function findOperatorConflict(operatorName, planId, plans) {
  const name = normalize(operatorName);
  return (
    plans.find(
      (plan) =>
        plan.id !== planId &&
        ACTIVE_PLAN_STATUSES.includes(plan.status) &&
        plan.tasks.some((task) => normalize(task.operator) === name),
    ) ?? null
  );
}

/**
 * Recorta los planes visibles según el rol:
 * - Administrador/Jefe: todos.
 * - Técnico: solo líneas autorizadas.
 * - Operario: solo planes donde aparece asignado.
 */
export function visiblePlansFor(user, plans) {
  if (!user) return [];
  if (user.role === "Administrador" || user.role === "Jefe de planta") return plans;
  if (user.role === "Técnico") {
    const lines = (user.lines ?? []).map(normalize);
    return plans.filter((plan) => lines.includes(normalize(plan.line)));
  }
  if (user.role === "Operario") {
    return plans.filter((plan) => plan.tasks.some((task) => normalize(task.operator) === normalize(user.name)));
  }
  return [];
}

/** Ordena filas por una clave simple o anidada (`params.total`). */
export function sortRows(rows, key, asc = true) {
  if (!key) return rows;
  const value = (row, path) =>
    path.split(".").reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), row);
  return [...rows].sort((a, b) => {
    const left = value(a, key);
    const right = value(b, key);
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    const comparison =
      Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && left !== "" && right !== ""
        ? leftNumber - rightNumber
        : String(left ?? "").localeCompare(String(right ?? ""), "es", { numeric: true });
    return comparison * (asc ? 1 : -1);
  });
}

/** Filtra tareas por búsqueda, línea, tipo y criticidad. */
export function filterTasks(tasks, { query = "", line = "Todas las líneas", type = "Todos", severity = "Todas" } = {}) {
  const search = normalize(query);
  return tasks.filter((task) => {
    const matchesQuery = !search || normalize(`${task.name} ${task.system} ${task.line} ${task.author} ${task.id}`).includes(search);
    const matchesLine = line === "Todas las líneas" || task.line === line;
    const matchesType = type === "Todos" || task.type === type;
    const matchesSeverity = severity === "Todas" || task.severity === severity;
    return matchesQuery && matchesLine && matchesType && matchesSeverity;
  });
}

/** Reporte 01: planes automáticos por línea con creador, fecha y parámetros. */
export function buildAutomaticPlansReport(plans, line = "Todas las líneas") {
  return plans
    .filter((plan) => line === "Todas las líneas" || plan.line === line)
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      line: plan.line,
      creator: plan.creator,
      createdAt: plan.createdAt,
      total: plan.params.total,
      mix: `${plan.params.preventive}% prev. · ${plan.params.corrective}% corr. · ${plan.params.predictive}% pred.`,
      systems: plan.params.systems.join(", "),
      balance: plan.params.balance,
    }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** Reporte 03: planes validados por revisor, con fecha y observaciones. */
export function buildReviewerReport(plans, reviewer = "Todos los revisores") {
  return plans
    .filter((plan) => plan.reviewer && (reviewer === "Todos los revisores" || plan.reviewer === reviewer))
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      line: plan.line,
      reviewer: plan.reviewer,
      validatedAt: plan.validatedAt ?? "—",
      observations: plan.observations ?? "Sin observaciones.",
      status: plan.status,
    }))
    .sort((a, b) => String(b.validatedAt).localeCompare(String(a.validatedAt)));
}

/** Lista de revisores disponibles para el filtro del reporte. */
export function listReviewers(plans) {
  return [...new Set(plans.map((plan) => plan.reviewer).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

/** Indicadores de ejecución usados en el resumen y en reportes. */
export function executionStats(plans) {
  const tasks = plans.flatMap((plan) => plan.tasks);
  const completed = tasks.filter((task) => task.completed).length;
  return {
    total: tasks.length,
    completed,
    rate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
  };
}
