/**
 * Implementación simulada del repositorio de sensores.
 *
 * Aplica los mismos filtros que aplicaría el backend sobre los datos de
 * `app/mocks/sensores.ts`.
 */
import { agregadosDeEquipo, equiposMock, estadosEquiposMock } from "../mocks/sensores";
import type {
  AnalisisSensores,
  EquipoResumen,
  EstadoEquipo,
  FiltroSensores,
} from "../types/operacion";
import type { SensorRepository } from "./SensorRepository";

/** Repositorio que responde con los datos simulados de sensores. */
export class MockSensorRepository implements SensorRepository {
  /** Retardo artificial en milisegundos para simular una red real. */
  private readonly latenciaMs: number;

  /**
   * @param latenciaMs Retardo de cada respuesta; usar 0 en las pruebas.
   */
  constructor(latenciaMs = 300) {
    this.latenciaMs = latenciaMs;
  }

  /** Devuelve los equipos simulados. */
  async listarEquipos(): Promise<EquipoResumen[]> {
    await this.esperar();
    return structuredClone(equiposMock);
  }

  /** Agrega los equipos que cumplen los filtros de línea y equipo. */
  async obtenerAnalisis(filtro: FiltroSensores): Promise<AnalisisSensores> {
    await this.esperar();
    const equipos = equiposMock.filter(
      (e) =>
        (filtro.lineaId === null || e.linea_id === filtro.lineaId) &&
        (filtro.equipoId === null || e.id === filtro.equipoId),
    );
    return {
      periodo: filtro.periodo,
      agregados: equipos.flatMap((e) => agregadosDeEquipo(e, filtro.periodo)),
    };
  }

  /** Devuelve el estado de los equipos de la línea indicada (o de todas). */
  async obtenerEstadoOperativo(lineaId: number | null): Promise<EstadoEquipo[]> {
    await this.esperar();
    const lineaDe = new Map(equiposMock.map((e) => [e.id, e.linea_id]));
    return structuredClone(
      estadosEquiposMock.filter((e) => lineaId === null || lineaDe.get(e.equipo_id) === lineaId),
    );
  }

  /** Pausa la ejecución el tiempo configurado en `latenciaMs`. */
  private esperar(): Promise<void> {
    return new Promise((resolver) => setTimeout(resolver, this.latenciaMs));
  }
}
