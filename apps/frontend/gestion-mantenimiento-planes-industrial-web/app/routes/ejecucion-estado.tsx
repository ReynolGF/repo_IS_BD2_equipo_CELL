/**
 * Reporte de estado de ejecución (T19): avance y cumplimiento de las tareas
 * de un plan, con resumen numérico, gráfico por criticidad y tabla ordenable.
 *
 * El plan elegido viaja en la dirección (`?plan=1`).
 */
import { useMemo } from "react";
import { useNavigation } from "react-router";
import { useAlcance } from "../auth/useAlcance";
import { BarraProgreso } from "../components/BarraProgreso";
import { BotonExportarPDF } from "../components/BotonExportarPDF";
import { GraficoBarras } from "../components/GraficoBarras";
import { InsigniaCriticidad } from "../components/InsigniaCriticidad";
import { InsigniaEstado, type TonoInsignia } from "../components/InsigniaEstado";
import { Mensaje } from "../components/Mensaje";
import { EncabezadoReporte, Seccion } from "../components/Seccion";
import { SelectorFormulario } from "../components/SelectorFormulario";
import { TablaOrdenable } from "../components/TablaOrdenable";
import { TarjetaMetrica } from "../components/TarjetaMetrica";
import { useOrdenTabla } from "../hooks/useOrdenTabla";
import { ejecucionRepository, PlanNoEncontradoError } from "../repositories";
import type { EstadoTarea, PlanAsignado, TareaAsignada } from "../types/operacion";
import type { PlanResumen } from "../types/reporte";
import type { ColumnaTabla } from "../types/tabla";
import { NOMBRE_CRITICIDAD } from "../utils/criticidad";
import { lineaVisible, planVisible } from "../utils/alcance";
import { aSeccionPDF, exportarPDF } from "../utils/exportarPdf";
import { formatoPorcentaje } from "../utils/formato";
import { leerEntero } from "../utils/formulario";
import {
  NOMBRE_ESTADO_PLAN,
  NOMBRE_ESTADO_TAREA,
  progresoDePlan,
  tareasPorCriticidadYEstado,
} from "../utils/progreso";
import type { Route } from "./+types/ejecucion-estado";

/** Datos que el `loader` entrega a la página. */
export interface DatosEstadoEjecucion {
  /** Planes para llenar el selector. */
  planes: PlanResumen[];
  /** Plan elegido, o `null` si aún no se eligió. */
  planId: number | null;
  /** Plan con el estado de sus tareas, o `null` si no hay. */
  plan: PlanAsignado | null;
  /** Mensaje de error, o `null` si todo salió bien. */
  error: string | null;
}

/** Color de la etiqueta de cada estado de tarea. */
const TONO_TAREA: Record<EstadoTarea, TonoInsignia> = {
  pendiente: "gris",
  cumplida: "verde",
  incumplida: "rojo",
};

/** Series del gráfico: una barra por estado de tarea. */
const SERIES_ESTADO = [
  { clave: "cumplida", nombre: "Cumplidas", color: "#67a77b" },
  { clave: "incumplida", nombre: "Incumplidas", color: "#d17d68" },
  { clave: "pendiente", nombre: "Pendientes", color: "#c9d3cb" },
];

/** Título de la pestaña del navegador. */
export function meta(_: Route.MetaArgs) {
  return [{ title: "Estado de ejecución · Mantenimiento industrial" }];
}

/**
 * Obtiene los planes y, si hay uno elegido, su estado de ejecución.
 * Un plan inexistente se devuelve como mensaje de error dentro de la página.
 */
export async function loader({ request }: Route.LoaderArgs): Promise<DatosEstadoEjecucion> {
  const parametro = new URL(request.url).searchParams.get("plan");
  const planes = await ejecucionRepository.listarPlanesEnEjecucion();
  if (!parametro) {
    return { planes, planId: null, plan: null, error: null };
  }

  const planId = leerEntero(parametro);
  if (planId === null) {
    return { planes, planId: null, plan: null, error: "Plan no encontrado" };
  }
  try {
    const plan = await ejecucionRepository.obtenerEstadoPlan(planId);
    return { planes, planId, plan, error: null };
  } catch (error) {
    if (error instanceof PlanNoEncontradoError) {
      return { planes, planId, plan: null, error: error.message };
    }
    throw error;
  }
}

/** Columnas de la tabla de tareas del plan. */
const COLUMNAS_TAREAS: ColumnaTabla<TareaAsignada>[] = [
  { clave: "tarea", titulo: "Tarea", tipo: "texto", valor: (t) => t.tarea },
  { clave: "sistema", titulo: "Sistema", tipo: "texto", valor: (t) => t.sistema },
  {
    clave: "criticidad",
    titulo: "Criticidad",
    tipo: "criticidad",
    valor: (t) => t.criticidad,
    texto: (t) => NOMBRE_CRITICIDAD[t.criticidad],
    celda: (t) => <InsigniaCriticidad criticidad={t.criticidad} />,
  },
  { clave: "operario", titulo: "Operario", tipo: "texto", valor: (t) => t.operario },
  {
    clave: "estado",
    titulo: "Estado",
    tipo: "texto",
    valor: (t) => NOMBRE_ESTADO_TAREA[t.estado],
    celda: (t) => <InsigniaEstado texto={NOMBRE_ESTADO_TAREA[t.estado]} tono={TONO_TAREA[t.estado]} />,
  },
];

/** Página del reporte de estado de ejecución. */
export default function EjecucionEstado({ loaderData }: Route.ComponentProps) {
  const { planes: todosLosPlanes, planId, plan: planCargado, error } = loaderData;
  const cargando = useNavigation().state === "loading";

  // Alcance por rol: solo planes de sus líneas (el operario, solo donde tiene tareas).
  const alcance = useAlcance();
  const planes = todosLosPlanes.filter((p) => lineaVisible(alcance, p.linea));
  const plan = planCargado && planVisible(alcance, planCargado) ? planCargado : null;
  const sinAcceso = planCargado !== null && plan === null;

  const tareas = useMemo(() => plan?.tareas ?? [], [plan]);
  const progreso = useMemo(() => (plan ? progresoDePlan(plan) : null), [plan]);
  const datosGrafico = useMemo(() => tareasPorCriticidadYEstado(tareas), [tareas]);
  const tabla = useOrdenTabla(tareas, COLUMNAS_TAREAS, { clave: "estado", direccion: "asc" });

  /** Genera el PDF con el resumen y la tabla en el orden que ve el usuario. */
  async function exportar() {
    if (!plan || !progreso) return;
    const resumen: ColumnaTabla<{ dato: string; valor: string }>[] = [
      { clave: "dato", titulo: "Indicador", tipo: "texto", valor: (f) => f.dato },
      { clave: "valor", titulo: "Valor", tipo: "texto", valor: (f) => f.valor },
    ];
    await exportarPDF({
      titulo: "Estado de ejecución de un plan",
      subtitulo: `${plan.plan} · Línea ${plan.linea} · ${NOMBRE_ESTADO_PLAN[plan.estado]}`,
      nombreArchivo: `estado-ejecucion-plan-${plan.plan_id}`,
      secciones: [
        aSeccionPDF("Resumen del avance", resumen, [
          { dato: "Tareas del plan", valor: String(progreso.total) },
          { dato: "Cumplidas", valor: String(progreso.cumplidas) },
          { dato: "Incumplidas", valor: String(progreso.incumplidas) },
          { dato: "Pendientes", valor: String(progreso.pendientes) },
          { dato: "Avance", valor: formatoPorcentaje(progreso.avance) },
          { dato: "Cumplimiento", valor: formatoPorcentaje(progreso.cumplimiento) },
        ]),
        aSeccionPDF("Tareas del plan", COLUMNAS_TAREAS, tabla.filasOrdenadas),
      ],
    });
  }

  return (
    <div className="space-y-6">
      <EncabezadoReporte
        titulo="Estado de ejecución"
        descripcion="Avance y cumplimiento de las tareas de un plan durante su ejecución."
      />

      <div className="item-row">
        <SelectorFormulario
          etiqueta="Plan de mantenimiento"
          nombre="plan"
          opciones={planes.map((p) => ({ valor: p.id, etiqueta: `${p.nombre} · ${p.linea}` }))}
          valorActual={planId}
          textoVacio="Selecciona un plan…"
        />
        <BotonExportarPDF onExportar={exportar} deshabilitado={tareas.length === 0} />
      </div>

      {cargando && <p className="text-muted">Cargando…</p>}

      {error && (
        <Mensaje tipo="error" titulo={error} texto="El plan solicitado no existe. Elige otro en el selector." />
      )}

      {sinAcceso && !error && (
        <Mensaje tipo="error" titulo="Sin acceso a este plan" texto="El plan no pertenece a tus líneas o tareas. Elige otro en el selector." />
      )}

      {!error && !sinAcceso && planId === null && (
        <Mensaje tipo="info" titulo="Selecciona un plan" texto="El estado se mostrará aquí al elegirlo." />
      )}

      {plan && tareas.length === 0 && (
        <Mensaje tipo="vacio" titulo="No hay datos" texto="Este plan todavía no tiene tareas asignadas." />
      )}

      {plan && progreso && tareas.length > 0 && (
        <>
          <Seccion
            titulo="Resumen del avance"
            descripcion={`${plan.plan} · ${plan.linea} · ${NOMBRE_ESTADO_PLAN[plan.estado]}`}
          >
            <BarraProgreso etiqueta="Avance del plan" porcentaje={progreso.avance} />
            <div className="metric-cards">
              <TarjetaMetrica titulo="Cumplidas" valor={String(progreso.cumplidas)} detalle={`de ${progreso.total} tareas`} />
              <TarjetaMetrica titulo="Incumplidas" valor={String(progreso.incumplidas)} />
              <TarjetaMetrica titulo="Pendientes" valor={String(progreso.pendientes)} />
              <TarjetaMetrica
                titulo="Cumplimiento"
                valor={formatoPorcentaje(progreso.cumplimiento)}
                detalle="sobre las tareas ya intervenidas"
              />
            </div>
          </Seccion>

          <Seccion titulo="Tareas por criticidad" descripcion="Cada color es un estado de tarea.">
            <GraficoBarras
              descripcion="Gráfico de tareas por criticidad y estado"
              datos={datosGrafico}
              claveEtiqueta="etiqueta"
              series={SERIES_ESTADO}
            />
          </Seccion>

          <Seccion titulo="Tareas del plan" descripcion="Pulsa el encabezado de una columna para ordenar.">
            <TablaOrdenable
              descripcion="Tareas del plan con su estado"
              columnas={COLUMNAS_TAREAS}
              filas={tabla.filasOrdenadas}
              claveFila={(t) => t.tarea_id}
              orden={tabla.orden}
              onOrdenar={tabla.alternar}
            />
          </Seccion>
        </>
      )}
    </div>
  );
}
