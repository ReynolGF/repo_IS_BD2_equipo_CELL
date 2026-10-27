/**
 * Funcionalidad 2: tareas más ejecutadas en los planes finales (aprobados) de
 * una línea de producción, clasificadas por criticidad y sistema.
 *
 * La línea elegida viaja en la dirección (`?linea=1`); el `loader` obtiene los
 * datos antes de dibujar la página.
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
import { LineaNoEncontradaError, reporteRepository } from "../repositories";
import type {
  LineaProduccion,
  ReporteTareasMasEjecutadas,
  TareaEjecutada,
} from "../types/reporte";
import type { ColumnaTabla } from "../types/tabla";
import { lineaVisible } from "../utils/alcance";
import { ejecucionesPorSistema } from "../utils/agrupar";
import { NOMBRE_CRITICIDAD, SERIES_CRITICIDAD } from "../utils/criticidad";
import { aSeccionPDF, exportarPDF } from "../utils/exportarPdf";
import type { Route } from "./+types/tareas-mas-ejecutadas";

/** Datos que el `loader` entrega a la página. */
interface DatosPagina {
  /** Líneas para llenar el selector. */
  lineas: LineaProduccion[];
  /** Línea elegida, o `null` si aún no se eligió. */
  lineaId: number | null;
  /** Reporte de la línea elegida, o `null` si no hay. */
  reporte: ReporteTareasMasEjecutadas | null;
  /** Mensaje de error, o `null` si todo salió bien. */
  error: string | null;
}

/** Título de la pestaña del navegador. */
export function meta(_: Route.MetaArgs) {
  return [{ title: "Tareas más ejecutadas · Mantenimiento industrial" }];
}

/**
 * Obtiene las líneas y, si hay una elegida, su reporte.
 * Una línea inexistente se devuelve como mensaje de error, no como excepción,
 * para mostrarlo dentro de la página.
 */
export async function loader({ request }: Route.LoaderArgs): Promise<DatosPagina> {
  const parametro = new URL(request.url).searchParams.get("linea");
  const lineas = await reporteRepository.listarLineas();
  if (!parametro) {
    return { lineas, lineaId: null, reporte: null, error: null };
  }

  const lineaId = Number(parametro);
  if (!Number.isInteger(lineaId)) {
    return { lineas, lineaId: null, reporte: null, error: "Línea no encontrada" };
  }
  try {
    const reporte = await reporteRepository.obtenerTareasMasEjecutadas(lineaId);
    return { lineas, lineaId, reporte, error: null };
  } catch (error) {
    if (error instanceof LineaNoEncontradaError) {
      return { lineas, lineaId, reporte: null, error: error.message };
    }
    throw error;
  }
}

/** Columnas de la tabla del reporte. */
const COLUMNAS: ColumnaTabla<TareaEjecutada>[] = [
  { clave: "tarea", titulo: "Tarea", tipo: "texto", valor: (f) => f.tarea },
  { clave: "sistema", titulo: "Sistema", tipo: "texto", valor: (f) => f.sistema },
  {
    clave: "criticidad",
    titulo: "Criticidad",
    tipo: "criticidad",
    valor: (f) => f.criticidad,
    texto: (f) => NOMBRE_CRITICIDAD[f.criticidad],
    celda: (f) => <InsigniaCriticidad criticidad={f.criticidad} />,
  },
  {
    clave: "ejecuciones",
    titulo: "Veces ejecutada",
    tipo: "numero",
    valor: (f) => f.ejecuciones,
    alineacion: "derecha",
  },
];

/** Página del reporte de tareas más ejecutadas. */
export default function TareasMasEjecutadas({ loaderData }: Route.ComponentProps) {
  const { lineas: todasLasLineas, lineaId, reporte: reporteCargado, error } = loaderData;
  const cargando = useNavigation().state === "loading";

  // Alcance por rol: el técnico y el operario solo ven sus líneas.
  const alcance = useAlcance();
  const lineas = todasLasLineas.filter((l) => lineaVisible(alcance, l.nombre));
  const reporte =
    reporteCargado && lineaVisible(alcance, reporteCargado.linea.nombre) ? reporteCargado : null;
  const sinAcceso = reporteCargado !== null && reporte === null;

  const filas = useMemo(() => reporte?.tareas ?? [], [reporte]);
  const { orden, alternar, filasOrdenadas } = useOrdenTabla(filas, COLUMNAS, {
    clave: "ejecuciones",
    direccion: "desc",
  });
  const datosGrafico = useMemo(() => ejecucionesPorSistema(filas), [filas]);

  /** Genera el PDF con las filas en el orden que ve el usuario. */
  async function exportar() {
    if (!reporte) return;
    await exportarPDF({
      titulo: "Tareas más ejecutadas en planes aprobados",
      subtitulo: `Línea de producción: ${reporte.linea.nombre}`,
      nombreArchivo: `tareas-mas-ejecutadas-linea-${reporte.linea.id}`,
      secciones: [aSeccionPDF("Detalle por tarea", COLUMNAS, filasOrdenadas)],
    });
  }

  return (
    <div className="space-y-6">
      <EncabezadoReporte
        titulo="Tareas más ejecutadas"
        descripcion="Tareas con más ejecuciones registradas en los planes aprobados de una línea de producción, clasificadas por criticidad y sistema."
      />

      <div className="item-row">
        <SelectorFormulario
          etiqueta="Línea de producción"
          nombre="linea"
          opciones={lineas.map((l) => ({ valor: l.id, etiqueta: l.nombre }))}
          valorActual={lineaId}
          textoVacio="Selecciona una línea…"
        />
        <BotonExportarPDF onExportar={exportar} deshabilitado={filas.length === 0} />
      </div>

      {cargando && <p className="text-muted">Cargando…</p>}

      {error && (
        <Mensaje
          tipo="error"
          titulo={error}
          texto="La línea solicitada no existe. Elige otra en el selector."
        />
      )}

      {sinAcceso && !error && (
        <Mensaje tipo="error" titulo="Sin acceso a esta línea" texto="La línea no está entre las de tu rol. Elige otra en el selector." />
      )}

      {!error && !sinAcceso && lineaId === null && (
        <Mensaje
          tipo="info"
          titulo="Selecciona una línea de producción"
          texto="El reporte se mostrará aquí al elegirla."
        />
      )}

      {reporte && filas.length === 0 && (
        <Mensaje
          tipo="vacio"
          titulo="No hay datos"
          texto={`La línea ${reporte.linea.nombre} no tiene planes aprobados con ejecuciones registradas.`}
        />
      )}

      {reporte && filas.length > 0 && (
        <>
          <Seccion
            titulo={`Línea ${reporte.linea.nombre}`}
            descripcion="Pulsa el encabezado de una columna para ordenar."
          >
            <TablaOrdenable
              descripcion={`Tareas más ejecutadas de la línea ${reporte.linea.nombre}`}
              columnas={COLUMNAS}
              filas={filasOrdenadas}
              claveFila={(f) => f.tarea_id}
              orden={orden}
              onOrdenar={alternar}
            />
          </Seccion>

          <Seccion
            titulo="Ejecuciones por sistema y criticidad"
            descripcion="Suma de ejecuciones de cada sistema, separadas por nivel de criticidad."
          >
            <GraficoBarras
              descripcion="Gráfico de barras de ejecuciones por sistema y criticidad"
              datos={datosGrafico}
              claveEtiqueta="etiqueta"
              series={SERIES_CRITICIDAD}
            />
          </Seccion>
        </>
      )}
    </div>
  );
}
