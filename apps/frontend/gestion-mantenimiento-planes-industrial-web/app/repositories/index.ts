/**
 * Punto único donde se decide qué repositorio usa la aplicación.
 *
 * - Si existe la variable de entorno `VITE_API_URL`, se usa la API real.
 * - Si no existe, se usan los datos simulados.
 *
 * El resto del código importa `reporteRepository` desde aquí y nunca crea
 * un repositorio por su cuenta.
 */
import type { EjecucionRepository } from "./EjecucionRepository";
import { HttpEjecucionRepository } from "./HttpEjecucionRepository";
import { HttpReporteRepository } from "./HttpReporteRepository";
import { HttpSensorRepository } from "./HttpSensorRepository";
import { MockEjecucionRepository } from "./MockEjecucionRepository";
import { MockReporteRepository } from "./MockReporteRepository";
import { MockSensorRepository } from "./MockSensorRepository";
import type { ReporteRepository } from "./ReporteRepository";
import type { SensorRepository } from "./SensorRepository";

/**
 * Dirección base de la API. `VITE_API_URL` puede terminar en `/api` (así lo usa
 * la capa de datos de `app/data`); estos repositorios añaden `/api/...` ellos
 * mismos, por eso se quita ese sufijo para no duplicarlo.
 */
const apiUrl: string | undefined = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "");

/** Repositorio activo de los reportes. */
export const reporteRepository: ReporteRepository = apiUrl
  ? new HttpReporteRepository(apiUrl)
  : new MockReporteRepository();

/** Repositorio activo de la ejecución de planes y las reinspecciones. */
export const ejecucionRepository: EjecucionRepository = apiUrl
  ? new HttpEjecucionRepository(apiUrl)
  : new MockEjecucionRepository();

/** Repositorio activo de los datos de sensores. */
export const sensorRepository: SensorRepository = apiUrl
  ? new HttpSensorRepository(apiUrl)
  : new MockSensorRepository();

export {
  LineaNoEncontradaError,
  PlanNoEncontradoError,
} from "./ReporteRepository";
export type { ReporteRepository } from "./ReporteRepository";
export {
  RecursoNoEncontradoError,
  ReglaDeNegocioError,
} from "./EjecucionRepository";
export type { EjecucionRepository } from "./EjecucionRepository";
export type { SensorRepository } from "./SensorRepository";
