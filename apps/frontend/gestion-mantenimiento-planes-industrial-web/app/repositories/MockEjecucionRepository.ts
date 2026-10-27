/**
 * Implementación simulada del repositorio de ejecución.
 *
 * A diferencia de los reportes (solo lectura), aquí los datos cambian:
 * cada instancia guarda su propia copia en memoria, de modo que registrar una
 * intervención se refleja al volver a consultar. Al reiniciar el servidor los
 * datos vuelven a su estado inicial.
 */
import { tecnicoDelPlan } from "../mocks/desdeDemo";
import {
  intervencionesMock,
  operariosMock,
  planesAsignadosMock,
  solicitudesMock,
  tecnicosMock,
} from "../mocks/ejecucion";
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
import { estadoSegunTareas } from "../utils/progreso";
import { validarRegistroReinspeccion, validarTextoObligatorio } from "../utils/validacion";
import {
  RecursoNoEncontradoError,
  ReglaDeNegocioError,
  type EjecucionRepository,
} from "./EjecucionRepository";
import { PlanNoEncontradoError } from "./ReporteRepository";

/** Repositorio que responde con los datos de `app/mocks/ejecucion.ts`. */
export class MockEjecucionRepository implements EjecucionRepository {
  /** Retardo artificial en milisegundos para simular una red real. */
  private readonly latenciaMs: number;
  /** Planes con el estado actual de sus tareas. */
  private planes: PlanAsignado[] = structuredClone(planesAsignadosMock);
  /** Historial de intervenciones. */
  private intervenciones: Intervencion[] = structuredClone(intervencionesMock);
  /** Solicitudes de reinspección. */
  private solicitudes: SolicitudReinspeccion[] = structuredClone(solicitudesMock);

  /**
   * @param latenciaMs Retardo de cada respuesta; usar 0 en las pruebas.
   */
  constructor(latenciaMs = 300) {
    this.latenciaMs = latenciaMs;
  }

  /** Devuelve los operarios simulados. */
  async listarOperarios(): Promise<OperarioResumen[]> {
    await this.esperar();
    return structuredClone(operariosMock);
  }

  /** Devuelve los planes donde el operario tiene al menos una tarea. */
  async listarPlanesDeOperario(operarioId: number): Promise<PlanAsignado[]> {
    await this.esperar();
    if (!operariosMock.some((o) => o.id === operarioId)) {
      throw new RecursoNoEncontradoError("Operario", operarioId);
    }
    return structuredClone(
      this.planes.filter((plan) => plan.tareas.some((t) => t.operario_id === operarioId)),
    );
  }

  /** Devuelve el resumen de todos los planes. */
  async listarPlanesEnEjecucion(): Promise<PlanResumen[]> {
    await this.esperar();
    return this.planes.map((p) => ({ id: p.plan_id, nombre: p.plan, linea: p.linea }));
  }

  /** Devuelve una copia del plan indicado. */
  async obtenerEstadoPlan(planId: number): Promise<PlanAsignado> {
    await this.esperar();
    return structuredClone(this.buscarPlan(planId));
  }

  /** Devuelve las intervenciones, de la más reciente a la más antigua. */
  async listarIntervenciones(planId?: number): Promise<Intervencion[]> {
    await this.esperar();
    const filtradas = this.intervenciones.filter(
      (i) => planId === undefined || i.plan_id === planId,
    );
    return structuredClone([...filtradas].sort((a, b) => b.fecha.localeCompare(a.fecha)));
  }

  /** Registra la intervención y actualiza el estado de la tarea y del plan. */
  async registrarIntervencion(datos: NuevaIntervencion): Promise<Intervencion> {
    await this.esperar();
    const error = validarTextoObligatorio(datos.observaciones, "El campo observaciones");
    if (error) throw new ReglaDeNegocioError(error);

    const plan = this.buscarPlan(datos.plan_id);
    const tarea = plan.tareas.find((t) => t.tarea_id === datos.tarea_id);
    if (!tarea) throw new RecursoNoEncontradoError("Tarea", datos.tarea_id);
    if (tarea.operario_id !== datos.operario_id) {
      throw new ReglaDeNegocioError("La tarea está asignada a otro operario.");
    }
    if (tarea.estado === "cumplida") {
      throw new ReglaDeNegocioError("La tarea ya fue cumplida y no admite más intervenciones.");
    }

    tarea.estado = datos.resultado;
    plan.estado = estadoSegunTareas(plan.tareas);
    const intervencion: Intervencion = {
      id: this.siguienteId(this.intervenciones),
      plan_id: plan.plan_id,
      linea: plan.linea,
      tarea_id: tarea.tarea_id,
      tarea: tarea.tarea,
      operario_id: tarea.operario_id,
      operario: tarea.operario,
      fecha: this.ahora(),
      resultado: datos.resultado,
      observaciones: datos.observaciones.trim(),
    };
    this.intervenciones.push(intervencion);
    return structuredClone(intervencion);
  }

  /** Devuelve los técnicos simulados. */
  async listarTecnicos(): Promise<TecnicoResumen[]> {
    await this.esperar();
    return structuredClone(tecnicosMock);
  }

  /** Devuelve las solicitudes con las pendientes primero. */
  async listarSolicitudesReinspeccion(): Promise<SolicitudReinspeccion[]> {
    await this.esperar();
    const orden = (s: SolicitudReinspeccion) => (s.estado === "pendiente" ? 0 : 1);
    return structuredClone(
      [...this.solicitudes].sort(
        (a, b) => orden(a) - orden(b) || b.fecha_solicitud.localeCompare(a.fecha_solicitud),
      ),
    );
  }

  /** Crea la solicitud, asignándola al técnico de guardia del plan. */
  async solicitarReinspeccion(datos: NuevaSolicitudReinspeccion): Promise<SolicitudReinspeccion> {
    await this.esperar();
    const error = validarTextoObligatorio(datos.motivo, "El motivo");
    if (error) throw new ReglaDeNegocioError(error);

    const intervencion = this.intervenciones.find((i) => i.id === datos.intervencion_id);
    if (!intervencion) throw new RecursoNoEncontradoError("Intervención", datos.intervencion_id);
    const duplicada = this.solicitudes.some(
      (s) => s.intervencion_id === intervencion.id && s.estado === "pendiente",
    );
    if (duplicada) {
      throw new ReglaDeNegocioError("Ya hay una reinspección pendiente para esta intervención.");
    }
    const apoyo =
      datos.tecnico_apoyo_id === null ? null : this.buscarTecnico(datos.tecnico_apoyo_id).nombre;

    const solicitud: SolicitudReinspeccion = {
      id: this.siguienteId(this.solicitudes),
      intervencion_id: intervencion.id,
      plan_id: intervencion.plan_id,
      linea: intervencion.linea,
      tarea: intervencion.tarea,
      operario: intervencion.operario,
      fecha_solicitud: this.ahora(),
      motivo: datos.motivo.trim(),
      tecnico_asignado: tecnicoDelPlan(intervencion.plan_id),
      tecnico_apoyo: apoyo,
      estado: "pendiente",
      reinspeccion: null,
    };
    this.solicitudes.push(solicitud);
    return structuredClone(solicitud);
  }

  /** Asigna un técnico adicional de apoyo a una solicitud pendiente. */
  async asignarApoyo(solicitudId: number, tecnicoId: number): Promise<SolicitudReinspeccion> {
    await this.esperar();
    const solicitud = this.buscarSolicitud(solicitudId);
    const tecnico = this.buscarTecnico(tecnicoId);
    if (solicitud.estado === "completada") {
      throw new ReglaDeNegocioError("La reinspección ya fue completada.");
    }
    solicitud.tecnico_apoyo = tecnico.nombre;
    return structuredClone(solicitud);
  }

  /** Guarda el resultado manual y cierra la solicitud. */
  async registrarReinspeccion(
    solicitudId: number,
    datos: NuevoRegistroReinspeccion,
  ): Promise<SolicitudReinspeccion> {
    await this.esperar();
    const solicitud = this.buscarSolicitud(solicitudId);
    if (solicitud.estado === "completada") {
      throw new ReglaDeNegocioError("La reinspección ya fue completada.");
    }
    const error = validarRegistroReinspeccion(datos.participantes, datos.observaciones);
    if (error) throw new ReglaDeNegocioError(error);

    solicitud.estado = "completada";
    solicitud.reinspeccion = {
      fecha: this.ahora(),
      participantes: [...datos.participantes],
      observaciones: datos.observaciones.trim(),
      resultado: datos.resultado,
    };
    return structuredClone(solicitud);
  }

  /** Busca un plan o lanza `PlanNoEncontradoError`. */
  private buscarPlan(planId: number): PlanAsignado {
    const plan = this.planes.find((p) => p.plan_id === planId);
    if (!plan) throw new PlanNoEncontradoError(planId);
    return plan;
  }

  /** Busca una solicitud o lanza `RecursoNoEncontradoError`. */
  private buscarSolicitud(id: number): SolicitudReinspeccion {
    const solicitud = this.solicitudes.find((s) => s.id === id);
    if (!solicitud) throw new RecursoNoEncontradoError("Solicitud", id);
    return solicitud;
  }

  /** Busca un técnico o lanza `RecursoNoEncontradoError`. */
  private buscarTecnico(id: number): TecnicoResumen {
    const tecnico = tecnicosMock.find((t) => t.id === id);
    if (!tecnico) throw new RecursoNoEncontradoError("Técnico", id);
    return tecnico;
  }

  /** Siguiente identificador libre de una lista con campo `id`. */
  private siguienteId(lista: readonly { id: number }[]): number {
    return Math.max(0, ...lista.map((e) => e.id)) + 1;
  }

  /** Fecha y hora actual en formato ISO 8601 sin zona (hasta los segundos). */
  private ahora(): string {
    return new Date().toISOString().slice(0, 19);
  }

  /** Pausa la ejecución el tiempo configurado en `latenciaMs`. */
  private esperar(): Promise<void> {
    return new Promise((resolver) => setTimeout(resolver, this.latenciaMs));
  }
}
