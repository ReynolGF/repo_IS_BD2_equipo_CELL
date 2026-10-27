/**
 * Funcionalidad 4: desempeño de los operarios en un plan, clasificando las
 * tareas por criticidad y comparando las tasas de cumplimiento.
 *
 * El plan elegido viaja en la dirección (`?plan=1`).
 */
import { useMemo } from "react";
import { useNavigation } from "react-router";
import { useAlcance } from "../auth/useAlcance";
import { BotonExportarPDF } from "../components/BotonExportarPDF";
import { GraficoBarras } from "../components/GraficoBarras";
import { InsigniaCriticidad } from "../components/InsigniaCriticidad";
import { Mensaje } from "../components/Mensaje";
import { EncabezadoReporte, Seccion } from "../components/Seccion";
import { SelectorFormulario } from "../components/SelectorFormulario";
import { TablaOrdenable } from "../components/TablaOrdenable";
import { useOrdenTabla } from "../hooks/useOrdenTabla";
import { PlanNoEncontradoError, reporteRepository } from "../repositories";
import type {
  FilaDesempeno,
  PlanResumen,
  ReporteDesempenoOperarios,
} from "../types/reporte";
import type { ColumnaTabla } from "../types/tabla";
import {
  resumenPorCriticidad,
  tasasPorOperario,
  type ResumenCriticidad,
} from "../utils/agrupar";
import { NOMBRE_CRITICIDAD, SERIES_CRITICIDAD } from "../utils/criticidad";
import { lineaVisible } from "../utils/alcance";
import { aSeccionPDF, exportarPDF } from "../utils/exportarPdf";
import { formatoPorcentaje } from "../utils/formato";
import type { Route } from "./+types/desempeno-operarios";

/** Datos que el `loader` entrega a la página. */
interface DatosPagina {
  /** Planes para llenar el selector. */
  planes: PlanResumen[];
  /** Plan elegido, o `null` si aún no se eligió. */
  planId: number | null;
  /** Reporte del plan elegido, o `null` si no hay. */
  reporte: ReporteDesempenoOperarios | null;
  /** Mensaje de error, o `null` si todo salió bien. */
  error: string | null;
}

/** Título de la pestaña del navegador. */
export function meta(_: Route.MetaArgs) {
  return [{ title: "Desempeño de operarios · Mantenimiento industrial" }];
}

/**
 * Obtiene los planes y, si hay uno elegido, su reporte de desempeño.
 * Un plan inexistente se devuelve como mensaje de error dentro de la página.
 */
export async function loader({ request }: Route.LoaderArgs): Promise<DatosPagina> {
  const parametro = new URL(request.url).searchParams.get("plan");
  const planes = await reporteRepository.listarPlanes();
  if (!parametro) {
    return { planes, planId: null, reporte: null, error: null };
  }

  const planId = Number(parametro);
  if (!Number.isInteger(planId)) {
    return { planes, planId: null, reporte: null, error: "Plan no encontrado" };
  }
  try {
    const reporte = await reporteRepository.obtenerDesempenoOperarios(planId);
    return { planes, planId, reporte, error: null };
  } catch (error) {
    if (error instanceof PlanNoEncontradoError) {
      return { planes, planId, reporte: null, error: error.message };
    }
    throw error;
  }
}

/** Columnas de la tabla de detalle por operario y criticidad. */
const COLUMNAS_DETALLE: ColumnaTabla<FilaDesempeno>[] = [
  { clave: "operario", titulo: "Operario", tipo: "texto", valor: (f) => f.operario },
  { clave: "turno", titulo: "Turno", tipo: "texto", valor: (f) => f.turno },
  {
    clave: "criticidad",
    titulo: "Criticidad",
    tipo: "criticidad",
    valor: (f) => f.criticidad,
    texto: (f) => NOMBRE_CRITICIDAD[f.criticidad],
    celda: (f) => <InsigniaCriticidad criticidad={f.criticidad} />,
  },
  {
    clave: "asignadas",
    titulo: "Asignadas",
    tipo: "numero",
    valor: (f) => f.tareas_asignadas,
    alineacion: "derecha",
  },
  {
    clave: "cumplidas",
    titulo: "Cumplidas",
    tipo: "numero",
    valor: (f) => f.tareas_cumplidas,
    alineacion: "derecha",
  },
  {
    clave: "tasa",
    titulo: "Tasa de cumplimiento",
    tipo: "numero",
    valor: (f) => f.tasa_cumplimiento,
    texto: (f) => formatoPorcentaje(f.tasa_cumplimiento),
    alineacion: "derecha",
  },
];

/** Columnas de la tabla resumen por criticidad. */
const COLUMNAS_RESUMEN: ColumnaTabla<ResumenCriticidad>[] = [
  {
    clave: "criticidad",
    titulo: "Criticidad",
    tipo: "criticidad",
    valor: (r) => r.criticidad,
    texto: (r) => NOMBRE_CRITICIDAD[r.criticidad],
    celda: (r) => <InsigniaCriticidad criticidad={r.criticidad} />,
  },
  {
    clave: "asignadas",
    titulo: "Asignadas",
    tipo: "numero",
    valor: (r) => r.asignadas,
    alineacion: "derecha",
  },
  {
    clave: "cumplidas",
    titulo: "Cumplidas",
    tipo: "numero",
    valor: (r) => r.cumplidas,
    alineacion: "derecha",
  },
  {
    clave: "tasa",
    titulo: "Tasa global",
    tipo: "numero",
    valor: (r) => r.tasa,
    texto: (r) => formatoPorcentaje(r.tasa),
    alineacion: "derecha",
  },
];

/** Página del reporte de desempeño de operarios. */
export default function DesempenoOperarios({ loaderData }: Route.ComponentProps) {
  const { planes: todosLosPlanes, planId, reporte: reporteCargado, error } = loaderData;
  const cargando = useNavigation().state === "loading";

  // Alcance por rol: el técnico y el operario solo ven planes de sus líneas.
  const alcance = useAlcance();
  const planes = todosLosPlanes.filter((p) => lineaVisible(alcance, p.linea));
  const reporte =
    reporteCargado && lineaVisible(alcance, reporteCargado.plan.linea) ? reporteCargado : null;
  const sinAcceso = reporteCargado !== null && reporte === null;

  const filas = useMemo(() => reporte?.filas ?? [], [reporte]);
  const resumen = useMemo(() => resumenPorCriticidad(filas), [filas]);
  const datosGrafico = useMemo(() => tasasPorOperario(filas), [filas]);

  const detalle = useOrdenTabla(filas, COLUMNAS_DETALLE, {
    clave: "operario",
    direccion: "asc",
  });
  const porCriticidad = useOrdenTabla(resumen, COLUMNAS_RESUMEN, {
    clave: "criticidad",
    direccion: "desc",
  });

  /** Genera el PDF con ambas tablas en el orden que ve el usuario. */
  async function exportar() {
    if (!reporte) return;
    await exportarPDF({
      titulo: "Desempeño de operarios en un plan",
      subtitulo: `${reporte.plan.nombre} · Línea ${reporte.plan.linea}`,
      nombreArchivo: `desempeno-operarios-plan-${reporte.plan.id}`,
      secciones: [
        aSeccionPDF("Cumplimiento global por criticidad", COLUMNAS_RESUMEN, porCriticidad.filasOrdenadas),
        aSeccionPDF("Detalle por operario y criticidad", COLUMNAS_DETALLE, detalle.filasOrdenadas),
      ],
    });
  }

  return (
    <div className="space-y-6">
      <EncabezadoReporte
        titulo="Desempeño de operarios"
        descripcion="Cumplimiento de cada operario en un plan, con las tareas clasificadas por criticidad y sus tasas de cumplimiento comparadas."
      />

      <div className="item-row">
        <SelectorFormulario
          etiqueta="Plan de mantenimiento"
          nombre="plan"
          opciones={planes.map((p) => ({
            valor: p.id,
            etiqueta: `${p.nombre} · ${p.linea}`,
          }))}
          valorActual={planId}
          textoVacio="Selecciona un plan…"
        />
        <BotonExportarPDF onExportar={exportar} deshabilitado={filas.length === 0} />
      </div>

      {cargando && <p className="text-muted">Cargando…</p>}

      {error && (
        <Mensaje
          tipo="error"
          titulo={error}
          texto="El plan solicitado no existe. Elige otro en el selector."
        />
      )}

      {sinAcceso && !error && (
        <Mensaje tipo="error" titulo="Sin acceso a este plan" texto="El plan no pertenece a tus líneas. Elige otro en el selector." />
      )}

      {!error && !sinAcceso && planId === null && (
        <Mensaje
          tipo="info"
          titulo="Selecciona un plan"
          texto="El reporte se mostrará aquí al elegirlo."
        />
      )}

      {reporte && filas.length === 0 && (
        <Mensaje
          tipo="vacio"
          titulo="No hay datos"
          texto="Este plan todavía no tiene tareas asignadas a operarios."
        />
      )}

      {reporte && filas.length > 0 && (
        <>
          <Seccion
            titulo="Cumplimiento global por criticidad"
            descripcion="Compara la tasa de cumplimiento de todos los operarios según la criticidad de las tareas."
          >
            <TablaOrdenable
              descripcion="Resumen de cumplimiento por criticidad"
              columnas={COLUMNAS_RESUMEN}
              filas={porCriticidad.filasOrdenadas}
              claveFila={(r) => r.criticidad}
              orden={porCriticidad.orden}
              onOrdenar={porCriticidad.alternar}
            />
          </Seccion>

          <Seccion
            titulo="Tasa de cumplimiento por operario"
            descripcion="Barras agrupadas por operario; cada color es un nivel de criticidad."
          >
            <GraficoBarras
              descripcion="Gráfico de tasas de cumplimiento por operario y criticidad"
              datos={datosGrafico}
              claveEtiqueta="etiqueta"
              series={SERIES_CRITICIDAD}
              unidad="%"
              maximoY={100}
            />
          </Seccion>

          <Seccion
            titulo="Detalle por operario y criticidad"
            descripcion="Pulsa el encabezado de una columna para ordenar."
          >
            <TablaOrdenable
              descripcion="Detalle de cumplimiento por operario y criticidad"
              columnas={COLUMNAS_DETALLE}
              filas={detalle.filasOrdenadas}
              claveFila={(f) => `${f.operario_id}-${f.criticidad}`}
              orden={detalle.orden}
              onOrdenar={detalle.alternar}
            />
          </Seccion>
        </>
      )}
    </div>
  );
}
