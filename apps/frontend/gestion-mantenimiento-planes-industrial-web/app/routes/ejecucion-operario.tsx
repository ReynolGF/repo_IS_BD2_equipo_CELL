/**
 * Ejecución de planes (T17 y T18): el operario ve los planes que tiene
 * asignados con el estado actual de sus tareas y registra una intervención
 * sobre cada una.
 *
 * El operario elegido viaja en la dirección (`?operario=1`). Las
 * intervenciones se envían con `Form` (método POST) y las procesa `action`.
 */
import { Form, Navigate, useNavigation } from "react-router";
import { useAlcance } from "../auth/useAlcance";
import { BarraProgreso } from "../components/BarraProgreso";
import { CLASE_BOTON, CLASE_CONTROL, CLASE_ETIQUETA } from "../components/estilos";
import { InsigniaCriticidad } from "../components/InsigniaCriticidad";
import { InsigniaEstado, type TonoInsignia } from "../components/InsigniaEstado";
import { Mensaje } from "../components/Mensaje";
import { EncabezadoReporte, Seccion } from "../components/Seccion";
import { SelectorFormulario } from "../components/SelectorFormulario";
import {
  ejecucionRepository,
  RecursoNoEncontradoError,
  ReglaDeNegocioError,
} from "../repositories";
import type {
  EstadoTarea,
  Intervencion,
  OperarioResumen,
  PlanAsignado,
  ResultadoIntervencion,
} from "../types/operacion";
import { formatoFechaHora } from "../utils/formato";
import { intervencionVisible, operarioVisible, planVisible, puedeEjecutar } from "../utils/alcance";
import { leerEntero, leerNumero, leerTexto } from "../utils/formulario";
import { NOMBRE_ESTADO_PLAN, NOMBRE_ESTADO_TAREA, progresoDeTareas } from "../utils/progreso";
import { validarTextoObligatorio } from "../utils/validacion";
import type { Route } from "./+types/ejecucion-operario";

/** Datos que el `loader` entrega a la página. */
export interface DatosEjecucion {
  /** Operarios para llenar el selector. */
  operarios: OperarioResumen[];
  /** Operario elegido, o `null` si aún no se eligió. */
  operarioId: number | null;
  /** Planes del operario elegido. */
  planes: PlanAsignado[];
  /** Intervenciones registradas por el operario elegido. */
  intervenciones: Intervencion[];
  /** Mensaje de error, o `null` si todo salió bien. */
  error: string | null;
}

/** Resultado de enviar el formulario de una intervención. */
export type ResultadoAccion = { ok: string } | { error: string };

/** Color de la etiqueta de cada estado de tarea. */
const TONO_TAREA: Record<EstadoTarea, TonoInsignia> = {
  pendiente: "gris",
  cumplida: "verde",
  incumplida: "rojo",
};

/** Título de la pestaña del navegador. */
export function meta(_: Route.MetaArgs) {
  return [{ title: "Ejecución de planes · Mantenimiento industrial" }];
}

/**
 * Obtiene los operarios y, si hay uno elegido, sus planes e intervenciones.
 * Un operario inexistente se devuelve como mensaje de error dentro de la página.
 */
export async function loader({ request }: Route.LoaderArgs): Promise<DatosEjecucion> {
  const parametro = new URL(request.url).searchParams.get("operario");
  const operarios = await ejecucionRepository.listarOperarios();
  if (!parametro) {
    return { operarios, operarioId: null, planes: [], intervenciones: [], error: null };
  }

  const operarioId = leerEntero(parametro);
  if (operarioId === null) {
    return { operarios, operarioId: null, planes: [], intervenciones: [], error: "Operario no encontrado" };
  }
  try {
    const planes = await ejecucionRepository.listarPlanesDeOperario(operarioId);
    const todas = await ejecucionRepository.listarIntervenciones();
    const intervenciones = todas.filter((i) => i.operario_id === operarioId);
    return { operarios, operarioId, planes, intervenciones, error: null };
  } catch (error) {
    if (error instanceof RecursoNoEncontradoError) {
      return { operarios, operarioId, planes: [], intervenciones: [], error: "Operario no encontrado" };
    }
    throw error;
  }
}

/**
 * Registra la intervención enviada por el formulario.
 * Valida primero en el navegador/servidor de la ruta y luego deja que el
 * repositorio aplique las reglas de negocio; ambos errores se devuelven como
 * mensaje para mostrarlo junto al formulario.
 */
export async function action({ request }: Route.ActionArgs): Promise<ResultadoAccion> {
  const datos = await request.formData();
  const planId = leerNumero(datos, "plan_id");
  const tareaId = leerNumero(datos, "tarea_id");
  const operarioId = leerNumero(datos, "operario_id");
  const resultado = leerTexto(datos, "resultado");
  const observaciones = leerTexto(datos, "observaciones");

  if (planId === null || tareaId === null || operarioId === null) {
    return { error: "Faltan datos de la tarea. Recarga la página e inténtalo de nuevo." };
  }
  if (resultado !== "cumplida" && resultado !== "incumplida") {
    return { error: "Elige el resultado de la intervención." };
  }
  const errorTexto = validarTextoObligatorio(observaciones, "El campo observaciones");
  if (errorTexto) return { error: errorTexto };

  try {
    await ejecucionRepository.registrarIntervencion({
      plan_id: planId,
      tarea_id: tareaId,
      operario_id: operarioId,
      resultado: resultado as ResultadoIntervencion,
      observaciones,
    });
    return { ok: "Intervención registrada." };
  } catch (error) {
    if (error instanceof ReglaDeNegocioError) return { error: error.message };
    throw error;
  }
}

/** Props del formulario de una tarea. */
interface PropsFormularioIntervencion {
  /** Plan al que pertenece la tarea. */
  planId: number;
  /** Tarea a intervenir. */
  tareaId: number;
  /** Operario que interviene. */
  operarioId: number;
  /** Texto de la tarea, usado en las etiquetas accesibles. */
  tarea: string;
}

/** Formulario desplegable para registrar la intervención de una tarea. */
function FormularioIntervencion({ planId, tareaId, operarioId, tarea }: PropsFormularioIntervencion) {
  const enviando = useNavigation().state === "submitting";
  return (
    <details className="mt-2">
      <summary>
        Registrar intervención
      </summary>
      <Form method="post" className="form-grid three-cols">
        <input type="hidden" name="plan_id" value={planId} />
        <input type="hidden" name="tarea_id" value={tareaId} />
        <input type="hidden" name="operario_id" value={operarioId} />
        <div>
          <label htmlFor={`resultado-${tareaId}`} className={CLASE_ETIQUETA}>
            Resultado
          </label>
          <select
            id={`resultado-${tareaId}`}
            name="resultado"
            defaultValue="cumplida"
            aria-label={`Resultado de ${tarea}`}
            className={CLASE_CONTROL}
          >
            <option value="cumplida">Cumplida</option>
            <option value="incumplida">Incumplida</option>
          </select>
        </div>
        <div>
          <label htmlFor={`observaciones-${tareaId}`} className={CLASE_ETIQUETA}>
            Observaciones
          </label>
          <textarea
            id={`observaciones-${tareaId}`}
            name="observaciones"
            rows={2}
            required
            aria-label={`Observaciones de ${tarea}`}
            className={CLASE_CONTROL}
          />
        </div>
        <button type="submit" disabled={enviando} className={CLASE_BOTON}>
          {enviando ? "Guardando…" : "Guardar"}
        </button>
      </Form>
    </details>
  );
}

/** Página de ejecución de planes del operario. */
export default function Ejecucion({ loaderData, actionData }: Route.ComponentProps) {
  const { operarios, operarioId, planes: todosLosPlanes, intervenciones: todas, error } = loaderData;
  const cargando = useNavigation().state === "loading";
  const alcance = useAlcance();

  // Alcance por rol: el operario solo se ve a sí mismo y el técnico, a los de sus líneas.
  const operariosVisibles = operarios.filter((o) => operarioVisible(alcance, o));
  const esOperario = alcance.rol === "Operario";
  const propio = esOperario ? operariosVisibles[0] : undefined;
  const sinAcceso = operarioId !== null && !operariosVisibles.some((o) => o.id === operarioId);
  const planes = todosLosPlanes.filter((p) => planVisible(alcance, p));
  const intervenciones = todas.filter((i) => intervencionVisible(alcance, i));
  const ejecuta = puedeEjecutar(alcance);

  // Un operario siempre trabaja con su propio perfil.
  if (propio && operarioId !== propio.id) {
    return <Navigate to={`?operario=${propio.id}`} replace />;
  }

  return (
    <div className="space-y-6">
      <EncabezadoReporte
        titulo="Ejecución de planes"
        descripcion="Consulta los planes que tienes asignados durante tu turno y registra el resultado de cada tarea."
      />

      {esOperario ? (
        <p className="text-muted">
          Sesión de operario: solo ves y registras tus propias tareas.
        </p>
      ) : (
        <SelectorFormulario
          etiqueta="Operario"
          nombre="operario"
          opciones={operariosVisibles.map((o) => ({ valor: o.id, etiqueta: `${o.nombre} · turno ${o.turno}` }))}
          valorActual={operarioId}
          textoVacio="Selecciona un operario…"
        />
      )}

      {alcance.rol === "Jefe de planta" && (
        <Mensaje tipo="info" titulo="Solo consulta" texto="El jefe de planta revisa la ejecución, pero no registra intervenciones." />
      )}

      {cargando && <p className="text-muted">Cargando…</p>}

      {actionData && "ok" in actionData && (
        <Mensaje tipo="info" titulo={actionData.ok} texto="El estado de la tarea ya está actualizado." />
      )}
      {actionData && "error" in actionData && (
        <Mensaje tipo="error" titulo="No se pudo registrar la intervención" texto={actionData.error} />
      )}

      {error && (
        <Mensaje tipo="error" titulo={error} texto="El operario solicitado no existe. Elige otro en el selector." />
      )}

      {sinAcceso && !error && (
        <Mensaje tipo="error" titulo="Sin acceso a este operario" texto="Tu rol no incluye a este operario. Elige otro en el selector." />
      )}

      {!error && !sinAcceso && operarioId === null && (
        <Mensaje tipo="info" titulo="Selecciona un operario" texto="Sus planes y tareas se mostrarán aquí." />
      )}

      {operarioId !== null && !error && !sinAcceso && planes.length === 0 && (
        <Mensaje tipo="vacio" titulo="No hay datos" texto="Este operario no tiene planes asignados." />
      )}

      {operarioId !== null &&
        !sinAcceso &&
        planes.map((plan) => {
          const propias = plan.tareas.filter((t) => t.operario_id === operarioId);
          const progreso = progresoDeTareas(propias);
          return (
            <Seccion
              key={plan.plan_id}
              titulo={`${plan.plan} · ${plan.linea}`}
              descripcion={`Plan ${NOMBRE_ESTADO_PLAN[plan.estado].toLowerCase()}. Tus tareas: ${progreso.total}.`}
            >
              <BarraProgreso etiqueta={`Avance de tus tareas en ${plan.plan} ${plan.linea}`} porcentaje={progreso.avance} />
              <ul className="space-y-3">
                {propias.map((tarea) => (
                  <li
                    key={tarea.tarea_id}
                    className="item-card"
                  >
                    <div className="item-row">
                      <div>
                        <p className="item-title">{tarea.tarea}</p>
                        <p className="item-meta">{tarea.sistema}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <InsigniaCriticidad criticidad={tarea.criticidad} />
                        <InsigniaEstado texto={NOMBRE_ESTADO_TAREA[tarea.estado]} tono={TONO_TAREA[tarea.estado]} />
                      </div>
                    </div>
                    {ejecuta && tarea.estado !== "cumplida" && (
                      <FormularioIntervencion
                        planId={plan.plan_id}
                        tareaId={tarea.tarea_id}
                        operarioId={operarioId}
                        tarea={tarea.tarea}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </Seccion>
          );
        })}

      {operarioId !== null && !error && !sinAcceso && intervenciones.length > 0 && (
        <Seccion titulo="Mis intervenciones" descripcion="Historial de lo que ya registraste, de lo más reciente a lo más antiguo.">
          <ul className="item-list">
            {intervenciones.map((i) => (
              <li key={i.id} className="item-card">
                <p className="item-title">
                  {i.tarea}{" "}
                  <InsigniaEstado
                    texto={NOMBRE_ESTADO_TAREA[i.resultado]}
                    tono={TONO_TAREA[i.resultado]}
                  />
                </p>
                <p className="item-meta">{formatoFechaHora(i.fecha)} · {i.observaciones}</p>
              </li>
            ))}
          </ul>
        </Seccion>
      )}
    </div>
  );
}
