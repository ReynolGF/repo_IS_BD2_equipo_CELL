/**
 * Implementación del repositorio con datos simulados.
 *
 * Se usa mientras el backend no esté disponible y en las pruebas unitarias.
 */
import { analisisCumplimientoMock } from "../mocks/analisisCumplimiento";
import { desempenoMock, planesMock } from "../mocks/desempenoOperarios";
import { distribucionLineasMock } from "../mocks/distribucionLineas";
import { reportesMock } from "../mocks/tareasMasEjecutadas";
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

/** Repositorio que responde con los datos de `app/mocks`. */
export class MockReporteRepository implements ReporteRepository {
  /** Retardo artificial en milisegundos para simular una red real. */
  private readonly latenciaMs: number;

  /**
   * @param latenciaMs Retardo de cada respuesta; usar 0 en las pruebas.
   */
  constructor(latenciaMs = 300) {
    this.latenciaMs = latenciaMs;
  }

  /** Devuelve las líneas presentes en los datos simulados. */
  async listarLineas(): Promise<LineaProduccion[]> {
    await this.esperar();
    return Object.values(reportesMock).map((reporte) => reporte.linea);
  }

  /** Devuelve una copia del reporte simulado de la línea indicada. */
  async obtenerTareasMasEjecutadas(
    lineaId: number,
  ): Promise<ReporteTareasMasEjecutadas> {
    await this.esperar();
    const reporte = reportesMock[lineaId];
    if (!reporte) {
      throw new LineaNoEncontradaError(lineaId);
    }
    return structuredClone(reporte);
  }

  /** Devuelve los planes simulados. */
  async listarPlanes(): Promise<PlanResumen[]> {
    await this.esperar();
    return structuredClone(planesMock);
  }

  /** Devuelve una copia del desempeño simulado del plan indicado. */
  async obtenerDesempenoOperarios(
    planId: number,
  ): Promise<ReporteDesempenoOperarios> {
    await this.esperar();
    const reporte = desempenoMock[planId];
    if (!reporte) {
      throw new PlanNoEncontradoError(planId);
    }
    return structuredClone(reporte);
  }

  /** Devuelve una copia del análisis de cumplimiento simulado. */
  async obtenerAnalisisCumplimiento(): Promise<ReporteAnalisisCumplimiento> {
    await this.esperar();
    return structuredClone(analisisCumplimientoMock);
  }

  /** Devuelve una copia de la distribución simulada entre líneas. */
  async obtenerDistribucionLineas(): Promise<ReporteDistribucionLineas> {
    await this.esperar();
    return structuredClone(distribucionLineasMock);
  }

  /** Pausa la ejecución el tiempo configurado en `latenciaMs`. */
  private esperar(): Promise<void> {
    return new Promise((resolver) => setTimeout(resolver, this.latenciaMs));
  }
}
