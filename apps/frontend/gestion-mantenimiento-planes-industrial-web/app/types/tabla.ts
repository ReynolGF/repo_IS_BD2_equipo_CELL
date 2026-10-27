/**
 * Tipos que describen las columnas y el estado de orden de una tabla.
 */
import type { ReactNode } from "react";
import type {
  DireccionOrden,
  TipoOrden,
  ValorCelda,
} from "../utils/ordenamiento";

/** Definición de una columna de la tabla para filas de tipo `T`. */
export interface ColumnaTabla<T> {
  /** Identificador único de la columna dentro de la tabla. */
  clave: string;
  /** Texto del encabezado. */
  titulo: string;
  /** Tipo de dato, que decide cómo se ordena la columna. */
  tipo: TipoOrden;
  /** Extrae de la fila el valor usado para ordenar. */
  valor: (fila: T) => ValorCelda;
  /** Texto mostrado y exportado a PDF; si falta se usa `valor`. */
  texto?: (fila: T) => string;
  /** Contenido a dibujar en la celda; si falta se usa el texto. */
  celda?: (fila: T) => ReactNode;
  /** Alineación del contenido. Por defecto, izquierda. */
  alineacion?: "izquierda" | "derecha" | "centro";
}

/** Columna y sentido por el que está ordenada una tabla. */
export interface OrdenTabla {
  /** Clave de la columna ordenada. */
  clave: string;
  /** Sentido del orden. */
  direccion: DireccionOrden;
}
