/**
 * Tipos del contrato de la API para la operación diaria: ejecución de planes,
 * reinspecciones, sensores y distribución de tareas entre líneas.
 *
 * Igual que en `reporte.ts`, los campos están en snake_case porque así los
 * devuelve la API (FastAPI/Python). Las fechas viajan en formato ISO 8601.
 */
import type { Criticidad } from "./reporte";

/* ------------------------------------------------------------------ */
/* Ejecución de planes (T17, T18, T19)                                 */
/* ------------------------------------------------------------------ */

/** Estados por los que pasa un plan una vez aprobado. */
export type EstadoPlan = "aprobado" | "en_ejecucion" | "finalizado";

/** Estados de una tarea dentro de un plan. */
export type EstadoTarea = "pendiente" | "cumplida" | "incumplida";

/** Resultado que el operario registra al intervenir una tarea. */
export type ResultadoIntervencion = Exclude<EstadoTarea, "pendiente">;

/** Datos mínimos de un operario, usados para llenar el selector. */
export interface OperarioResumen {
  /** Identificador único del operario. */
  id: number;
  /** Nombre del operario. */
  nombre: string;
  /** Turno del operario (mañana, tarde o noche). */
  turno: string;
  /** Nombres de las líneas en las que trabaja el operario. */
  lineas: string[];
}

/** Tarea de un plan asignada a un operario. */
export interface TareaAsignada {
  /** Identificador único de la tarea. */
  tarea_id: number;
  /** Descripción de la tarea. */
  tarea: string;
  /** Sistema o equipo al que pertenece. */
  sistema: string;
  /** Criticidad de la tarea. */
  criticidad: Criticidad;
  /** Estado actual de la tarea dentro del plan. */
  estado: EstadoTarea;
  /** Identificador del operario responsable. */
  operario_id: number;
  /** Nombre del operario responsable. */
  operario: string;
}

/** Plan aprobado con todas sus tareas y el estado de cada una. */
export interface PlanAsignado {
  /** Identificador único del plan. */
  plan_id: number;
  /** Nombre descriptivo del plan. */
  plan: string;
  /** Nombre de la línea de producción. */
  linea: string;
  /** Estado del plan. */
  estado: EstadoPlan;
  /** Tareas del plan. */
  tareas: TareaAsignada[];
}

/** Intervención registrada por un operario sobre una tarea de un plan. */
export interface Intervencion {
  /** Identificador único de la intervención. */
  id: number;
  /** Plan al que pertenece la tarea. */
  plan_id: number;
  /** Nombre de la línea del plan. */
  linea: string;
  /** Tarea intervenida. */
  tarea_id: number;
  /** Descripción de la tarea intervenida. */
  tarea: string;
  /** Operario que realizó la intervención. */
  operario_id: number;
  /** Nombre del operario. */
  operario: string;
  /** Fecha y hora del registro (ISO 8601). */
  fecha: string;
  /** Resultado de la intervención. */
  resultado: ResultadoIntervencion;
  /** Observaciones libres del operario. */
  observaciones: string;
}

/** Datos que el operario envía para registrar una intervención. */
export interface NuevaIntervencion {
  /** Plan al que pertenece la tarea. */
  plan_id: number;
  /** Tarea intervenida. */
  tarea_id: number;
  /** Operario que interviene. */
  operario_id: number;
  /** Resultado de la intervención. */
  resultado: ResultadoIntervencion;
  /** Observaciones libres (obligatorias). */
  observaciones: string;
}

/** Resumen numérico del avance de un plan (T19). */
export interface ProgresoPlan {
  /** Total de tareas del plan. */
  total: number;
  /** Tareas cumplidas. */
  cumplidas: number;
  /** Tareas incumplidas. */
  incumplidas: number;
  /** Tareas todavía sin intervenir. */
  pendientes: number;
  /** Porcentaje de tareas ya intervenidas (cumplidas + incumplidas). */
  avance: number;
  /** Porcentaje de tareas intervenidas que se cumplieron. */
  cumplimiento: number;
}

/* ------------------------------------------------------------------ */
/* Reinspecciones (T20, T21)                                           */
/* ------------------------------------------------------------------ */

/** Técnico que puede atender o apoyar una reinspección. */
export interface TecnicoResumen {
  /** Identificador único del técnico. */
  id: number;
  /** Nombre del técnico. */
  nombre: string;
  /** Especialidad del técnico. */
  especialidad: string;
  /** Líneas en las que el técnico puede intervenir. */
  lineas: string[];
}

/** Resultado posible de una reinspección manual. */
export type ResultadoReinspeccion = "conforme" | "no_conforme";

/** Registro de la reinspección manual ya realizada (T21). */
export interface RegistroReinspeccion {
  /** Fecha y hora en que se realizó (ISO 8601). */
  fecha: string;
  /** Nombres de las personas que participaron. */
  participantes: string[];
  /** Observaciones del técnico. */
  observaciones: string;
  /** Resultado de la reinspección. */
  resultado: ResultadoReinspeccion;
}

/** Solicitud virtual de reinspección hecha por un operario (T20). */
export interface SolicitudReinspeccion {
  /** Identificador único de la solicitud. */
  id: number;
  /** Intervención que originó la solicitud. */
  intervencion_id: number;
  /** Plan al que pertenece la tarea. */
  plan_id: number;
  /** Nombre de la línea del plan. */
  linea: string;
  /** Descripción de la tarea a reinspeccionar. */
  tarea: string;
  /** Operario que pidió la reinspección. */
  operario: string;
  /** Fecha y hora de la solicitud (ISO 8601). */
  fecha_solicitud: string;
  /** Motivo escrito por el operario. */
  motivo: string;
  /** Técnico asignado al plan, que atiende la solicitud. */
  tecnico_asignado: string;
  /** Técnico adicional pedido como apoyo, o `null` si no se pidió. */
  tecnico_apoyo: string | null;
  /** `pendiente` hasta que se registra el resultado manual. */
  estado: "pendiente" | "completada";
  /** Registro manual; `null` mientras la solicitud está pendiente. */
  reinspeccion: RegistroReinspeccion | null;
}

/** Datos que el operario envía para solicitar una reinspección. */
export interface NuevaSolicitudReinspeccion {
  /** Intervención que se quiere reinspeccionar. */
  intervencion_id: number;
  /** Motivo de la solicitud (obligatorio). */
  motivo: string;
  /** Técnico adicional pedido como apoyo, si lo hay. */
  tecnico_apoyo_id: number | null;
}

/** Datos que el técnico envía para registrar la reinspección manual. */
export interface NuevoRegistroReinspeccion {
  /** Nombres de las personas que participaron (al menos una). */
  participantes: string[];
  /** Observaciones del técnico (obligatorias). */
  observaciones: string;
  /** Resultado de la reinspección. */
  resultado: ResultadoReinspeccion;
}

/* ------------------------------------------------------------------ */
/* Sensores (T23, T24)                                                 */
/* ------------------------------------------------------------------ */

/** Magnitudes que miden los sensores de los equipos. */
export type TipoSensor = "temperatura" | "vibracion" | "presion";

/** Periodos de análisis disponibles para el histórico de sensores. */
export type PeriodoSensor = "24h" | "7d" | "30d";

/** Estado operativo de un equipo según sus últimas lecturas. */
export type EstadoOperativo = "normal" | "alerta" | "critico";

/** Equipo con sensores instalados. */
export interface EquipoResumen {
  /** Identificador único del equipo. */
  id: number;
  /** Nombre del equipo, por ejemplo "Bomba hidráulica B-02". */
  nombre: string;
  /** Identificador de la línea a la que pertenece. */
  linea_id: number;
  /** Nombre de la línea. */
  linea: string;
}

/** Filtros del análisis de sensores; todos son opcionales salvo el periodo. */
export interface FiltroSensores {
  /** Línea a analizar, o `null` para todas. */
  lineaId: number | null;
  /** Equipo a analizar, o `null` para todos. */
  equipoId: number | null;
  /** Periodo de análisis. */
  periodo: PeriodoSensor;
}

/** Valores agregados de un tipo de sensor de un equipo en un periodo. */
export interface AgregadoSensor {
  /** Equipo medido. */
  equipo_id: number;
  /** Nombre del equipo. */
  equipo: string;
  /** Nombre de la línea del equipo. */
  linea: string;
  /** Magnitud medida. */
  tipo_sensor: TipoSensor;
  /** Unidad de la magnitud, por ejemplo "°C". */
  unidad: string;
  /** Valor mínimo del periodo. */
  minimo: number;
  /** Valor promedio del periodo. */
  promedio: number;
  /** Valor máximo del periodo. */
  maximo: number;
  /** Cantidad de lecturas agregadas. */
  lecturas: number;
}

/** Respuesta del endpoint `GET /api/sensores/analisis`. */
export interface AnalisisSensores {
  /** Periodo analizado. */
  periodo: PeriodoSensor;
  /** Una fila por equipo y tipo de sensor. */
  agregados: AgregadoSensor[];
}

/** Estado operativo actual de un equipo. */
export interface EstadoEquipo {
  /** Identificador del equipo. */
  equipo_id: number;
  /** Nombre del equipo. */
  equipo: string;
  /** Nombre de la línea del equipo. */
  linea: string;
  /** Estado operativo calculado por el backend. */
  estado: EstadoOperativo;
  /** Última temperatura registrada, en °C. */
  temperatura: number;
  /** Última vibración registrada, en mm/s. */
  vibracion: number;
  /** Última presión registrada, en bar. */
  presion: number;
  /** Fecha y hora de la última lectura (ISO 8601). */
  ultima_lectura: string;
}

/* ------------------------------------------------------------------ */
/* Distribución de tareas entre líneas (T29)                           */
/* ------------------------------------------------------------------ */

/** Cantidad de tareas de una línea para un sistema y una criticidad. */
export interface FilaDistribucion {
  /** Identificador de la línea. */
  linea_id: number;
  /** Nombre de la línea. */
  linea: string;
  /** Sistema o equipo. */
  sistema: string;
  /** Criticidad de las tareas contadas. */
  criticidad: Criticidad;
  /** Cantidad de tareas. */
  tareas: number;
}

/** Resultado de las reglas de equilibrio de una línea. */
export interface EquilibrioLinea {
  /** Identificador de la línea. */
  linea_id: number;
  /** Nombre de la línea. */
  linea: string;
  /** Porcentaje de equilibrio obtenido (0 a 100). */
  porcentaje_equilibrio: number;
  /** Porcentaje mínimo exigido por el criterio. */
  minimo_requerido: number;
  /** `true` si la línea cumple el criterio de equilibrio. */
  cumple_criterio: boolean;
}

/** Respuesta del endpoint `GET /api/analisis/distribucion-lineas`. */
export interface ReporteDistribucionLineas {
  /** Distribución por línea, sistema y criticidad. */
  filas: FilaDistribucion[];
  /** Resultado del criterio de equilibrio, una entrada por línea. */
  equilibrio: EquilibrioLinea[];
}
