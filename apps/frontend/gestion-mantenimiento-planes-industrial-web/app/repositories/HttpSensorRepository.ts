/**
 * Implementación del repositorio de sensores que consulta la API real.
 *
 * Sigue el contrato descrito en `docs/contrato-api-operacion.md`.
 */
import type {
  AnalisisSensores,
  EquipoResumen,
  EstadoEquipo,
  FiltroSensores,
} from "../types/operacion";
import type { SensorRepository } from "./SensorRepository";

/** Repositorio que obtiene los datos de sensores mediante peticiones HTTP. */
export class HttpSensorRepository implements SensorRepository {
  /** Dirección base de la API, sin barra final (ej. `http://localhost:8000`). */
  private readonly baseUrl: string;

  /**
   * @param baseUrl Dirección base de la API.
   */
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /** Consulta `GET /api/equipos`. */
  async listarEquipos(): Promise<EquipoResumen[]> {
    return this.leerJson(await fetch(`${this.baseUrl}/api/equipos`));
  }

  /** Consulta `GET /api/sensores/analisis?periodo=&linea_id=&equipo_id=`. */
  async obtenerAnalisis(filtro: FiltroSensores): Promise<AnalisisSensores> {
    const parametros = new URLSearchParams({ periodo: filtro.periodo });
    if (filtro.lineaId !== null) parametros.set("linea_id", String(filtro.lineaId));
    if (filtro.equipoId !== null) parametros.set("equipo_id", String(filtro.equipoId));
    return this.leerJson(await fetch(`${this.baseUrl}/api/sensores/analisis?${parametros}`));
  }

  /** Consulta `GET /api/equipos/estado-operativo` (con `?linea_id=` opcional). */
  async obtenerEstadoOperativo(lineaId: number | null): Promise<EstadoEquipo[]> {
    const consulta = lineaId === null ? "" : `?linea_id=${lineaId}`;
    return this.leerJson(await fetch(`${this.baseUrl}/api/equipos/estado-operativo${consulta}`));
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
