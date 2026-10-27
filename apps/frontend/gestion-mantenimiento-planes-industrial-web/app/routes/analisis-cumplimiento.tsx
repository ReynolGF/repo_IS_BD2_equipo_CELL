/**
 * Funcionalidad 6: análisis de cumplimiento. Reúne tres resultados:
 * 1. Correlación entre criticidad y rendimiento promedio, por línea.
 * 2. Las 10 tareas con mayor tasa de incumplimiento, con su técnico y línea.
 * 3. Operarios que pidieron reinspección frente al promedio de su turno.
 */
import { useMemo } from "react";
import { useNavigation } from "react-router";
import { useAlcance } from "../auth/useAlcance";
import { BotonExportarPDF } from "../components/BotonExportarPDF";
import { GraficoBarras } from "../components/GraficoBarras";
import { InsigniaCriticidad } from "../components/InsigniaCriticidad";
import { Mensaje } from "../components/Mensaje";
import { EncabezadoReporte, Seccion } from "../components/Seccion";
import { TablaOrdenable } from "../components/TablaOrdenable";
import { useOrdenTabla } from "../hooks/useOrdenTabla";
import { reporteRepository } from "../repositories";
import type {
  ComparacionReinspeccion,
  CorrelacionLinea,
  Criticidad,
  ReporteAnalisisCumplimiento,
  TareaIncumplida,
} from "../types/reporte";
import type { ColumnaTabla } from "../types/tabla";
import { filtrarPorLinea } from "../utils/alcance";
import { rendimientoPorLinea } from "../utils/agrupar";
import { interpretarCorrelacion } from "../utils/correlacion";
import { NOMBRE_CRITICIDAD, SERIES_CRITICIDAD } from "../utils/criticidad";
import { aSeccionPDF, exportarPDF } from "../utils/exportarPdf";
import { formatoDiferencia, formatoPorcentaje } from "../utils/formato";
import type { Route } from "./+types/analisis-cumplimiento";

/** Fila de la tabla de rendimiento: una línea y una criticidad. */
interface FilaRendimiento {
  /** Nombre de la línea. */
  linea: string;
  /** Criticidad de las tareas. */
  criticidad: Criticidad;
  /** Rendimiento promedio de los operarios, en porcentaje. */
  rendimiento: number;
}

/** Fila de la tabla de las 10 tareas más incumplidas, con su posición. */
type FilaIncumplida = TareaIncumplida & { posicion: number };

/** Título de la pestaña del navegador. */
export function meta(_: Route.MetaArgs) {
  return [{ title: "Análisis de cumplimiento · Mantenimiento industrial" }];
}

/** Obtiene el análisis de cumplimiento completo. */
export async function loader(): Promise<ReporteAnalisisCumplimiento> {
  return reporteRepository.obtenerAnalisisCumplimiento();
}

/** Columnas del rendimiento por línea y criticidad. */
const COLUMNAS_RENDIMIENTO: ColumnaTabla<FilaRendimiento>[] = [
  { clave: "linea", titulo: "Línea", tipo: "texto", valor: (f) => f.linea },
  {
    clave: "criticidad",
    titulo: "Criticidad",
    tipo: "criticidad",
    valor: (f) => f.criticidad,
    texto: (f) => NOMBRE_CRITICIDAD[f.criticidad],
    celda: (f) => <InsigniaCriticidad criticidad={f.criticidad} />,
  },
  {
    clave: "rendimiento",
    titulo: "Rendimiento promedio",
    tipo: "numero",
    valor: (f) => f.rendimiento,
    texto: (f) => formatoPorcentaje(f.rendimiento),
    alineacion: "derecha",
  },
];

/** Columnas de la correlación por línea. */
const COLUMNAS_CORRELACION: ColumnaTabla<CorrelacionLinea>[] = [
  { clave: "linea", titulo: "Línea", tipo: "texto", valor: (c) => c.linea },
  {
    clave: "coeficiente",
    titulo: "Coeficiente de correlación",
    tipo: "numero",
    valor: (c) => c.coeficiente_correlacion,
    texto: (c) => c.coeficiente_correlacion.toFixed(2),
    alineacion: "derecha",
  },
  {
    clave: "lectura",
    titulo: "Interpretación",
    tipo: "texto",
    valor: (c) => interpretarCorrelacion(c.coeficiente_correlacion),
  },
];

/** Columnas de las 10 tareas con mayor incumplimiento. */
const COLUMNAS_INCUMPLIDAS: ColumnaTabla<FilaIncumplida>[] = [
  {
    clave: "posicion",
    titulo: "#",
    tipo: "numero",
    valor: (f) => f.posicion,
    alineacion: "derecha",
  },
  { clave: "tarea", titulo: "Tarea", tipo: "texto", valor: (f) => f.tarea },
  {
    clave: "criticidad",
    titulo: "Criticidad",
    tipo: "criticidad",
    valor: (f) => f.criticidad,
    texto: (f) => NOMBRE_CRITICIDAD[f.criticidad],
    celda: (f) => <InsigniaCriticidad criticidad={f.criticidad} />,
  },
  { clave: "tecnico", titulo: "Técnico creador", tipo: "texto", valor: (f) => f.tecnico_creador },
  { clave: "linea", titulo: "Línea", tipo: "texto", valor: (f) => f.linea },
  {
    clave: "incumplimiento",
    titulo: "Tasa de incumplimiento",
    tipo: "numero",
    valor: (f) => f.tasa_incumplimiento,
    texto: (f) => formatoPorcentaje(f.tasa_incumplimiento),
    alineacion: "derecha",
  },
];

/** Columnas de la comparación de operarios que pidieron reinspección. */
const COLUMNAS_REINSPECCION: ColumnaTabla<ComparacionReinspeccion>[] = [
  { clave: "operario", titulo: "Operario", tipo: "texto", valor: (f) => f.operario },
  { clave: "turno", titulo: "Turno", tipo: "texto", valor: (f) => f.turno },
  { clave: "linea", titulo: "Línea", tipo: "texto", valor: (f) => f.linea },
  {
    clave: "operarioTasa",
    titulo: "Cumplimiento del operario",
    tipo: "numero",
    valor: (f) => f.tasa_operario,
    texto: (f) => formatoPorcentaje(f.tasa_operario),
    alineacion: "derecha",
  },
  {
    clave: "turnoTasa",
    titulo: "Promedio del turno",
    tipo: "numero",
    valor: (f) => f.tasa_promedio_turno,
    texto: (f) => formatoPorcentaje(f.tasa_promedio_turno),
    alineacion: "derecha",
  },
  {
    clave: "diferencia",
    titulo: "Diferencia",
    tipo: "numero",
    valor: (f) => f.diferencia,
    texto: (f) => formatoDiferencia(f.diferencia),
    celda: (f) => (
      <span
        className={
          f.diferencia < 0
            ? "font-medium text-red-700"
            : "font-medium text-green-700"
        }
      >
        {formatoDiferencia(f.diferencia)}
      </span>
    ),
    alineacion: "derecha",
  },
];

/** Series del gráfico de reinspecciones: operario frente a su turno. */
const SERIES_REINSPECCION = [
  { clave: "operario", nombre: "Operario", color: "#67a77b" },
  { clave: "turno", nombre: "Promedio del turno", color: "#c9d3cb" },
] as const;

/** Página del análisis de cumplimiento. */
export default function AnalisisCumplimiento({ loaderData }: Route.ComponentProps) {
  const cargando = useNavigation().state === "loading";

  // Alcance por rol: el técnico y el operario solo ven los datos de sus líneas.
  const alcance = useAlcance();
  const reporte = useMemo<ReporteAnalisisCumplimiento>(
    () => ({
      correlacion_por_linea: filtrarPorLinea(alcance, loaderData.correlacion_por_linea, (c) => c.linea),
      tareas_mayor_incumplimiento: filtrarPorLinea(alcance, loaderData.tareas_mayor_incumplimiento, (t) => t.linea),
      reinspecciones: filtrarPorLinea(alcance, loaderData.reinspecciones, (r) => r.linea),
    }),
    // `alcance` se recrea en cada render; sus datos son el rol y las líneas.
    [loaderData, alcance.rol, alcance.lineas.join("|")],
  );

  const filasRendimiento = useMemo<FilaRendimiento[]>(
    () =>
      reporte.correlacion_por_linea.flatMap((c) =>
        c.rendimiento.map((r) => ({
          linea: c.linea,
          criticidad: r.criticidad,
          rendimiento: r.rendimiento_promedio,
        })),
      ),
    [reporte],
  );
  const filasIncumplidas = useMemo<FilaIncumplida[]>(
    () =>
      reporte.tareas_mayor_incumplimiento.map((t, i) => ({ ...t, posicion: i + 1 })),
    [reporte],
  );
  const datosRendimiento = useMemo(
    () => rendimientoPorLinea(reporte.correlacion_por_linea),
    [reporte],
  );
  const datosReinspeccion = useMemo(
    () =>
      reporte.reinspecciones.map((r) => ({
        etiqueta: `${r.operario} (${r.linea})`,
        operario: r.tasa_operario,
        turno: r.tasa_promedio_turno,
      })),
    [reporte],
  );

  const rendimiento = useOrdenTabla(filasRendimiento, COLUMNAS_RENDIMIENTO);
  const correlacion = useOrdenTabla(reporte.correlacion_por_linea, COLUMNAS_CORRELACION);
  const incumplidas = useOrdenTabla(filasIncumplidas, COLUMNAS_INCUMPLIDAS, {
    clave: "posicion",
    direccion: "asc",
  });
  const reinspecciones = useOrdenTabla(reporte.reinspecciones, COLUMNAS_REINSPECCION);

  const sinDatos =
    reporte.correlacion_por_linea.length === 0 &&
    reporte.tareas_mayor_incumplimiento.length === 0 &&
    reporte.reinspecciones.length === 0;

  /** Genera el PDF con las cuatro tablas en el orden que ve el usuario. */
  async function exportar() {
    await exportarPDF({
      titulo: "Análisis de cumplimiento",
      nombreArchivo: "analisis-cumplimiento",
      secciones: [
        aSeccionPDF("Rendimiento promedio por línea y criticidad", COLUMNAS_RENDIMIENTO, rendimiento.filasOrdenadas),
        aSeccionPDF("Correlación entre criticidad y rendimiento", COLUMNAS_CORRELACION, correlacion.filasOrdenadas),
        aSeccionPDF("Las 10 tareas con mayor incumplimiento", COLUMNAS_INCUMPLIDAS, incumplidas.filasOrdenadas),
        aSeccionPDF("Operarios con reinspección frente a su turno", COLUMNAS_REINSPECCION, reinspecciones.filasOrdenadas),
      ],
    });
  }

  return (
    <div className="space-y-8">
      <EncabezadoReporte
        titulo="Análisis de cumplimiento"
        descripcion="Relación entre la criticidad de las tareas y el rendimiento de los operarios, las tareas más incumplidas y el desempeño de quienes pidieron reinspección."
      />

      <div className="flex justify-end">
        <BotonExportarPDF onExportar={exportar} deshabilitado={sinDatos} />
      </div>

      {cargando && <p className="text-muted">Cargando…</p>}

      {sinDatos && (
        <Mensaje
          tipo="vacio"
          titulo="No hay datos"
          texto="Todavía no hay información suficiente para este análisis."
        />
      )}

      {reporte.correlacion_por_linea.length > 0 && (
        <Seccion
          titulo="Criticidad y rendimiento por línea"
          descripcion="Rendimiento promedio de los operarios según la criticidad de la tarea. El coeficiente va de -1 a 1: un valor negativo indica que el rendimiento baja al subir la criticidad."
        >
          <GraficoBarras
            descripcion="Gráfico de rendimiento promedio por línea y criticidad"
            datos={datosRendimiento}
            claveEtiqueta="etiqueta"
            series={SERIES_CRITICIDAD}
            unidad="%"
            maximoY={100}
          />
          <TablaOrdenable
            descripcion="Coeficiente de correlación entre criticidad y rendimiento por línea"
            columnas={COLUMNAS_CORRELACION}
            filas={correlacion.filasOrdenadas}
            claveFila={(c) => c.linea_id}
            orden={correlacion.orden}
            onOrdenar={correlacion.alternar}
          />
          <TablaOrdenable
            descripcion="Rendimiento promedio por línea y criticidad"
            columnas={COLUMNAS_RENDIMIENTO}
            filas={rendimiento.filasOrdenadas}
            claveFila={(f) => `${f.linea}-${f.criticidad}`}
            orden={rendimiento.orden}
            onOrdenar={rendimiento.alternar}
          />
        </Seccion>
      )}

      {reporte.tareas_mayor_incumplimiento.length > 0 && (
        <Seccion
          titulo="Las 10 tareas con mayor incumplimiento"
          descripcion="Tareas con el mayor porcentaje de ejecuciones incumplidas, con el técnico que las creó y su línea."
        >
          <TablaOrdenable
            descripcion="Las 10 tareas con mayor tasa de incumplimiento"
            columnas={COLUMNAS_INCUMPLIDAS}
            filas={incumplidas.filasOrdenadas}
            claveFila={(f) => f.tarea_id}
            orden={incumplidas.orden}
            onOrdenar={incumplidas.alternar}
          />
        </Seccion>
      )}

      {reporte.reinspecciones.length > 0 && (
        <Seccion
          titulo="Operarios que pidieron reinspección"
          descripcion="Su cumplimiento comparado con el promedio de su turno en la misma línea. Una diferencia negativa significa que rinden por debajo de su turno."
        >
          <GraficoBarras
            descripcion="Gráfico que compara el cumplimiento de cada operario con el promedio de su turno"
            datos={datosReinspeccion}
            claveEtiqueta="etiqueta"
            series={SERIES_REINSPECCION}
            unidad="%"
            maximoY={100}
          />
          <TablaOrdenable
            descripcion="Comparación de operarios con reinspección frente al promedio de su turno"
            columnas={COLUMNAS_REINSPECCION}
            filas={reinspecciones.filasOrdenadas}
            claveFila={(f) => `${f.operario_id}-${f.linea}`}
            orden={reinspecciones.orden}
            onOrdenar={reinspecciones.alternar}
          />
        </Seccion>
      )}
    </div>
  );
}
