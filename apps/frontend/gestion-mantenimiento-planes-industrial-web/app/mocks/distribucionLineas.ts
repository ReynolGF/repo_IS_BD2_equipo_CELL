/**
 * Datos simulados (mock) de la comparación de distribución de tareas entre líneas.
 *
 * La distribución sale del banco de tareas de `app/data/demoData.ts` (tareas
 * por línea, sistema y criticidad). El equilibrio de cada línea es el
 * promedio del `balance` de sus planes, y cumple el criterio si llega al
 * mínimo exigido.
 */
import { demoData } from "../data/demoData";
import type { FilaDistribucion, ReporteDistribucionLineas } from "../types/operacion";
import { criticidadDe, lineasDemo } from "./desdeDemo";

/** Porcentaje mínimo de equilibrio que exige el criterio. */
export const MINIMO_EQUILIBRIO = 80;

/** Cantidad de tareas por línea, sistema y criticidad. */
const filas: FilaDistribucion[] = lineasDemo.flatMap((linea) => {
  const cuentas = new Map<string, FilaDistribucion>();
  for (const tarea of demoData.tasks.filter((t) => t.line === linea.nombre)) {
    const criticidad = criticidadDe(tarea.severity);
    const clave = `${tarea.system}|${criticidad}`;
    const fila = cuentas.get(clave) ?? {
      linea_id: linea.id,
      linea: linea.nombre,
      sistema: tarea.system,
      criticidad,
      tareas: 0,
    };
    fila.tareas += 1;
    cuentas.set(clave, fila);
  }
  return [...cuentas.values()];
});

/** Reporte simulado con la distribución y el resultado del criterio. */
export const distribucionLineasMock: ReporteDistribucionLineas = {
  filas,
  equilibrio: lineasDemo.map((linea) => {
    const planes = demoData.plans.filter((plan) => plan.line === linea.nombre);
    const promedio = planes.length
      ? Math.round(planes.reduce((suma, plan) => suma + plan.params.balance, 0) / planes.length)
      : 0;
    return {
      linea_id: linea.id,
      linea: linea.nombre,
      porcentaje_equilibrio: promedio,
      minimo_requerido: MINIMO_EQUILIBRIO,
      cumple_criterio: promedio >= MINIMO_EQUILIBRIO,
    };
  }),
};
