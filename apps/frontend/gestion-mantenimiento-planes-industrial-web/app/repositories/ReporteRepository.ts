/**
 * Patrón Repository para los reportes del frontend.
 *
 * Define QUÉ datos necesita la aplicación, sin decir DE DÓNDE salen. Los
 * componentes y páginas dependen solo de esta interfaz, de modo que se puede
 * cambiar entre datos simulados y la API real sin tocarlos.
 */
import type { ReporteDistribucionLineas } from "../types/operacion";
import type {
  LineaProduccion,
  PlanResumen,
  ReporteAnalisisCumplimiento,
  ReporteDesempenoOperarios,
  ReporteTareasMasEjecutadas,
} from "../types/reporte";

/** Error que indica que la línea de producción consultada no existe. */
export class LineaNoEncontradaError extends Error {
  /** Identificador de la línea que no se encontró. */
  readonly lineaId: number;

  constructor(lineaId: number) {
    super("Línea no encontrada");
    this.name = "LineaNoEncontradaError";
    this.lineaId = lineaId;
  }
}

/** Error que indica que el plan de mantenimiento consultado no existe. */
export class PlanNoEncontradoError extends Error {
  /** Identificador del plan que no se encontró. */
  readonly planId: number;

  constructor(planId: number) {
    super("Plan no encontrado");
    this.name = "PlanNoEncontradoError";
    this.planId = planId;
  }
}

/** Contrato que cumplen todas las fuentes de datos de los reportes. */
export interface ReporteRepository {
  /**
   * Devuelve todas las líneas de producción disponibles.
   * Se usa para llenar el selector de línea.
   */
  listarLineas(): Promise<LineaProduccion[]>;

  /**
   * Devuelve el reporte de tareas más ejecutadas de una línea (funcionalidad 2).
   *
   * @param lineaId Identificador de la línea de producción.
   * @throws {LineaNoEncontradaError} Si la línea no existe.
   */
  obtenerTareasMasEjecutadas(
    lineaId: number,
  ): Promise<ReporteTareasMasEjecutadas>;

  /**
   * Devuelve los planes disponibles. Se usa para llenar el selector de plan.
   */
  listarPlanes(): Promise<PlanResumen[]>;

  /**
   * Devuelve el desempeño de los operarios en un plan (funcionalidad 4).
   *
   * @param planId Identificador del plan de mantenimiento.
   * @throws {PlanNoEncontradoError} Si el plan no existe.
   */
  obtenerDesempenoOperarios(planId: number): Promise<ReporteDesempenoOperarios>;

  /**
   * Devuelve el análisis de cumplimiento de todas las líneas (funcionalidad 6).
   */
  obtenerAnalisisCumplimiento(): Promise<ReporteAnalisisCumplimiento>;

  /**
   * Devuelve la distribución de tareas por línea, sistema y criticidad, con
   * el resultado del criterio de equilibrio de cada línea (T29).
   */
  obtenerDistribucionLineas(): Promise<ReporteDistribucionLineas>;
}
