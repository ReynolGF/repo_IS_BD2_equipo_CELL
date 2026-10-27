/**
 * Tipos del contrato de la API para las funcionalidades 2, 4 y 6.
 *
 * Los nombres de los campos están en snake_case porque así los devuelve la
 * API (FastAPI/Python), y de esa forma no hace falta convertirlos.
 * Todas las tasas son porcentajes entre 0 y 100.
 */

/** Niveles de criticidad que puede tener una tarea de mantenimiento. */
export type Criticidad = "baja" | "media" | "alta";

/** Línea de producción sobre la que se consulta el reporte. */
export interface LineaProduccion {
  /** Identificador único de la línea. */
  id: number;
  /** Nombre de la línea, por ejemplo "Embotellado". */
  nombre: string;
}

/* ------------------------------------------------------------------ */
/* Funcionalidad 2: tareas más ejecutadas de una línea                 */
/* ------------------------------------------------------------------ */

/**
 * Una fila del reporte: una tarea con la cantidad de veces que se ejecutó
 * en los planes aprobados de la línea.
 */
export interface TareaEjecutada {
  /** Identificador único de la tarea. */
  tarea_id: number;
  /** Descripción de la tarea, por ejemplo "Revisar presión de la bomba". */
  tarea: string;
  /** Sistema o equipo al que pertenece la tarea. */
  sistema: string;
  /** Nivel de criticidad de la tarea. */
  criticidad: Criticidad;
  /** Cantidad total de ejecuciones registradas (siempre mayor que 0). */
  ejecuciones: number;
}

/**
 * Respuesta completa del endpoint
 * `GET /api/lineas/{linea_id}/tareas-mas-ejecutadas`.
 */
export interface ReporteTareasMasEjecutadas {
  /** Línea consultada. */
  linea: LineaProduccion;
  /** Tareas ordenadas por ejecuciones (mayor a menor) y, en empate, por nombre. */
  tareas: TareaEjecutada[];
}

/* ------------------------------------------------------------------ */
/* Funcionalidad 4: desempeño de los operarios en un plan              */
/* ------------------------------------------------------------------ */

/** Datos mínimos de un plan, usados para llenar el selector de planes. */
export interface PlanResumen {
  /** Identificador único del plan. */
  id: number;
  /** Nombre descriptivo del plan. */
  nombre: string;
  /** Nombre de la línea de producción a la que pertenece. */
  linea: string;
}

/** Cumplimiento de un operario en las tareas de una criticidad de un plan. */
export interface FilaDesempeno {
  /** Identificador único del operario. */
  operario_id: number;
  /** Nombre del operario. */
  operario: string;
  /** Turno del operario (mañana, tarde o noche). */
  turno: string;
  /** Criticidad de las tareas contabilizadas en esta fila. */
  criticidad: Criticidad;
  /** Tareas de esa criticidad asignadas al operario en el plan. */
  tareas_asignadas: number;
  /** Tareas de esa criticidad que el operario cumplió. */
  tareas_cumplidas: number;
  /** Tasa de cumplimiento: cumplidas / asignadas * 100. */
  tasa_cumplimiento: number;
}

/**
 * Respuesta del endpoint `GET /api/planes/{plan_id}/desempeno-operarios`.
 */
export interface ReporteDesempenoOperarios {
  /** Plan consultado. */
  plan: PlanResumen;
  /** Una fila por cada combinación operario y criticidad. */
  filas: FilaDesempeno[];
}

/* ------------------------------------------------------------------ */
/* Funcionalidad 6: análisis de cumplimiento                           */
/* ------------------------------------------------------------------ */

/** Rendimiento promedio de los operarios en las tareas de una criticidad. */
export interface RendimientoPorCriticidad {
  /** Criticidad de las tareas. */
  criticidad: Criticidad;
  /** Rendimiento (cumplimiento) promedio de los operarios, en porcentaje. */
  rendimiento_promedio: number;
}

/** Relación entre criticidad y rendimiento de los operarios en una línea. */
export interface CorrelacionLinea {
  /** Identificador de la línea. */
  linea_id: number;
  /** Nombre de la línea. */
  linea: string;
  /** Rendimiento promedio por cada nivel de criticidad. */
  rendimiento: RendimientoPorCriticidad[];
  /**
   * Coeficiente de correlación de Pearson entre el nivel de criticidad
   * (baja=1, media=2, alta=3) y el rendimiento. Va de -1 a 1.
   */
  coeficiente_correlacion: number;
}

/** Tarea con alta tasa de incumplimiento. */
export interface TareaIncumplida {
  /** Identificador de la tarea. */
  tarea_id: number;
  /** Descripción de la tarea. */
  tarea: string;
  /** Criticidad de la tarea. */
  criticidad: Criticidad;
  /** Nombre del técnico que creó la tarea. */
  tecnico_creador: string;
  /** Nombre de la línea a la que pertenece la tarea. */
  linea: string;
  /** Porcentaje de ejecuciones incumplidas de la tarea. */
  tasa_incumplimiento: number;
}

/** Comparación de un operario que pidió reinspección con el promedio de su turno. */
export interface ComparacionReinspeccion {
  /** Identificador del operario. */
  operario_id: number;
  /** Nombre del operario. */
  operario: string;
  /** Turno del operario. */
  turno: string;
  /** Línea de producción de la comparación. */
  linea: string;
  /** Tasa de cumplimiento del operario en esa línea. */
  tasa_operario: number;
  /** Tasa de cumplimiento promedio de su turno en esa misma línea. */
  tasa_promedio_turno: number;
  /** Diferencia: tasa_operario - tasa_promedio_turno (puede ser negativa). */
  diferencia: number;
}

/** Respuesta del endpoint `GET /api/analisis/cumplimiento`. */
export interface ReporteAnalisisCumplimiento {
  /** Correlación criticidad-rendimiento, una entrada por línea. */
  correlacion_por_linea: CorrelacionLinea[];
  /** Las 10 tareas con mayor incumplimiento, de mayor a menor tasa. */
  tareas_mayor_incumplimiento: TareaIncumplida[];
  /** Operarios que solicitaron reinspección frente al promedio de su turno. */
  reinspecciones: ComparacionReinspeccion[];
}
