/**
 * Patrón Repository para los datos de sensores.
 *
 * Las pantallas piden análisis agregados y el estado operativo actual; el
 * histórico completo de lecturas nunca llega al navegador (es de alto volumen
 * y lo agrega el backend).
 */
import type {
  AnalisisSensores,
  EquipoResumen,
  EstadoEquipo,
  FiltroSensores,
} from "../types/operacion";

/** Contrato que cumplen todas las fuentes de datos de sensores. */
export interface SensorRepository {
  /** Devuelve los equipos con sensores, para llenar los selectores. */
  listarEquipos(): Promise<EquipoResumen[]>;

  /**
   * Devuelve los valores agregados (mínimo, promedio y máximo) por equipo y
   * tipo de sensor en el periodo indicado (T23).
   *
   * @param filtro Línea, equipo y periodo; línea y equipo son opcionales.
   */
  obtenerAnalisis(filtro: FiltroSensores): Promise<AnalisisSensores>;

  /**
   * Devuelve el estado operativo actual de los equipos (T24).
   *
   * @param lineaId Línea a consultar, o `null` para todas.
   */
  obtenerEstadoOperativo(lineaId: number | null): Promise<EstadoEquipo[]>;
}
