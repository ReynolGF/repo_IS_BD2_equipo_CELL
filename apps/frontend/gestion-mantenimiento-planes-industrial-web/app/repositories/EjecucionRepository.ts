/**
 * Patrón Repository para la ejecución de planes y las reinspecciones.
 *
 * Define QUÉ operaciones necesitan las pantallas del operario y del técnico,
 * sin decir DE DÓNDE salen los datos: puede ser el simulador local o la API.
 */
import type {
  Intervencion,
  NuevaIntervencion,
  NuevaSolicitudReinspeccion,
  NuevoRegistroReinspeccion,
  OperarioResumen,
  PlanAsignado,
  SolicitudReinspeccion,
  TecnicoResumen,
} from "../types/operacion";
import type { PlanResumen } from "../types/reporte";

/** Error de una regla de negocio: la API respondería 422. */
export class ReglaDeNegocioError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ReglaDeNegocioError";
  }
}

/** Error que indica que un recurso (operario, tarea, solicitud…) no existe. */
export class RecursoNoEncontradoError extends Error {
  /** Tipo de recurso buscado, por ejemplo "Solicitud". */
  readonly recurso: string;

  /**
   * @param recurso Tipo de recurso buscado.
   * @param id Identificador que no se encontró.
   */
  constructor(recurso: string, id: number) {
    super(`${recurso} ${id} no encontrado`);
    this.name = "RecursoNoEncontradoError";
    this.recurso = recurso;
  }
}

/** Contrato que cumplen todas las fuentes de datos de ejecución. */
export interface EjecucionRepository {
  /** Devuelve los operarios, para llenar el selector de la pantalla. */
  listarOperarios(): Promise<OperarioResumen[]>;

  /**
   * Devuelve los planes en los que el operario tiene tareas asignadas, con
   * todas las tareas del plan y el estado de cada una (T17).
   *
   * @throws {RecursoNoEncontradoError} Si el operario no existe.
   */
  listarPlanesDeOperario(operarioId: number): Promise<PlanAsignado[]>;

  /** Devuelve los planes aprobados, para llenar el selector del estado. */
  listarPlanesEnEjecucion(): Promise<PlanResumen[]>;

  /**
   * Devuelve un plan con el estado de todas sus tareas (T19).
   *
   * @throws {PlanNoEncontradoError} Si el plan no existe.
   */
  obtenerEstadoPlan(planId: number): Promise<PlanAsignado>;

  /** Devuelve el historial de intervenciones, de la más reciente a la más antigua. */
  listarIntervenciones(planId?: number): Promise<Intervencion[]>;

  /**
   * Registra la intervención de un operario sobre una tarea (T18).
   *
   * @throws {ReglaDeNegocioError} Si los datos son inválidos, la tarea no
   *   pertenece al operario o ya fue cumplida.
   */
  registrarIntervencion(datos: NuevaIntervencion): Promise<Intervencion>;

  /** Devuelve los técnicos disponibles como apoyo. */
  listarTecnicos(): Promise<TecnicoResumen[]>;

  /** Devuelve todas las solicitudes de reinspección, las pendientes primero. */
  listarSolicitudesReinspeccion(): Promise<SolicitudReinspeccion[]>;

  /**
   * Crea una solicitud virtual de reinspección, con apoyo opcional (T20).
   *
   * @throws {ReglaDeNegocioError} Si el motivo es inválido o ya hay una
   *   solicitud pendiente para esa intervención.
   */
  solicitarReinspeccion(datos: NuevaSolicitudReinspeccion): Promise<SolicitudReinspeccion>;

  /**
   * Pide un técnico adicional de apoyo para una solicitud pendiente (T20).
   *
   * @throws {RecursoNoEncontradoError} Si la solicitud o el técnico no existen.
   * @throws {ReglaDeNegocioError} Si la solicitud ya fue completada.
   */
  asignarApoyo(solicitudId: number, tecnicoId: number): Promise<SolicitudReinspeccion>;

  /**
   * Registra el resultado de la reinspección manual y cierra la solicitud (T21).
   *
   * @throws {RecursoNoEncontradoError} Si la solicitud no existe.
   * @throws {ReglaDeNegocioError} Si los datos son inválidos o ya estaba completada.
   */
  registrarReinspeccion(
    solicitudId: number,
    datos: NuevoRegistroReinspeccion,
  ): Promise<SolicitudReinspeccion>;
}
