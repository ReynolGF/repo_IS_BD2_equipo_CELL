/**
 * Implementación del repositorio de ejecución que consulta la API real.
 *
 * Sigue el contrato descrito en `docs/contrato-api-operacion.md`.
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
import {
  RecursoNoEncontradoError,
  ReglaDeNegocioError,
  type EjecucionRepository,
} from "./EjecucionRepository";
import { PlanNoEncontradoError } from "./ReporteRepository";

/** Repositorio que obtiene y envía los datos mediante peticiones HTTP. */
export class HttpEjecucionRepository implements EjecucionRepository {
  /** Dirección base de la API, sin barra final (ej. `http://localhost:8000`). */
  private readonly baseUrl: string;

  /**
   * @param baseUrl Dirección base de la API.
   */
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /** Consulta `GET /api/operarios`. */
  async listarOperarios(): Promise<OperarioResumen[]> {
    return this.leerJson(await fetch(`${this.baseUrl}/api/operarios`));
  }

  /** Consulta `GET /api/operarios/{id}/planes`. */
  async listarPlanesDeOperario(operarioId: number): Promise<PlanAsignado[]> {
    const respuesta = await fetch(`${this.baseUrl}/api/operarios/${operarioId}/planes`);
    if (respuesta.status === 404) throw new RecursoNoEncontradoError("Operario", operarioId);
    return this.leerJson(respuesta);
  }

  /** Consulta `GET /api/planes?estado=aprobados`. */
  async listarPlanesEnEjecucion(): Promise<PlanResumen[]> {
    return this.leerJson(await fetch(`${this.baseUrl}/api/planes?estado=aprobados`));
  }

  /** Consulta `GET /api/planes/{id}/estado-ejecucion`. */
  async obtenerEstadoPlan(planId: number): Promise<PlanAsignado> {
    const respuesta = await fetch(`${this.baseUrl}/api/planes/${planId}/estado-ejecucion`);
    if (respuesta.status === 404) throw new PlanNoEncontradoError(planId);
    return this.leerJson(respuesta);
  }

  /** Consulta `GET /api/intervenciones` (con `?plan_id=` opcional). */
  async listarIntervenciones(planId?: number): Promise<Intervencion[]> {
    const consulta = planId === undefined ? "" : `?plan_id=${planId}`;
    return this.leerJson(await fetch(`${this.baseUrl}/api/intervenciones${consulta}`));
  }

  /** Envía `POST /api/intervenciones`. */
  async registrarIntervencion(datos: NuevaIntervencion): Promise<Intervencion> {
    return this.enviar("POST", "/api/intervenciones", datos);
  }

  /** Consulta `GET /api/tecnicos`. */
  async listarTecnicos(): Promise<TecnicoResumen[]> {
    return this.leerJson(await fetch(`${this.baseUrl}/api/tecnicos`));
  }

  /** Consulta `GET /api/reinspecciones`. */
  async listarSolicitudesReinspeccion(): Promise<SolicitudReinspeccion[]> {
    return this.leerJson(await fetch(`${this.baseUrl}/api/reinspecciones`));
  }

  /** Envía `POST /api/reinspecciones`. */
  async solicitarReinspeccion(datos: NuevaSolicitudReinspeccion): Promise<SolicitudReinspeccion> {
    return this.enviar("POST", "/api/reinspecciones", datos);
  }

  /** Envía `PATCH /api/reinspecciones/{id}/apoyo`. */
  async asignarApoyo(solicitudId: number, tecnicoId: number): Promise<SolicitudReinspeccion> {
    return this.enviar("PATCH", `/api/reinspecciones/${solicitudId}/apoyo`, {
      tecnico_id: tecnicoId,
    });
  }

  /** Envía `POST /api/reinspecciones/{id}/resultado`. */
  async registrarReinspeccion(
    solicitudId: number,
    datos: NuevoRegistroReinspeccion,
  ): Promise<SolicitudReinspeccion> {
    return this.enviar("POST", `/api/reinspecciones/${solicitudId}/resultado`, datos);
  }

  /**
   * Envía un cuerpo JSON y traduce los errores de la API a errores del dominio:
   * 404 → `RecursoNoEncontradoError`, 422 → `ReglaDeNegocioError` con el
   * mensaje que devuelve el backend en `detail`.
   */
  private async enviar<T>(metodo: string, ruta: string, cuerpo: unknown): Promise<T> {
    const respuesta = await fetch(`${this.baseUrl}${ruta}`, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    if (respuesta.status === 404) throw new RecursoNoEncontradoError("Recurso", 0);
    if (respuesta.status === 422) {
      const { detail } = (await respuesta.json()) as { detail?: string };
      throw new ReglaDeNegocioError(detail ?? "Los datos enviados no son válidos.");
    }
    return this.leerJson<T>(respuesta);
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
