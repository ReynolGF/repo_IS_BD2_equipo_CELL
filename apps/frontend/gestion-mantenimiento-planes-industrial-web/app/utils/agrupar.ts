/**
 * Funciones puras que transforman los datos de la API en la forma que
 * necesitan los gráficos y los resúmenes. No dependen de React.
 */
import type {
  Criticidad,
  CorrelacionLinea,
  FilaDesempeno,
  TareaEjecutada,
} from "../types/reporte";
import { ORDEN_CRITICIDAD } from "./criticidad";

/** Fila de un gráfico agrupado: una etiqueta y un valor por cada criticidad. */
export type DatoPorCriticidad = { etiqueta: string } & Record<Criticidad, number>;

/** Crea un dato con la etiqueta dada y todas las criticidades en cero. */
function datoVacio(etiqueta: string): DatoPorCriticidad {
  return { etiqueta, baja: 0, media: 0, alta: 0 };
}

/**
 * Suma las ejecuciones por sistema y criticidad (funcionalidad 2).
 * Cada sistema es un grupo del gráfico y cada criticidad una barra.
 */
export function ejecucionesPorSistema(
  tareas: readonly TareaEjecutada[],
): DatoPorCriticidad[] {
  const grupos = new Map<string, DatoPorCriticidad>();
  for (const tarea of tareas) {
    const dato = grupos.get(tarea.sistema) ?? datoVacio(tarea.sistema);
    dato[tarea.criticidad] += tarea.ejecuciones;
    grupos.set(tarea.sistema, dato);
  }
  return [...grupos.values()];
}

/**
 * Organiza las tasas de cumplimiento por operario y criticidad
 * (funcionalidad 4). Cada operario es un grupo y cada criticidad una barra.
 */
export function tasasPorOperario(
  filas: readonly FilaDesempeno[],
): DatoPorCriticidad[] {
  const grupos = new Map<string, DatoPorCriticidad>();
  for (const fila of filas) {
    const dato = grupos.get(fila.operario) ?? datoVacio(fila.operario);
    dato[fila.criticidad] = fila.tasa_cumplimiento;
    grupos.set(fila.operario, dato);
  }
  return [...grupos.values()];
}

/** Resumen de cumplimiento de todos los operarios en una criticidad. */
export interface ResumenCriticidad {
  /** Criticidad resumida. */
  criticidad: Criticidad;
  /** Total de tareas asignadas. */
  asignadas: number;
  /** Total de tareas cumplidas. */
  cumplidas: number;
  /** Tasa global de cumplimiento (0 si no hay tareas asignadas). */
  tasa: number;
}

/**
 * Calcula la tasa global de cumplimiento de cada criticidad (funcionalidad 4).
 * La tasa es el total de cumplidas entre el total de asignadas, no el promedio
 * de las tasas individuales, para que cada tarea pese lo mismo.
 */
export function resumenPorCriticidad(
  filas: readonly FilaDesempeno[],
): ResumenCriticidad[] {
  return ORDEN_CRITICIDAD.map((criticidad) => {
    const delNivel = filas.filter((f) => f.criticidad === criticidad);
    const asignadas = delNivel.reduce((s, f) => s + f.tareas_asignadas, 0);
    const cumplidas = delNivel.reduce((s, f) => s + f.tareas_cumplidas, 0);
    const tasa =
      asignadas === 0 ? 0 : Math.round((cumplidas / asignadas) * 1000) / 10;
    return { criticidad, asignadas, cumplidas, tasa };
  });
}

/**
 * Organiza el rendimiento promedio por línea y criticidad (funcionalidad 6).
 * Cada línea es un grupo y cada criticidad una barra.
 */
export function rendimientoPorLinea(
  correlaciones: readonly CorrelacionLinea[],
): DatoPorCriticidad[] {
  return correlaciones.map((correlacion) => {
    const dato = datoVacio(correlacion.linea);
    for (const r of correlacion.rendimiento) {
      dato[r.criticidad] = r.rendimiento_promedio;
    }
    return dato;
  });
}
