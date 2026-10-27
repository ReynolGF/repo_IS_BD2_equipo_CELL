/**
 * Estado operativo de los equipos (T24): consulta rápida para los operarios
 * durante el turno, con un resumen por estado y la última lectura de cada equipo.
 *
 * La línea elegida viaja en la dirección (`?linea=1`); sin línea se muestran
 * todos los equipos. La página se vuelve a pedir al servidor al cambiar el
 * filtro, así que siempre refleja la última lectura disponible.
 */
import { useMemo } from "react";
import { useNavigation } from "react-router";
import { useAlcance } from "../auth/useAlcance";
import { InsigniaEstado, type TonoInsignia } from "../components/InsigniaEstado";
import { Mensaje } from "../components/Mensaje";
import { EncabezadoReporte, Seccion } from "../components/Seccion";
import { SelectorFormulario } from "../components/SelectorFormulario";
import { TablaOrdenable } from "../components/TablaOrdenable";
import { TarjetaMetrica } from "../components/TarjetaMetrica";
import { useOrdenTabla } from "../hooks/useOrdenTabla";
import { reporteRepository, sensorRepository } from "../repositories";
import type { EstadoEquipo, EstadoOperativo } from "../types/operacion";
import type { LineaProduccion } from "../types/reporte";
import type { ColumnaTabla } from "../types/tabla";
import { lineaVisible } from "../utils/alcance";
import { formatoFechaHora } from "../utils/formato";
import { leerEntero } from "../utils/formulario";
import { formatoLectura, NOMBRE_ESTADO_OPERATIVO } from "../utils/sensores";
import type { Route } from "./+types/sensores-estado";

/** Datos que el `loader` entrega a la página. */
export interface DatosEstadoOperativo {
  /** Líneas para llenar el selector. */
  lineas: LineaProduccion[];
  /** Línea elegida, o `null` para todas. */
  lineaId: number | null;
  /** Estado de los equipos de la línea elegida. */
  equipos: EstadoEquipo[];
  /** Mensaje de error, o `null` si todo salió bien. */
  error: string | null;
}

/** Color de la etiqueta de cada estado operativo. */
const TONO_ESTADO: Record<EstadoOperativo, TonoInsignia> = {
  normal: "verde",
  alerta: "ambar",
  critico: "rojo",
};

/** Orden de gravedad: los críticos se muestran primero. */
const GRAVEDAD: Record<EstadoOperativo, number> = { critico: 0, alerta: 1, normal: 2 };

/** Título de la pestaña del navegador. */
export function meta(_: Route.MetaArgs) {
  return [{ title: "Estado de equipos · Mantenimiento industrial" }];
}

/**
 * Obtiene las líneas y el estado de los equipos de la línea elegida.
 * Una línea inexistente se devuelve como mensaje de error dentro de la página.
 */
export async function loader({ request }: Route.LoaderArgs): Promise<DatosEstadoOperativo> {
  const parametro = new URL(request.url).searchParams.get("linea");
  const lineas = await reporteRepository.listarLineas();
  if (!parametro) {
    const equipos = await sensorRepository.obtenerEstadoOperativo(null);
    return { lineas, lineaId: null, equipos, error: null };
  }

  const lineaId = leerEntero(parametro);
  if (lineaId === null || !lineas.some((l) => l.id === lineaId)) {
    return { lineas, lineaId: null, equipos: [], error: "Línea no encontrada" };
  }
  const equipos = await sensorRepository.obtenerEstadoOperativo(lineaId);
  return { lineas, lineaId, equipos, error: null };
}

/** Columnas de la tabla de equipos. */
const COLUMNAS: ColumnaTabla<EstadoEquipo>[] = [
  {
    clave: "estado",
    titulo: "Estado",
    tipo: "numero",
    valor: (e) => GRAVEDAD[e.estado],
    texto: (e) => NOMBRE_ESTADO_OPERATIVO[e.estado],
    celda: (e) => (
      <InsigniaEstado texto={NOMBRE_ESTADO_OPERATIVO[e.estado]} tono={TONO_ESTADO[e.estado]} />
    ),
  },
  { clave: "equipo", titulo: "Equipo", tipo: "texto", valor: (e) => e.equipo },
  { clave: "linea", titulo: "Línea", tipo: "texto", valor: (e) => e.linea },
  {
    clave: "temperatura",
    titulo: "Temperatura",
    tipo: "numero",
    valor: (e) => e.temperatura,
    texto: (e) => formatoLectura(e.temperatura, "°C"),
    alineacion: "derecha",
  },
  {
    clave: "vibracion",
    titulo: "Vibración",
    tipo: "numero",
    valor: (e) => e.vibracion,
    texto: (e) => formatoLectura(e.vibracion, "mm/s"),
    alineacion: "derecha",
  },
  {
    clave: "presion",
    titulo: "Presión",
    tipo: "numero",
    valor: (e) => e.presion,
    texto: (e) => (e.presion > 0 ? formatoLectura(e.presion, "bar") : "—"),
    alineacion: "derecha",
  },
  {
    clave: "ultima_lectura",
    titulo: "Última lectura",
    tipo: "texto",
    valor: (e) => e.ultima_lectura,
    texto: (e) => formatoFechaHora(e.ultima_lectura),
  },
];

/** Página del estado operativo de los equipos. */
export default function SensoresEstado({ loaderData }: Route.ComponentProps) {
  const { lineas: todasLasLineas, lineaId, equipos: todosLosEquipos, error } = loaderData;
  const cargando = useNavigation().state === "loading";

  // Alcance por rol: el técnico solo ve los equipos de sus líneas.
  const alcance = useAlcance();
  const lineas = todasLasLineas.filter((l) => lineaVisible(alcance, l.nombre));
  const sinAcceso = lineaId !== null && !lineas.some((l) => l.id === lineaId);
  const equipos = useMemo(
    () => (sinAcceso ? [] : todosLosEquipos.filter((e) => lineaVisible(alcance, e.linea))),
    // `alcance` se recrea en cada render; sus datos son el rol y las líneas.
    [todosLosEquipos, sinAcceso, alcance.rol, alcance.lineas.join("|")],
  );

  const tabla = useOrdenTabla(equipos, COLUMNAS, { clave: "estado", direccion: "asc" });
  const cuenta = useMemo(
    () => ({
      normal: equipos.filter((e) => e.estado === "normal").length,
      alerta: equipos.filter((e) => e.estado === "alerta").length,
      critico: equipos.filter((e) => e.estado === "critico").length,
    }),
    [equipos],
  );

  return (
    <div className="space-y-6">
      <EncabezadoReporte
        titulo="Estado de equipos"
        descripcion="Estado operativo actual de los equipos según sus últimas lecturas de temperatura, vibración y presión."
      />

      <SelectorFormulario
        etiqueta="Línea de producción"
        nombre="linea"
        opciones={lineas.map((l) => ({ valor: l.id, etiqueta: l.nombre }))}
        valorActual={lineaId}
        textoVacio="Todas las líneas"
      />

      {cargando && <p className="text-muted">Cargando…</p>}

      {error && (
        <Mensaje tipo="error" titulo={error} texto="La línea solicitada no existe. Elige otra en el selector." />
      )}

      {sinAcceso && !error && (
        <Mensaje tipo="error" titulo="Sin acceso a esta línea" texto="La línea no está entre las de tu rol. Elige otra en el selector." />
      )}

      {!error && !sinAcceso && equipos.length === 0 && (
        <Mensaje tipo="vacio" titulo="No hay datos" texto="No hay equipos con lecturas para esta línea." />
      )}

      {!error && equipos.length > 0 && (
        <>
          <div className="metric-cards">
            <TarjetaMetrica titulo="Equipos normales" valor={String(cuenta.normal)} />
            <TarjetaMetrica titulo="En alerta" valor={String(cuenta.alerta)} detalle="Revisar pronto" />
            <TarjetaMetrica titulo="En estado crítico" valor={String(cuenta.critico)} detalle="Requieren atención inmediata" />
          </div>

          <Seccion titulo="Equipos" descripcion="Los equipos críticos aparecen primero. Pulsa un encabezado para ordenar.">
            <TablaOrdenable
              descripcion="Estado operativo actual de los equipos"
              columnas={COLUMNAS}
              filas={tabla.filasOrdenadas}
              claveFila={(e) => e.equipo_id}
              orden={tabla.orden}
              onOrdenar={tabla.alternar}
            />
          </Seccion>
        </>
      )}
    </div>
  );
}
