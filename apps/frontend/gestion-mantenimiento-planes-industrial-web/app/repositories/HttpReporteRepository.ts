/**
 * Implementación del repositorio que consulta la API real del backend.
 *
 * Sigue el contrato descrito en `docs/contrato-api-operacion.md`.
 */
import type { ReporteDistribucionLineas } from "../types/operacion";
import type {
  LineaProduccion,
  PlanResumen,
  ReporteAnalisisCumplimiento,
  ReporteDesempenoOperarios,
  ReporteTareasMasEjecutadas,
} from "../types/reporte";
import {
  LineaNoEncontradaError,
  PlanNoEncontradoError,
  type ReporteRepository,
} from "./ReporteRepository";

/** Repositorio que obtiene los datos mediante peticiones HTTP. */
export class HttpReporteRepository implements ReporteRepository {
  /** Dirección base de la API, sin barra final (ej. `http://localhost:8000`). */
  private readonly baseUrl: string;

  /**
   * @param baseUrl Dirección base de la API.
   */
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /** Consulta `GET /api/lineas`. */
  async listarLineas(): Promise<LineaProduccion[]> {
    const respuesta = await fetch(`${this.baseUrl}/api/lineas`);
    return this.leerJson<LineaProduccion[]>(respuesta);
  }

  /** Consulta `GET /api/lineas/{lineaId}/tareas-mas-ejecutadas`. */
  async obtenerTareasMasEjecutadas(
    lineaId: number,
  ): Promise<ReporteTareasMasEjecutadas> {
    const respuesta = await fetch(
      `${this.baseUrl}/api/lineas/${lineaId}/tareas-mas-ejecutadas`,
    );
    if (respuesta.status === 404) {
      throw new LineaNoEncontradaError(lineaId);
    }
    return this.leerJson<ReporteTareasMasEjecutadas>(respuesta);
  }

  /** Consulta `GET /api/planes`. */
  async listarPlanes(): Promise<PlanResumen[]> {
    const respuesta = await fetch(`${this.baseUrl}/api/planes`);
    return this.leerJson<PlanResumen[]>(respuesta);
  }

  /** Consulta `GET /api/planes/{planId}/desempeno-operarios`. */
  async obtenerDesempenoOperarios(
    planId: number,
  ): Promise<ReporteDesempenoOperarios> {
    const respuesta = await fetch(
      `${this.baseUrl}/api/planes/${planId}/desempeno-operarios`,
    );
    if (respuesta.status === 404) {
      throw new PlanNoEncontradoError(planId);
    }
    return this.leerJson<ReporteDesempenoOperarios>(respuesta);
  }

  /** Consulta `GET /api/analisis/cumplimiento`. */
  async obtenerAnalisisCumplimiento(): Promise<ReporteAnalisisCumplimiento> {
    const respuesta = await fetch(`${this.baseUrl}/api/analisis/cumplimiento`);
    return this.leerJson<ReporteAnalisisCumplimiento>(respuesta);
  }

  /** Consulta `GET /api/analisis/distribucion-lineas`. */
  async obtenerDistribucionLineas(): Promise<ReporteDistribucionLineas> {
    const respuesta = await fetch(`${this.baseUrl}/api/analisis/distribucion-lineas`);
    return this.leerJson<ReporteDistribucionLineas>(respuesta);
  }

  /**
   * Convierte la respuesta en JSON o lanza un error si el servidor falló.
   *
   * @throws {Error} Si el estado HTTP no es exitoso.
   */
  private async leerJson<T>(respuesta: Response): Promise<T> {
    if (!respuesta.ok) {
      throw new Error(`La API respondió con el estado ${respuesta.status}`);
    }
    return (await respuesta.json()) as T;
  }
}
