/**
 * Reinspecciones: solicitud virtual del operario con apoyo opcional (T20) y
 * registro del resultado de la reinspección manual por el técnico (T21).
 *
 * Una sola ruta atiende tres formularios; el campo oculto `accion` indica
 * cuál se envió: `solicitar`, `apoyo` o `resultado`.
 */
import { Form, useNavigation } from "react-router";
import { useAlcance } from "../auth/useAlcance";
import { CLASE_BOTON, CLASE_CONTROL, CLASE_ETIQUETA } from "../components/estilos";
import { InsigniaEstado } from "../components/InsigniaEstado";
import { Mensaje } from "../components/Mensaje";
import { EncabezadoReporte, Seccion } from "../components/Seccion";
import {
  ejecucionRepository,
  RecursoNoEncontradoError,
  ReglaDeNegocioError,
} from "../repositories";
import type {
  Intervencion,
  ResultadoReinspeccion,
  SolicitudReinspeccion,
  TecnicoResumen,
} from "../types/operacion";
import {
  intervencionVisible,
  puedeAtenderReinspeccion,
  puedeSolicitarReinspeccion,
  solicitudVisible,
} from "../utils/alcance";
import { formatoFechaHora } from "../utils/formato";
import { leerNumero, leerTexto } from "../utils/formulario";
import {
  separarParticipantes,
  validarRegistroReinspeccion,
  validarTextoObligatorio,
} from "../utils/validacion";
import type { Route } from "./+types/reinspecciones";

/** Datos que el `loader` entrega a la página. */
export interface DatosReinspecciones {
  /** Intervenciones sobre las que se puede pedir una reinspección. */
  intervenciones: Intervencion[];
  /** Solicitudes existentes, las pendientes primero. */
  solicitudes: SolicitudReinspeccion[];
  /** Técnicos disponibles como apoyo. */
  tecnicos: TecnicoResumen[];
}

/** Resultado de enviar uno de los formularios. */
export type ResultadoAccion = { ok: string } | { error: string };

/** Texto de cada resultado de reinspección. */
const NOMBRE_RESULTADO: Record<ResultadoReinspeccion, string> = {
  conforme: "Conforme",
  no_conforme: "No conforme",
};

/** Título de la pestaña del navegador. */
export function meta(_: Route.MetaArgs) {
  return [{ title: "Reinspecciones · Mantenimiento industrial" }];
}

/** Obtiene las intervenciones, solicitudes y técnicos que usa la página. */
export async function loader(): Promise<DatosReinspecciones> {
  const [intervenciones, solicitudes, tecnicos] = await Promise.all([
    ejecucionRepository.listarIntervenciones(),
    ejecucionRepository.listarSolicitudesReinspeccion(),
    ejecucionRepository.listarTecnicos(),
  ]);
  return { intervenciones, solicitudes, tecnicos };
}

/**
 * Procesa los tres formularios de la página.
 * Valida los campos y deja que el repositorio aplique las reglas de negocio;
 * cualquier error esperado vuelve como mensaje para mostrarlo en pantalla.
 */
export async function action({ request }: Route.ActionArgs): Promise<ResultadoAccion> {
  const datos = await request.formData();
  const accion = leerTexto(datos, "accion");

  try {
    if (accion === "solicitar") {
      const intervencionId = leerNumero(datos, "intervencion_id");
      const motivo = leerTexto(datos, "motivo");
      if (intervencionId === null) return { error: "Elige la intervención a reinspeccionar." };
      const errorMotivo = validarTextoObligatorio(motivo, "El motivo");
      if (errorMotivo) return { error: errorMotivo };
      await ejecucionRepository.solicitarReinspeccion({
        intervencion_id: intervencionId,
        motivo,
        tecnico_apoyo_id: leerNumero(datos, "tecnico_apoyo_id"),
      });
      return { ok: "Solicitud de reinspección enviada al técnico." };
    }

    if (accion === "apoyo") {
      const solicitudId = leerNumero(datos, "solicitud_id");
      const tecnicoId = leerNumero(datos, "tecnico_id");
      if (solicitudId === null || tecnicoId === null) return { error: "Elige un técnico de apoyo." };
      await ejecucionRepository.asignarApoyo(solicitudId, tecnicoId);
      return { ok: "Técnico de apoyo asignado." };
    }

    if (accion === "resultado") {
      const solicitudId = leerNumero(datos, "solicitud_id");
      const resultado = leerTexto(datos, "resultado");
      const participantes = separarParticipantes(leerTexto(datos, "participantes"));
      const observaciones = leerTexto(datos, "observaciones");
      if (solicitudId === null) return { error: "Falta la solicitud. Recarga la página." };
      if (resultado !== "conforme" && resultado !== "no_conforme") {
        return { error: "Elige el resultado de la reinspección." };
      }
      const errorRegistro = validarRegistroReinspeccion(participantes, observaciones);
      if (errorRegistro) return { error: errorRegistro };
      await ejecucionRepository.registrarReinspeccion(solicitudId, {
        participantes,
        observaciones,
        resultado,
      });
      return { ok: "Resultado de la reinspección guardado." };
    }

    return { error: "Acción desconocida." };
  } catch (error) {
    if (error instanceof ReglaDeNegocioError || error instanceof RecursoNoEncontradoError) {
      return { error: error.message };
    }
    throw error;
  }
}

/** Props de `TarjetaSolicitud`. */
interface PropsTarjeta {
  /** Solicitud a mostrar. */
  solicitud: SolicitudReinspeccion;
  /** Técnicos entre los que se puede elegir el apoyo. */
  tecnicos: TecnicoResumen[];
  /** ¿El usuario puede pedir apoyo y registrar el resultado manual? */
  atiende: boolean;
}

/** Tarjeta de una solicitud con sus formularios (si sigue pendiente). */
function TarjetaSolicitud({ solicitud, tecnicos: todosLosTecnicos, atiende }: PropsTarjeta) {
  const enviando = useNavigation().state === "submitting";
  const pendiente = solicitud.estado === "pendiente";
  // Solo pueden apoyar los técnicos autorizados en la línea de la solicitud.
  const tecnicos = todosLosTecnicos.filter((t) => t.lineas.includes(solicitud.linea));
  return (
    <li className="item-card form-grid">
      <div className="item-row">
        <div>
          <p className="item-title">{solicitud.tarea}</p>
          <p className="item-meta">
            Pedida por {solicitud.operario} el {formatoFechaHora(solicitud.fecha_solicitud)} · Técnico asignado:{" "}
            {solicitud.tecnico_asignado}
            {solicitud.tecnico_apoyo && ` · Apoyo: ${solicitud.tecnico_apoyo}`}
          </p>
        </div>
        <InsigniaEstado texto={pendiente ? "Pendiente" : "Completada"} tono={pendiente ? "ambar" : "verde"} />
      </div>
      <p className="item-meta">Motivo: {solicitud.motivo}</p>

      {solicitud.reinspeccion && (
        <div className="item-sub">
          <p className="font-medium">
            Resultado: {NOMBRE_RESULTADO[solicitud.reinspeccion.resultado]} ·{" "}
            {formatoFechaHora(solicitud.reinspeccion.fecha)}
          </p>
          <p>Participantes: {solicitud.reinspeccion.participantes.join(", ")}</p>
          <p>{solicitud.reinspeccion.observaciones}</p>
        </div>
      )}

      {pendiente && atiende && (
        <div className="form-grid two">
          <Form method="post" className="form-grid">
            <input type="hidden" name="accion" value="apoyo" />
            <input type="hidden" name="solicitud_id" value={solicitud.id} />
            <label htmlFor={`apoyo-${solicitud.id}`} className={CLASE_ETIQUETA}>
              Pedir técnico de apoyo
            </label>
            <select id={`apoyo-${solicitud.id}`} name="tecnico_id" className={CLASE_CONTROL} defaultValue="">
              <option value="">Selecciona un técnico…</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre} · {t.especialidad}
                </option>
              ))}
            </select>
            <button type="submit" disabled={enviando} className={CLASE_BOTON}>
              Asignar apoyo
            </button>
          </Form>

          <Form method="post" className="form-grid">
            <input type="hidden" name="accion" value="resultado" />
            <input type="hidden" name="solicitud_id" value={solicitud.id} />
            <p className={CLASE_ETIQUETA}>Registrar reinspección manual</p>
            <input
              name="participantes"
              placeholder="Participantes (separados por comas)"
              aria-label={`Participantes de la reinspección de ${solicitud.tarea}`}
              className={CLASE_CONTROL}
            />
            <textarea
              name="observaciones"
              rows={2}
              placeholder="Observaciones"
              aria-label={`Observaciones de la reinspección de ${solicitud.tarea}`}
              className={CLASE_CONTROL}
            />
            <select
              name="resultado"
              defaultValue="conforme"
              aria-label={`Resultado de la reinspección de ${solicitud.tarea}`}
              className={CLASE_CONTROL}
            >
              <option value="conforme">Conforme</option>
              <option value="no_conforme">No conforme</option>
            </select>
            <button type="submit" disabled={enviando} className={CLASE_BOTON}>
              Guardar resultado
            </button>
          </Form>
        </div>
      )}
    </li>
  );
}

/** Página de reinspecciones. */
export default function Reinspecciones({ loaderData, actionData }: Route.ComponentProps) {
  const { intervenciones: todasLasIntervenciones, solicitudes: todasLasSolicitudes, tecnicos } = loaderData;
  const enviando = useNavigation().state === "submitting";

  // Alcance por rol: el operario ve lo suyo; el técnico, lo de sus líneas.
  const alcance = useAlcance();
  const intervenciones = todasLasIntervenciones.filter((i) => intervencionVisible(alcance, i));
  const solicitudes = todasLasSolicitudes.filter((s) => solicitudVisible(alcance, s));
  const solicita = puedeSolicitarReinspeccion(alcance);
  const atiende = puedeAtenderReinspeccion(alcance);

  return (
    <div className="space-y-6">
      <EncabezadoReporte
        titulo="Reinspecciones"
        descripcion="El operario solicita una reinspección virtual (con apoyo si lo necesita) y el técnico registra el resultado de la revisión manual."
      />

      {actionData && "ok" in actionData && <Mensaje tipo="info" titulo={actionData.ok} />}
      {actionData && "error" in actionData && (
        <Mensaje tipo="error" titulo="No se pudo completar la acción" texto={actionData.error} />
      )}

      {solicita && (
      <Seccion titulo="Solicitar reinspección" descripcion="Elige la intervención y explica por qué hace falta revisarla de nuevo.">
        {intervenciones.length === 0 ? (
          <Mensaje tipo="vacio" titulo="No hay datos" texto="Todavía no hay intervenciones registradas." />
        ) : (
          <Form method="post" className="form-grid two">
            <input type="hidden" name="accion" value="solicitar" />
            <div>
              <label htmlFor="intervencion_id" className={CLASE_ETIQUETA}>
                Intervención
              </label>
              <select id="intervencion_id" name="intervencion_id" defaultValue="" className={CLASE_CONTROL}>
                <option value="">Selecciona una intervención…</option>
                {intervenciones.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.tarea} · {i.operario} · {formatoFechaHora(i.fecha)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tecnico_apoyo_id" className={CLASE_ETIQUETA}>
                Técnico de apoyo (opcional)
              </label>
              <select id="tecnico_apoyo_id" name="tecnico_apoyo_id" defaultValue="" className={CLASE_CONTROL}>
                <option value="">Sin apoyo adicional</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} · {t.especialidad}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label htmlFor="motivo" className={CLASE_ETIQUETA}>
                Motivo
              </label>
              <textarea id="motivo" name="motivo" rows={2} className={CLASE_CONTROL} />
            </div>
            <div>
              <button type="submit" disabled={enviando} className={CLASE_BOTON}>
                Solicitar reinspección
              </button>
            </div>
          </Form>
        )}
      </Seccion>
      )}

      <Seccion titulo="Solicitudes" descripcion="Las pendientes aparecen primero.">
        {solicitudes.length === 0 ? (
          <Mensaje tipo="vacio" titulo="No hay datos" texto="No hay solicitudes de reinspección." />
        ) : (
          <ul className="item-list">
            {solicitudes.map((s) => (
              <TarjetaSolicitud key={s.id} solicitud={s} tecnicos={tecnicos} atiende={atiende} />
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  );
}
