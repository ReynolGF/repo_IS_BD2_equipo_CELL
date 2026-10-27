import test from "node:test";
import assert from "node:assert/strict";
import {
  balanceScore,
  buildAutomaticPlansReport,
  buildPlanParams,
  buildReviewerReport,
  executionStats,
  filterTasks,
  findOperatorConflict,
  findSimilarTasks,
  isDuplicateTask,
  listReviewers,
  normalize,
  sortRows,
  suggestTaskSelection,
  validateGenerationParams,
  validateTaskDraft,
  visiblePlansFor,
} from "./maintenanceRules.mjs";

const task = (overrides = {}) => ({
  id: "T-1",
  name: "Inspeccionar bomba",
  system: "Bombas",
  line: "Envasado A",
  type: "Preventivo",
  severity: "Alta",
  author: "Laura Méndez",
  duration: 45,
  timesExecuted: 10,
  ...overrides,
});

const tasks = [
  task(),
  task({ id: "T-2", name: "Lubricar rodamiento", system: "Bandas", type: "Preventivo", severity: "Media", timesExecuted: 30 }),
  task({ id: "T-3", name: "Ajustar válvula", system: "Válvulas", line: "Llenado 02", type: "Correctivo", severity: "Alta", timesExecuted: 5 }),
  task({ id: "T-4", name: "Medir vibración", system: "Motores", line: "Llenado 02", type: "Predictivo", severity: "Baja", timesExecuted: 2 }),
  task({ id: "T-5", name: "Calibrar sensor", system: "Motores", line: "Envasado A", type: "Predictivo", severity: "Baja", timesExecuted: 1 }),
];

const plan = (overrides = {}) => ({
  id: "PM-1",
  name: "Plan de prueba",
  line: "Envasado A",
  process: "Envasado",
  creator: "Laura Méndez",
  reviewer: "Roberto Salas",
  createdAt: "2026-10-20",
  validatedAt: "2026-10-21",
  observations: "Aprobado",
  status: "Aprobado",
  params: {
    total: 2,
    preventive: 50,
    corrective: 50,
    predictive: 0,
    systems: ["Bombas", "Bandas"],
    balance: 100,
    target: { total: 2, preventive: 50, corrective: 50, predictive: 0 },
  },
  tasks: [
    { ...tasks[0], operator: "Ana Gómez", completed: true },
    { ...tasks[1], operator: "Ana Gómez", completed: false },
  ],
  ...overrides,
});

/* ----------------------------- Duplicados ----------------------------- */

test("normaliza mayúsculas, tildes y espacios externos", () => {
  assert.equal(normalize("  Inspección   de BOMBA "), "inspeccion de bomba");
  assert.equal(normalize(null), "");
});

test("detecta duplicados por nombre, sistema y línea", () => {
  assert.equal(
    isDuplicateTask(
      { name: " inspeccionar BOMBA ", system: " Bombas ", line: "Envasado A" },
      [task()],
    ),
    true,
  );
});

test("no considera duplicado si cambia el sistema o la línea", () => {
  assert.equal(isDuplicateTask({ name: "Inspeccionar bomba", system: "Válvulas", line: "Envasado A" }, [task()]), false);
  assert.equal(isDuplicateTask({ name: "Inspeccionar bomba", system: "Bombas", line: "Servicios" }, [task()]), false);
});

test("permite editar una tarea sin compararla consigo misma", () => {
  assert.equal(
    isDuplicateTask(
      { name: "Inspeccionar bomba", system: "Bombas", line: "Envasado A" },
      [task()],
      "T-1",
    ),
    false,
  );
});

test("encuentra tareas parecidas para avisar antes de guardar", () => {
  const similar = findSimilarTasks(
    { name: "Inspeccionar bomba centrifuga", system: "Bombas", line: "Envasado A" },
    tasks,
  );
  assert.equal(similar.length, 1);
  assert.equal(similar[0].id, "T-1");
  assert.deepEqual(findSimilarTasks({ name: "Inspeccionar bomba", system: "Bombas", line: "Envasado A" }, tasks, "T-1"), []);
});

test("valida los campos obligatorios y la clasificación de una tarea", () => {
  assert.deepEqual(validateTaskDraft(task()), []);
  const errors = validateTaskDraft({
    name: " ",
    system: "",
    line: "",
    type: "Otro",
    severity: "Crítica",
    duration: 0,
    author: "",
  });
  assert.equal(errors.length, 7);
  assert.ok(errors.some((message) => message.includes("nombre")));
  assert.ok(errors.some((message) => message.includes("duración")));
});

/* --------------------------- Generación de planes --------------------------- */

test("valida la cantidad total, la mezcla, la cobertura y el equilibrio", () => {
  const valid = {
    total: 4,
    preventive: 50,
    corrective: 25,
    predictive: 25,
    systems: ["Bombas"],
    balance: 90,
  };
  assert.deepEqual(validateGenerationParams(valid, 10), []);

  const invalid = validateGenerationParams(
    { total: 0, preventive: 50, corrective: 30, predictive: 30, systems: [], balance: 0 },
    10,
  );
  assert.ok(invalid.some((message) => message.includes("entero")));
  assert.ok(invalid.some((message) => message.includes("sumar 100")));
  assert.ok(invalid.some((message) => message.includes("sistema")));
  assert.ok(invalid.some((message) => message.includes("equilibrio")));
});

test("avisa cuando se piden más tareas que las elegibles", () => {
  const errors = validateGenerationParams(
    { total: 5, preventive: 100, corrective: 0, predictive: 0, systems: ["Bombas"], balance: 80 },
    3,
  );
  assert.ok(errors.some((message) => message.includes("Solo hay 3")));
});

test("sugiere tareas respetando la cantidad y priorizando criticidad alta", () => {
  const selected = suggestTaskSelection(tasks, {
    total: 3,
    preventive: 50,
    corrective: 25,
    predictive: 25,
    systems: [],
    balance: 80,
  });
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected).size, 3);
  assert.ok(selected.includes("T-1"));
  assert.ok(selected.includes("T-3"));
});

test("calcula la distribución real y conserva la configuración objetivo", () => {
  const params = buildPlanParams(tasks.slice(0, 3), {
    total: 3,
    preventive: 50,
    corrective: 35,
    predictive: 15,
  });
  assert.equal(params.total, 3);
  assert.equal(params.preventive, 67);
  assert.equal(params.corrective, 33);
  assert.equal(params.predictive, 0);
  assert.deepEqual(params.systems, ["Bombas", "Bandas", "Válvulas"]);
  assert.deepEqual(params.target, { total: 3, preventive: 50, corrective: 35, predictive: 15 });
});

test("el equilibrio es 100 con mezcla exacta y baja al desviarse", () => {
  const target = { total: 3, preventive: 67, corrective: 33, predictive: 0 };
  assert.equal(balanceScore(tasks.slice(0, 3), target), 100);
  const deviated = balanceScore(tasks.slice(0, 3), { total: 3, preventive: 0, corrective: 0, predictive: 100 });
  assert.ok(deviated < 100);
  assert.ok(deviated >= 0);
});

/* -------------------------- Una asignación por operario -------------------------- */

test("detecta conflicto de operario solo en planes activos y de otro plan", () => {
  const approved = plan();
  assert.equal(findOperatorConflict("Ana Gómez", "PM-2", [approved])?.id, "PM-1");
  assert.equal(findOperatorConflict("Ana Gómez", "PM-1", [approved]), null);
  assert.equal(findOperatorConflict("Ana Gómez", "PM-2", [{ ...approved, status: "Finalizado" }]), null);
  assert.equal(findOperatorConflict("Sin asignar", "PM-2", [approved]), null);
});

/* ------------------------------ Alcance por rol ------------------------------ */

test("administrador y jefe ven todos los planes", () => {
  const plans = [plan(), plan({ id: "PM-2", line: "Servicios" })];
  assert.equal(visiblePlansFor({ role: "Administrador", lines: [], name: "Elena" }, plans).length, 2);
  assert.equal(visiblePlansFor({ role: "Jefe de planta", lines: [], name: "Roberto" }, plans).length, 2);
});

test("técnico solo consulta planes de sus líneas autorizadas", () => {
  const plans = [
    plan(),
    plan({ id: "PM-2", line: "Llenado 02" }),
    plan({ id: "PM-3", line: "Servicios" }),
  ];
  const visible = visiblePlansFor(
    { role: "Técnico", lines: ["Envasado A", "Llenado 02"], name: "Laura" },
    plans,
  );
  assert.deepEqual(visible.map((item) => item.id), ["PM-1", "PM-2"]);
});

test("operario solo ve planes donde está asignado", () => {
  const plans = [
    plan(),
    plan({
      id: "PM-2",
      tasks: [{ ...tasks[0], operator: "Luis Torres", completed: false }],
    }),
  ];
  const visible = visiblePlansFor({ role: "Operario", lines: [], name: "Ana Gómez" }, plans);
  assert.deepEqual(visible.map((item) => item.id), ["PM-1"]);
});

/* ------------------------------ Orden y filtros ------------------------------ */

test("ordena filas de forma ascendente, descendente y por claves anidadas", () => {
  const rows = [
    { id: "B", params: { total: 10 } },
    { id: "A", params: { total: 2 } },
    { id: "C", params: { total: 7 } },
  ];
  assert.deepEqual(sortRows(rows, "id").map((row) => row.id), ["A", "B", "C"]);
  assert.deepEqual(sortRows(rows, "id", false).map((row) => row.id), ["C", "B", "A"]);
  assert.deepEqual(sortRows(rows, "params.total").map((row) => row.id), ["A", "C", "B"]);
  assert.equal(sortRows(rows, ""), rows);
});

test("filtra tareas por búsqueda, línea, tipo y criticidad", () => {
  assert.equal(filterTasks(tasks, { query: "válvula", line: "Llenado 02" }).length, 1);
  assert.equal(filterTasks(tasks, { type: "Predictivo" }).length, 2);
  assert.equal(filterTasks(tasks, { severity: "Alta" }).length, 2);
  assert.equal(filterTasks(tasks, { line: "Envasado A", type: "Preventivo" }).length, 2);
});

/* -------------------------------- Reportes -------------------------------- */

test("reporte de planes automáticos filtra por línea e incluye creador, fecha y parámetros", () => {
  const plans = [
    plan(),
    plan({ id: "PM-2", line: "Servicios", creator: "Marco Ruiz", createdAt: "2026-10-22" }),
  ];
  const all = buildAutomaticPlansReport(plans);
  assert.equal(all.length, 2);
  assert.deepEqual(Object.keys(all[0]).sort(), [
    "balance",
    "createdAt",
    "creator",
    "id",
    "line",
    "mix",
    "name",
    "systems",
    "total",
  ]);
  assert.equal(buildAutomaticPlansReport(plans, "Servicios").length, 1);
  assert.equal(buildAutomaticPlansReport(plans, "Servicios")[0].creator, "Marco Ruiz");
});

test("reporte de validaciones filtra por revisor y presenta fecha y observaciones", () => {
  const plans = [
    plan(),
    plan({
      id: "PM-2",
      reviewer: "Elena Vargas",
      validatedAt: "2026-10-25",
      observations: "Con ajustes",
    }),
    plan({ id: "PM-3", reviewer: undefined, validatedAt: undefined }),
  ];
  assert.equal(buildReviewerReport(plans).length, 2);
  const filtered = buildReviewerReport(plans, "Elena Vargas");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].validatedAt, "2026-10-25");
  assert.equal(filtered[0].observations, "Con ajustes");
  assert.deepEqual(listReviewers(plans), ["Elena Vargas", "Roberto Salas"]);
});

test("calcula indicadores de ejecución", () => {
  const stats = executionStats([plan(), plan({ id: "PM-2", tasks: [] })]);
  assert.deepEqual(stats, { total: 2, completed: 1, rate: 50 });
  assert.deepEqual(executionStats([]), { total: 0, completed: 0, rate: 0 });
});
