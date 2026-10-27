/**
 * Comparación de la distribución de tareas entre líneas (T29): cuántas tareas
 * tiene cada línea por sistema y criticidad, e indicación de si cumple el
 * criterio de equilibrio.
 */
import { useMemo } from "react";
import { useAlcance } from "../auth/useAlcance";
import { BotonExportarPDF } from "../components/BotonExportarPDF";
import { GraficoBarras } from "../components/GraficoBarras";
import { InsigniaCriticidad } from "../components/InsigniaCriticidad";
import { InsigniaEstado } from "../components/InsigniaEstado";
import { Mensaje } from "../components/Mensaje";
import { EncabezadoReporte, Seccion } from "../components/Seccion";
import { TablaOrdenable } from "../components/TablaOrdenable";
import { TarjetaMetrica } from "../components/TarjetaMetrica";
import { useOrdenTabla } from "../hooks/useOrdenTabla";
import { reporteRepository } from "../repositories";
import type {
  EquilibrioLinea,
  FilaDistribucion,
  ReporteDistribucionLineas,
} from "../types/operacion";
import type { ColumnaTabla } from "../types/tabla";
import { NOMBRE_CRITICIDAD, SERIES_CRITICIDAD } from "../utils/criticidad";
import { filtrarPorLinea } from "../utils/alcance";
import { aSeccionPDF, exportarPDF } from "../utils/exportarPdf";
import { formatoPorcentaje } from "../utils/formato";
import { tareasPorLineaYCriticidad } from "../utils/progreso";
import type { Route } from "./+types/distribucion-lineas";

/** Título de la pestaña del navegador. */
export function meta(_: Route.MetaArgs) {
  return [{ title: "Distribución entre líneas · Mantenimiento industrial" }];
}

/** Obtiene la distribución de tareas y el resultado del criterio de equilibrio. */
export async function loader(): Promise<ReporteDistribucionLineas> {
  return reporteRepository.obtenerDistribucionLineas();
}

/** Columnas de la tabla de distribución. */
const COLUMNAS_DISTRIBUCION: ColumnaTabla<FilaDistribucion>[] = [
  { clave: "linea", titulo: "Línea", tipo: "texto", valor: (f) => f.linea },
  { clave: "sistema", titulo: "Sistema", tipo: "texto", valor: (f) => f.sistema },
  {
    clave: "criticidad",
    titulo: "Criticidad",
    tipo: "criticidad",
    valor: (f) => f.criticidad,
    texto: (f) => NOMBRE_CRITICIDAD[f.criticidad],
    celda: (f) => <InsigniaCriticidad criticidad={f.criticidad} />,
  },
  { clave: "tareas", titulo: "Tareas", tipo: "numero", valor: (f) => f.tareas, alineacion: "derecha" },
];

/** Columnas de la tabla del criterio de equilibrio. */
const COLUMNAS_EQUILIBRIO: ColumnaTabla<EquilibrioLinea>[] = [
  { clave: "linea", titulo: "Línea", tipo: "texto", valor: (e) => e.linea },
  {
    clave: "equilibrio",
    titulo: "Equilibrio",
    tipo: "numero",
    valor: (e) => e.porcentaje_equilibrio,
    texto: (e) => formatoPorcentaje(e.porcentaje_equilibrio),
    alineacion: "derecha",
  },
  {
    clave: "minimo",
    titulo: "Mínimo exigido",
    tipo: "numero",
    valor: (e) => e.minimo_requerido,
    texto: (e) => formatoPorcentaje(e.minimo_requerido),
    alineacion: "derecha",
  },
  {
    clave: "criterio",
    titulo: "Criterio",
    tipo: "texto",
    valor: (e) => (e.cumple_criterio ? "Cumple" : "No cumple"),
    celda: (e) => (
      <InsigniaEstado
        texto={e.cumple_criterio ? "Cumple" : "No cumple"}
        tono={e.cumple_criterio ? "verde" : "rojo"}
      />
    ),
  },
];

/** Página de la comparación de distribución entre líneas. */
export default function DistribucionLineas({ loaderData }: Route.ComponentProps) {
  // Alcance por rol: el técnico y el operario solo ven sus líneas.
  const alcance = useAlcance();
  const lineasClave = alcance.lineas.join("|");
  const filas = useMemo(
    () => filtrarPorLinea(alcance, loaderData.filas, (f) => f.linea),
    // `alcance` se recrea en cada render; sus datos son el rol y las líneas.
    [loaderData.filas, alcance.rol, lineasClave],
  );
  const equilibrio = useMemo(
    () => filtrarPorLinea(alcance, loaderData.equilibrio, (e) => e.linea),
    [loaderData.equilibrio, alcance.rol, lineasClave],
  );

  const datosGrafico = useMemo(() => tareasPorLineaYCriticidad(filas), [filas]);
  const incumplen = equilibrio.filter((e) => !e.cumple_criterio).length;
  const distribucion = useOrdenTabla(filas, COLUMNAS_DISTRIBUCION, { clave: "linea", direccion: "asc" });
  const criterio = useOrdenTabla(equilibrio, COLUMNAS_EQUILIBRIO, { clave: "equilibrio", direccion: "asc" });

  /** Genera el PDF con ambas tablas en el orden que ve el usuario. */
  async function exportar() {
    await exportarPDF({
      titulo: "Distribución de tareas entre líneas",
      subtitulo: `${equilibrio.length} líneas · ${incumplen} sin cumplir el criterio de equilibrio`,
      nombreArchivo: "distribucion-lineas",
      secciones: [
        aSeccionPDF("Criterio de equilibrio por línea", COLUMNAS_EQUILIBRIO, criterio.filasOrdenadas),
        aSeccionPDF("Tareas por línea, sistema y criticidad", COLUMNAS_DISTRIBUCION, distribucion.filasOrdenadas),
      ],
    });
  }

  return (
    <div className="space-y-6">
      <EncabezadoReporte
        titulo="Distribución entre líneas"
        descripcion="Compara cómo se reparten las tareas por sistema y criticidad en cada línea e indica si cumple el criterio de equilibrio."
      />

      <div className="flex justify-end">
        <BotonExportarPDF onExportar={exportar} deshabilitado={filas.length === 0} />
      </div>

      {filas.length === 0 && (
        <Mensaje tipo="vacio" titulo="No hay datos" texto="Todavía no hay tareas distribuidas en las líneas." />
      )}

      {filas.length > 0 && (
        <>
          <Seccion
            titulo="Criterio de equilibrio"
            descripcion={
              incumplen === 0
                ? "Todas las líneas cumplen el criterio."
                : `${incumplen} de ${equilibrio.length} líneas no cumplen el criterio.`
            }
          >
            <div className="metric-cards">
              {equilibrio.map((e) => (
                <TarjetaMetrica
                  key={e.linea_id}
                  titulo={e.linea}
                  valor={formatoPorcentaje(e.porcentaje_equilibrio)}
                  detalle={`${e.cumple_criterio ? "Cumple" : "No cumple"} (mínimo ${formatoPorcentaje(e.minimo_requerido)})`}
                />
              ))}
            </div>
            <TablaOrdenable
              descripcion="Resultado del criterio de equilibrio por línea"
              columnas={COLUMNAS_EQUILIBRIO}
              filas={criterio.filasOrdenadas}
              claveFila={(e) => e.linea_id}
              orden={criterio.orden}
              onOrdenar={criterio.alternar}
            />
          </Seccion>

          <Seccion titulo="Tareas por línea y criticidad" descripcion="Barras agrupadas por línea; cada color es un nivel de criticidad.">
            <GraficoBarras
              descripcion="Gráfico de tareas por línea y criticidad"
              datos={datosGrafico}
              claveEtiqueta="etiqueta"
              series={SERIES_CRITICIDAD}
            />
          </Seccion>

          <Seccion titulo="Detalle por sistema" descripcion="Pulsa el encabezado de una columna para ordenar.">
            <TablaOrdenable
              descripcion="Tareas por línea, sistema y criticidad"
              columnas={COLUMNAS_DISTRIBUCION}
              filas={distribucion.filasOrdenadas}
              claveFila={(f) => `${f.linea_id}-${f.sistema}-${f.criticidad}`}
              orden={distribucion.orden}
              onOrdenar={distribucion.alternar}
            />
          </Seccion>
        </>
      )}
    </div>
  );
}
