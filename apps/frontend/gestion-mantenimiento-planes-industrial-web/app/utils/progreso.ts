/**
 * Cálculos puros sobre el avance de un plan y la distribución entre líneas.
 *
 * Son funciones sin efectos secundarios: reciben datos y devuelven datos, por
 * eso se prueban fácilmente y se reutilizan en las pantallas y en el PDF.
 */
import type {
  EstadoPlan,
  EstadoTarea,
  FilaDistribucion,
  PlanAsignado,
  ProgresoPlan,
  TareaAsignada,
} from "../types/operacion";
import { NOMBRE_CRITICIDAD, ORDEN_CRITICIDAD } from "./criticidad";

/** Texto legible de cada estado de plan. */
export const NOMBRE_ESTADO_PLAN: Record<EstadoPlan, string> = {
  aprobado: "Aprobado",
  en_ejecucion: "En ejecución",
  finalizado: "Finalizado",
};

/** Texto legible de cada estado de tarea. */
export const NOMBRE_ESTADO_TAREA: Record<EstadoTarea, string> = {
  pendiente: "Pendiente",
  cumplida: "Cumplida",
  incumplida: "Incumplida",
};

/** Redondea a un decimal. */
function redondear(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/**
 * Calcula el avance de un conjunto de tareas.
 *
 * - `avance`: porcentaje de tareas ya intervenidas (cumplidas + incumplidas).
 * - `cumplimiento`: porcentaje de las intervenidas que se cumplieron; es 0
 *   si todavía no se intervino ninguna.
 *
 * @param tareas Tareas del plan (o de un operario dentro del plan).
 */
export function progresoDeTareas(tareas: readonly TareaAsignada[]): ProgresoPlan {
  const total = tareas.length;
  const cumplidas = tareas.filter((t) => t.estado === "cumplida").length;
  const incumplidas = tareas.filter((t) => t.estado === "incumplida").length;
  const intervenidas = cumplidas + incumplidas;
  return {
    total,
    cumplidas,
    incumplidas,
    pendientes: total - intervenidas,
    avance: total === 0 ? 0 : redondear((intervenidas / total) * 100),
    cumplimiento: intervenidas === 0 ? 0 : redondear((cumplidas / intervenidas) * 100),
  };
}

/** Atajo: avance de todas las tareas de un plan. */
export function progresoDePlan(plan: PlanAsignado): ProgresoPlan {
  return progresoDeTareas(plan.tareas);
}

/**
 * Decide el estado de un plan según sus tareas: sin intervenciones sigue
 * `aprobado`, con alguna pendiente está `en_ejecucion` y sin pendientes
 * queda `finalizado`.
 */
export function estadoSegunTareas(tareas: readonly TareaAsignada[]): EstadoPlan {
  const { total, pendientes } = progresoDeTareas(tareas);
  if (total > 0 && pendientes === 0) return "finalizado";
  const hayIntervenidas = pendientes < total;
  return hayIntervenidas ? "en_ejecucion" : "aprobado";
}

/** Fila de gráfico: una criticidad con la cantidad de tareas por estado. */
export type DatoEstadoPorCriticidad = Record<string, string | number> & {
  etiqueta: string;
};

/**
 * Cuenta las tareas por criticidad y estado para el gráfico del avance.
 * Devuelve siempre las tres criticidades, de menor a mayor.
 *
 * @param tareas Tareas del plan.
 */
export function tareasPorCriticidadYEstado(
  tareas: readonly TareaAsignada[],
): DatoEstadoPorCriticidad[] {
  return ORDEN_CRITICIDAD.map((criticidad) => {
    const deEstaCriticidad = tareas.filter((t) => t.criticidad === criticidad);
    const contar = (estado: EstadoTarea) =>
      deEstaCriticidad.filter((t) => t.estado === estado).length;
    return {
      etiqueta: NOMBRE_CRITICIDAD[criticidad],
      cumplida: contar("cumplida"),
      incumplida: contar("incumplida"),
      pendiente: contar("pendiente"),
    };
  });
}

/** Fila de gráfico: una línea con la cantidad de tareas por criticidad. */
export type DatoDistribucion = Record<string, string | number> & {
  etiqueta: string;
};

/**
 * Agrupa la distribución por línea para el gráfico de barras: una entrada
 * por línea y un campo por criticidad con la suma de sus tareas.
 *
 * @param filas Filas de distribución (línea, sistema, criticidad, tareas).
 */
export function tareasPorLineaYCriticidad(
  filas: readonly FilaDistribucion[],
): DatoDistribucion[] {
  const porLinea = new Map<string, DatoDistribucion>();
  for (const fila of filas) {
    let dato = porLinea.get(fila.linea);
    if (!dato) {
      dato = { etiqueta: fila.linea };
      for (const criticidad of ORDEN_CRITICIDAD) dato[criticidad] = 0;
      porLinea.set(fila.linea, dato);
    }
    dato[fila.criticidad] = Number(dato[fila.criticidad]) + fila.tareas;
  }
  return [...porLinea.values()];
}
