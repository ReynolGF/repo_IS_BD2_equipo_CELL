/**
 * Datos simulados de las pantallas de ejecución, sensores y reportes,
 * derivados del `demoData` de la capa `app/data`.
 *
 * Así todas las pantallas cuentan la misma historia: las mismas líneas,
 * operarios, técnicos, tareas y planes. Las conversiones son estas:
 * - Los identificadores de texto (`OP-01`, `PM-2026-018`) pasan a número
 *   tomando su sufijo numérico (`1`, `18`), que es lo que usa el contrato.
 * - Los nombres de campo pasan a snake_case y a español del contrato.
 * - La criticidad `Alta` pasa a `alta`.
 */
import { demoData } from "../data/demoData";
import type { Plan, PlanTask, Severity } from "../types/maintenance";
import type {
  EstadoPlan,
  EstadoTarea,
  Intervencion,
  OperarioResumen,
  PlanAsignado,
  SolicitudReinspeccion,
  TecnicoResumen,
} from "../types/operacion";
import type {
  Criticidad,
  LineaProduccion,
  PlanResumen,
} from "../types/reporte";

/** Texto con el valor que `demoData` usa para "sin operario". */
const SIN_ASIGNAR = "Sin asignar";

/**
 * Convierte un identificador de texto en su número final.
 *
 * @param id Identificador como `OP-01`, `LIN-02` o `PM-2026-018`.
 * @returns El número del sufijo (`1`, `2`, `18`).
 */
export function idNumerico(id: string): number {
  const coincidencia = id.match(/(\d+)$/);
  if (!coincidencia) throw new Error(`Identificador sin número: ${id}`);
  return Number(coincidencia[1]);
}

/** Convierte la criticidad del dominio (`Alta`) a la del contrato (`alta`). */
export function criticidadDe(severidad: Severity): Criticidad {
  return severidad.toLowerCase() as Criticidad;
}

/** Redondea a un decimal. */
export function redondear(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/** Líneas de producción. */
export const lineasDemo: LineaProduccion[] = demoData.lines.map((linea) => ({
  id: idNumerico(linea.id),
  nombre: linea.name,
}));

/** Operarios con su turno y sus líneas. */
export const operariosDemo: OperarioResumen[] = demoData.operators.map((operario) => ({
  id: idNumerico(operario.id),
  nombre: operario.name,
  turno: operario.shift.toLowerCase(),
  lineas: [...operario.lines],
}));

/** Técnicos con su especialidad y sus líneas. */
export const tecnicosDemo: TecnicoResumen[] = demoData.technicians.map((tecnico) => ({
  id: idNumerico(tecnico.id),
  nombre: tecnico.name,
  especialidad: tecnico.specialty,
  lineas: [...tecnico.lines],
}));

/** Busca un operario por nombre (los planes guardan el nombre, no el id). */
export function operarioPorNombre(nombre: string) {
  return demoData.operators.find((operario) => operario.name === nombre);
}

/** Planes que ya fueron aprobados y, por tanto, se pueden ejecutar. */
const ESTADO_EJECUCION: Partial<Record<Plan["status"], EstadoPlan>> = {
  Aprobado: "aprobado",
  "En ejecución": "en_ejecucion",
  Finalizado: "finalizado",
};

/** ¿La intervención del `demoData` terminó sin cumplir la tarea? */
function esIncumplida(resultado: string): boolean {
  return resultado.startsWith("Reinspección");
}

/** Intervenciones del `demoData` con el plan y la tarea ya resueltos. */
const intervencionesResueltas = demoData.interventions.flatMap((item) => {
  const plan = demoData.plans.find((candidato) => candidato.id === item.planId);
  const tarea = plan?.tasks.find((candidato) => candidato.name === item.task);
  const operario = operarioPorNombre(item.operator);
  if (!plan || !tarea || !operario) return [];
  return [{ item, plan, tarea, operario }];
});

/** Estado de una tarea: cumplida, incumplida (por su intervención) o pendiente. */
function estadoDeTarea(plan: Plan, tarea: PlanTask): EstadoTarea {
  if (tarea.completed) return "cumplida";
  const incumplida = intervencionesResueltas.some(
    (r) => r.plan.id === plan.id && r.tarea.id === tarea.id && esIncumplida(r.item.result),
  );
  return incumplida ? "incumplida" : "pendiente";
}

/** Planes aprobados (o más avanzados) con el estado de cada tarea. */
export const planesAsignadosDemo: PlanAsignado[] = demoData.plans.flatMap((plan) => {
  const estado = ESTADO_EJECUCION[plan.status];
  if (!estado) return [];
  return [
    {
      plan_id: idNumerico(plan.id),
      plan: plan.name,
      linea: plan.line,
      estado,
      tareas: plan.tasks.map((tarea) => ({
        tarea_id: idNumerico(tarea.id),
        tarea: tarea.name,
        sistema: tarea.system,
        criticidad: criticidadDe(tarea.severity),
        estado: estadoDeTarea(plan, tarea),
        operario_id: operarioPorNombre(tarea.operator)
          ? idNumerico(operarioPorNombre(tarea.operator)!.id)
          : 0,
        operario: tarea.operator,
      })),
    },
  ];
});

/** Historial inicial de intervenciones. */
export const intervencionesDemo: Intervencion[] = intervencionesResueltas.map(
  ({ item, plan, tarea, operario }) => ({
    id: idNumerico(item.id),
    plan_id: idNumerico(plan.id),
    linea: plan.line,
    tarea_id: idNumerico(tarea.id),
    tarea: tarea.name,
    operario_id: idNumerico(operario.id),
    operario: operario.name,
    fecha: `${item.date.replace(" ", "T")}:00`,
    resultado: esIncumplida(item.result) ? "incumplida" : "cumplida",
    observaciones: item.notes,
  }),
);

/** Técnico que creó cada plan: es quien atiende sus reinspecciones. */
export function tecnicoDelPlan(planId: number): string {
  const plan = demoData.plans.find((candidato) => idNumerico(candidato.id) === planId);
  return plan?.creator ?? tecnicosDemo[0].nombre;
}

/** Solicitudes de reinspección iniciales (las intervenciones que la pidieron). */
export const solicitudesDemo: SolicitudReinspeccion[] = intervencionesResueltas
  .filter(({ item }) => item.reinspection)
  .map(({ item, plan, tarea, operario }) => ({
    id: idNumerico(item.id),
    intervencion_id: idNumerico(item.id),
    plan_id: idNumerico(plan.id),
    linea: plan.line,
    tarea: tarea.name,
    operario: operario.name,
    fecha_solicitud: `${item.date.replace(" ", "T")}:00`,
    motivo: item.notes,
    tecnico_asignado: plan.creator,
    tecnico_apoyo: null,
    estado: "pendiente",
    reinspeccion: null,
  }));

/** Planes con operarios asignados, los únicos que tienen datos de cumplimiento. */
export const planesConOperario: Plan[] = demoData.plans.filter((plan) =>
  plan.tasks.some((tarea) => tarea.operator !== SIN_ASIGNAR),
);

/** Todos los planes, para los selectores de los reportes. */
export const planesResumenDemo: PlanResumen[] = demoData.plans.map((plan) => ({
  id: idNumerico(plan.id),
  nombre: plan.name,
  linea: plan.line,
}));
