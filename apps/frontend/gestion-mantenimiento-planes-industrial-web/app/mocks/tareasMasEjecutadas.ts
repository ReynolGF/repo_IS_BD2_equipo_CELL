/**
 * Datos simulados (mock) de la funcionalidad 2: tareas más ejecutadas.
 *
 * Se derivan del banco de tareas de `app/data/demoData.ts`: para cada línea,
 * sus tareas con al menos una ejecución, de mayor a menor número de
 * ejecuciones y, en empate, por nombre. Respetan el contrato de
 * `app/types/reporte.ts`.
 */
import { demoData } from "../data/demoData";
import type { ReporteTareasMasEjecutadas, TareaEjecutada } from "../types/reporte";
import { criticidadDe, idNumerico, lineasDemo } from "./desdeDemo";

/** Reportes simulados indexados por el identificador de la línea. */
export const reportesMock: Record<number, ReporteTareasMasEjecutadas> = Object.fromEntries(
  lineasDemo.map((linea) => {
    const tareas: TareaEjecutada[] = demoData.tasks
      .filter((tarea) => tarea.line === linea.nombre && tarea.timesExecuted > 0)
      .map((tarea) => ({
        tarea_id: idNumerico(tarea.id),
        tarea: tarea.name,
        sistema: tarea.system,
        criticidad: criticidadDe(tarea.severity),
        ejecuciones: tarea.timesExecuted,
      }))
      .sort((a, b) => b.ejecuciones - a.ejecuciones || a.tarea.localeCompare(b.tarea, "es"));
    return [linea.id, { linea, tareas }];
  }),
);
