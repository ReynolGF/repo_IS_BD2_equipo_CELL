/**
 * Análisis de sensores (T23): valores agregados de temperatura, vibración y
 * presión por equipo, línea y periodo, para anticipar fallos.
 *
 * Los filtros viajan en la dirección (`?linea=1&equipo=2&periodo=7d`). El
 * navegador nunca recibe el histórico completo, solo mínimo, promedio y
 * máximo calculados por el backend.
 */
import { useMemo } from "react";
import { Form, useNavigation, useSubmit } from "react-router";
import { useAlcance } from "../auth/useAlcance";
import { BotonExportarPDF } from "../components/BotonExportarPDF";
import { CLASE_CONTROL, CLASE_ETIQUETA } from "../components/estilos";
import { GraficoBarras } from "../components/GraficoBarras";
import { Mensaje } from "../components/Mensaje";
import { EncabezadoReporte, Seccion } from "../components/Seccion";
import { TablaOrdenable } from "../components/TablaOrdenable";
import { useOrdenTabla } from "../hooks/useOrdenTabla";
import { reporteRepository, sensorRepository } from "../repositories";
import type {
  AgregadoSensor,
  AnalisisSensores,
  EquipoResumen,
  FiltroSensores,
  TipoSensor,
} from "../types/operacion";
import type { LineaProduccion } from "../types/reporte";
import type { ColumnaTabla } from "../types/tabla";
import { lineaVisible } from "../utils/alcance";
import { aSeccionPDF, exportarPDF } from "../utils/exportarPdf";
import {
  formatoLectura,
  leerFiltroSensores,
  NOMBRE_SENSOR,
  PERIODOS,
} from "../utils/sensores";
import type { Route } from "./+types/sensores-analisis";

/** Datos que el `loader` entrega a la página. */
export interface DatosAnalisisSensores {
  /** Líneas para llenar el selector. */
  lineas: LineaProduccion[];
  /** Equipos con sensores (todos; la página filtra según la línea). */
  equipos: EquipoResumen[];
  /** Filtros aplicados. */
  filtro: FiltroSensores;
  /** Análisis resultante, o `null` si hubo un error. */
  analisis: AnalisisSensores | null;
  /** Mensaje de error, o `null` si todo salió bien. */
  error: string | null;
}

/** Series del gráfico: mínimo, promedio y máximo del periodo. */
const SERIES_AGREGADO = [
  { clave: "minimo", nombre: "Mínimo", color: "#b9d9c4" },
  { clave: "promedio", nombre: "Promedio", color: "#67a77b" },
  { clave: "maximo", nombre: "Máximo", color: "#d17d68" },
];

/** Título de la pestaña del navegador. */
export function meta(_: Route.MetaArgs) {
  return [{ title: "Análisis de sensores · Mantenimiento industrial" }];
}

/**
 * Lee los filtros de la dirección y obtiene el análisis correspondiente.
 * Un equipo inexistente se devuelve como mensaje de error dentro de la página.
 */
export async function loader({ request }: Route.LoaderArgs): Promise<DatosAnalisisSensores> {
  let filtro = leerFiltroSensores(new URL(request.url).searchParams);
  const [lineas, equipos] = await Promise.all([
    reporteRepository.listarLineas(),
    sensorRepository.listarEquipos(),
  ]);
  const equipo = equipos.find((e) => e.id === filtro.equipoId);
  if (filtro.equipoId !== null && !equipo) {
    return { lineas, equipos, filtro, analisis: null, error: "Equipo no encontrado" };
  }
  // Al cambiar de línea, un equipo de otra línea ya no aplica: se descarta.
  if (equipo && filtro.lineaId !== null && equipo.linea_id !== filtro.lineaId) {
    filtro = { ...filtro, equipoId: null };
  }
  const analisis = await sensorRepository.obtenerAnalisis(filtro);
  return { lineas, equipos, filtro, analisis, error: null };
}

/** Columnas de la tabla de valores agregados. */
const COLUMNAS: ColumnaTabla<AgregadoSensor>[] = [
  { clave: "equipo", titulo: "Equipo", tipo: "texto", valor: (a) => a.equipo },
  { clave: "linea", titulo: "Línea", tipo: "texto", valor: (a) => a.linea },
  {
    clave: "sensor",
    titulo: "Sensor",
    tipo: "texto",
    valor: (a) => NOMBRE_SENSOR[a.tipo_sensor],
  },
  {
    clave: "minimo",
    titulo: "Mínimo",
    tipo: "numero",
    valor: (a) => a.minimo,
    texto: (a) => formatoLectura(a.minimo, a.unidad),
    alineacion: "derecha",
  },
  {
    clave: "promedio",
    titulo: "Promedio",
    tipo: "numero",
    valor: (a) => a.promedio,
    texto: (a) => formatoLectura(a.promedio, a.unidad),
    alineacion: "derecha",
  },
  {
    clave: "maximo",
    titulo: "Máximo",
    tipo: "numero",
    valor: (a) => a.maximo,
    texto: (a) => formatoLectura(a.maximo, a.unidad),
    alineacion: "derecha",
  },
  {
    clave: "lecturas",
    titulo: "Lecturas",
    tipo: "numero",
    valor: (a) => a.lecturas,
    texto: (a) => a.lecturas.toLocaleString("es"),
    alineacion: "derecha",
  },
];

/** Página del análisis de sensores. */
export default function SensoresAnalisis({ loaderData }: Route.ComponentProps) {
  const { lineas: todasLasLineas, equipos: todosLosEquipos, filtro, analisis, error } = loaderData;
  const cargando = useNavigation().state === "loading";
  const enviar = useSubmit();

  // Alcance por rol: el técnico solo ve los equipos de sus líneas.
  const alcance = useAlcance();
  const lineas = todasLasLineas.filter((l) => lineaVisible(alcance, l.nombre));
  const equipos = todosLosEquipos.filter((e) => lineaVisible(alcance, e.linea));
  const sinAcceso = filtro.lineaId !== null && !lineas.some((l) => l.id === filtro.lineaId);

  const agregados = useMemo(
    () => (sinAcceso ? [] : (analisis?.agregados ?? []).filter((a) => lineaVisible(alcance, a.linea))),
    // `alcance` se recrea en cada render; sus datos son el rol y las líneas.
    [analisis, sinAcceso, alcance.rol, alcance.lineas.join("|")],
  );
  const tabla = useOrdenTabla(agregados, COLUMNAS, { clave: "equipo", direccion: "asc" });
  const equiposVisibles = equipos.filter(
    (e) => filtro.lineaId === null || e.linea_id === filtro.lineaId,
  );
  const tipos = useMemo(
    () => (["temperatura", "vibracion", "presion"] as TipoSensor[]).filter((t) =>
      agregados.some((a) => a.tipo_sensor === t),
    ),
    [agregados],
  );
  const periodo = PERIODOS.find((p) => p.valor === filtro.periodo)?.etiqueta ?? filtro.periodo;

  /** Genera el PDF con la tabla en el orden que ve el usuario. */
  async function exportar() {
    await exportarPDF({
      titulo: "Análisis de sensores",
      subtitulo: periodo,
      nombreArchivo: `analisis-sensores-${filtro.periodo}`,
      secciones: [aSeccionPDF("Valores agregados por equipo y sensor", COLUMNAS, tabla.filasOrdenadas)],
    });
  }

  return (
    <div className="space-y-6">
      <EncabezadoReporte
        titulo="Análisis de sensores"
        descripcion="Temperatura, vibración y presión agregadas por equipo, línea y periodo para detectar fallos a tiempo."
      />

      <div className="item-row">
        <Form
          method="get"
          onChange={(evento) => enviar(evento.currentTarget)}
          className="filter-row"
        >
          <div>
            <label htmlFor="linea" className={CLASE_ETIQUETA}>
              Línea
            </label>
            <select id="linea" name="linea" defaultValue={filtro.lineaId ?? ""} className={CLASE_CONTROL}>
              <option value="">Todas las líneas</option>
              {lineas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="equipo" className={CLASE_ETIQUETA}>
              Equipo
            </label>
            <select
              key={filtro.equipoId ?? "todos"}
              id="equipo"
              name="equipo"
              defaultValue={filtro.equipoId ?? ""} className={CLASE_CONTROL}>
              <option value="">Todos los equipos</option>
              {equiposVisibles.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="periodo" className={CLASE_ETIQUETA}>
              Periodo
            </label>
            <select id="periodo" name="periodo" defaultValue={filtro.periodo} className={CLASE_CONTROL}>
              {PERIODOS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </Form>
        <BotonExportarPDF onExportar={exportar} deshabilitado={agregados.length === 0} />
      </div>

      {cargando && <p className="text-muted">Cargando…</p>}

      {error && (
        <Mensaje tipo="error" titulo={error} texto="El equipo solicitado no existe. Elige otro en el selector." />
      )}

      {sinAcceso && !error && (
        <Mensaje tipo="error" titulo="Sin acceso a esta línea" texto="La línea no está entre las de tu rol. Elige otra en el selector." />
      )}

      {analisis && !sinAcceso && agregados.length === 0 && (
        <Mensaje tipo="vacio" titulo="No hay datos" texto="No hay lecturas para los filtros elegidos." />
      )}

      {analisis && agregados.length > 0 && (
        <>
          {tipos.map((tipo) => {
            const filas = agregados.filter((a) => a.tipo_sensor === tipo);
            return (
              <Seccion
                key={tipo}
                titulo={`${NOMBRE_SENSOR[tipo]} (${filas[0].unidad})`}
                descripcion={`${periodo}: mínimo, promedio y máximo por equipo.`}
              >
                <GraficoBarras
                  descripcion={`Gráfico de ${NOMBRE_SENSOR[tipo].toLowerCase()} por equipo`}
                  datos={filas.map((a) => ({
                    etiqueta: a.equipo,
                    minimo: a.minimo,
                    promedio: a.promedio,
                    maximo: a.maximo,
                  }))}
                  claveEtiqueta="etiqueta"
                  series={SERIES_AGREGADO}
                  unidad={` ${filas[0].unidad}`}
                  altura={260}
                />
              </Seccion>
            );
          })}

          <Seccion titulo="Valores agregados" descripcion="Pulsa el encabezado de una columna para ordenar.">
            <TablaOrdenable
              descripcion="Valores agregados de sensores por equipo"
              columnas={COLUMNAS}
              filas={tabla.filasOrdenadas}
              claveFila={(a) => `${a.equipo_id}-${a.tipo_sensor}`}
              orden={tabla.orden}
              onOrdenar={tabla.alternar}
            />
          </Seccion>
        </>
      )}
    </div>
  );
}
