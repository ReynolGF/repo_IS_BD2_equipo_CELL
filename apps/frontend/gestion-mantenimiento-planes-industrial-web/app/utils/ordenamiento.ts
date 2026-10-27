/**
 * Ordenamiento de tablas mediante el patrón Strategy.
 *
 * Cada tipo de columna (texto, número, criticidad) tiene su propia estrategia
 * de comparación. `ordenarFilas` elige la estrategia en tiempo de ejecución,
 * de modo que agregar un tipo nuevo no obliga a modificar la lógica de orden.
 */
import { NIVEL_CRITICIDAD } from "./criticidad";
import type { Criticidad } from "../types/reporte";

/** Tipos de columna que saben ordenarse. */
export type TipoOrden = "texto" | "numero" | "criticidad";

/** Sentido del orden: ascendente o descendente. */
export type DireccionOrden = "asc" | "desc";

/** Valor que puede contener una celda a efectos de ordenamiento. */
export type ValorCelda = string | number;

/** Función que compara dos valores y devuelve un número negativo, cero o positivo. */
export type EstrategiaOrden = (a: ValorCelda, b: ValorCelda) => number;

/** Estrategias de comparación disponibles, una por tipo de columna. */
export const estrategiasOrden: Record<TipoOrden, EstrategiaOrden> = {
  texto: (a, b) =>
    String(a).localeCompare(String(b), "es", { sensitivity: "base" }),
  numero: (a, b) => Number(a) - Number(b),
  criticidad: (a, b) =>
    (NIVEL_CRITICIDAD[a as Criticidad] ?? 0) -
    (NIVEL_CRITICIDAD[b as Criticidad] ?? 0),
};

/**
 * Devuelve una copia ordenada de las filas, sin modificar el arreglo original.
 *
 * El ordenamiento es estable: las filas con igual valor conservan su orden
 * relativo original.
 *
 * @param filas Filas a ordenar.
 * @param obtenerValor Función que extrae de una fila el valor de la columna.
 * @param tipo Tipo de columna, que determina la estrategia de comparación.
 * @param direccion Sentido del orden.
 */
export function ordenarFilas<T>(
  filas: readonly T[],
  obtenerValor: (fila: T) => ValorCelda,
  tipo: TipoOrden,
  direccion: DireccionOrden,
): T[] {
  const comparar = estrategiasOrden[tipo];
  const signo = direccion === "asc" ? 1 : -1;
  return [...filas].sort(
    (a, b) => signo * comparar(obtenerValor(a), obtenerValor(b)),
  );
}
