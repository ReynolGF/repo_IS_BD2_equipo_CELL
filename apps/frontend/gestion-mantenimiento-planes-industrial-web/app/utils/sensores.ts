/**
 * Utilidades para mostrar los datos de sensores: textos, formato y lectura
 * de los filtros desde la dirección de la página.
 */
import type {
  EstadoOperativo,
  FiltroSensores,
  PeriodoSensor,
  TipoSensor,
} from "../types/operacion";
import { leerEntero } from "./formulario";

/** Periodos disponibles, en el orden del selector. */
export const PERIODOS: readonly { valor: PeriodoSensor; etiqueta: string }[] = [
  { valor: "24h", etiqueta: "Últimas 24 horas" },
  { valor: "7d", etiqueta: "Últimos 7 días" },
  { valor: "30d", etiqueta: "Últimos 30 días" },
];

/** Periodo usado cuando la dirección no trae uno válido. */
export const PERIODO_POR_DEFECTO: PeriodoSensor = "24h";

/** Nombre legible de cada magnitud. */
export const NOMBRE_SENSOR: Record<TipoSensor, string> = {
  temperatura: "Temperatura",
  vibracion: "Vibración",
  presion: "Presión",
};

/** Nombre legible de cada estado operativo. */
export const NOMBRE_ESTADO_OPERATIVO: Record<EstadoOperativo, string> = {
  normal: "Normal",
  alerta: "Alerta",
  critico: "Crítico",
};

/** Indica si un texto es uno de los periodos admitidos. */
export function esPeriodo(valor: string | null): valor is PeriodoSensor {
  return PERIODOS.some((periodo) => periodo.valor === valor);
}

/**
 * Lee los filtros del análisis de sensores desde los parámetros de la
 * dirección (`?linea=1&equipo=2&periodo=7d`). Un valor ausente o inválido
 * se ignora y el periodo cae al valor por defecto.
 *
 * @param parametros Parámetros de búsqueda de la dirección.
 */
export function leerFiltroSensores(parametros: URLSearchParams): FiltroSensores {
  const periodo = parametros.get("periodo");
  return {
    lineaId: leerEntero(parametros.get("linea")),
    equipoId: leerEntero(parametros.get("equipo")),
    periodo: esPeriodo(periodo) ? periodo : PERIODO_POR_DEFECTO,
  };
}

/**
 * Da formato a un valor de sensor con su unidad, por ejemplo "72,5 °C".
 *
 * @param valor Valor numérico.
 * @param unidad Unidad de la magnitud.
 */
export function formatoLectura(valor: number, unidad: string): string {
  return `${valor.toLocaleString("es", { maximumFractionDigits: 1 })} ${unidad}`;
}
