/**
 * Datos simulados (mock) de la funcionalidad 4: desempeño de operarios.
 *
 * Se derivan de los planes de `app/data/demoData.ts`. Cada plan con un
 * operario asignado produce una fila por criticidad (tareas asignadas y
 * cumplidas); los planes que todavía no tienen operario (borrador, en
 * revisión o rechazado) devuelven una lista vacía.
 */
import type {
  Criticidad,
  FilaDesempeno,
  PlanResumen,
  ReporteDesempenoOperarios,
} from "../types/reporte";
import { ORDEN_CRITICIDAD } from "../utils/criticidad";
import { criticidadDe, idNumerico, operarioPorNombre, planesResumenDemo, redondear } from "./desdeDemo";
import { demoData } from "../data/demoData";

/** Planes disponibles en el selector del reporte. */
export const planesMock: PlanResumen[] = planesResumenDemo;

/**
 * Calcula las filas de desempeño de un plan: una por operario y criticidad,
 * de menor a mayor criticidad.
 *
 * @param planId Identificador numérico del plan.
 */
function filasDelPlan(planId: number): FilaDesempeno[] {
  const plan = demoData.plans.find((candidato) => idNumerico(candidato.id) === planId);
  if (!plan) return [];
  const filas: FilaDesempeno[] = [];
  const operarios = [...new Set(plan.tasks.map((tarea) => tarea.operator))];
  for (const nombre of operarios) {
    const operario = operarioPorNombre(nombre);
    if (!operario) continue; // "Sin asignar"
    for (const criticidad of ORDEN_CRITICIDAD) {
      const tareas = plan.tasks.filter(
        (tarea) => tarea.operator === nombre && criticidadDe(tarea.severity) === (criticidad as Criticidad),
      );
      if (tareas.length === 0) continue;
      const cumplidas = tareas.filter((tarea) => tarea.completed).length;
      filas.push({
        operario_id: idNumerico(operario.id),
        operario: operario.name,
        turno: operario.shift.toLowerCase(),
        criticidad,
        tareas_asignadas: tareas.length,
        tareas_cumplidas: cumplidas,
        tasa_cumplimiento: redondear((cumplidas / tareas.length) * 100),
      });
    }
  }
  return filas;
}

/** Reportes simulados indexados por el identificador del plan. */
export const desempenoMock: Record<number, ReporteDesempenoOperarios> = Object.fromEntries(
  planesMock.map((plan) => [plan.id, { plan, filas: filasDelPlan(plan.id) }]),
);
