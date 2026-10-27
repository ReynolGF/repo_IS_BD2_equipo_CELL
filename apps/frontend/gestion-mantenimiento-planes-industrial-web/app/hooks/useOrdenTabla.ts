/**
 * Hook que gestiona el estado de orden de una tabla.
 *
 * El estado vive en la página (y no dentro de la tabla) para que la página
 * conozca el orden actual y pueda exportar a PDF las filas tal como se ven.
 */
import { useCallback, useMemo, useState } from "react";
import type { ColumnaTabla, OrdenTabla } from "../types/tabla";
import { ordenarFilas } from "../utils/ordenamiento";

/** Resultado del hook `useOrdenTabla`. */
export interface ResultadoOrdenTabla<T> {
  /** Orden vigente, o `null` si se muestra el orden original. */
  orden: OrdenTabla | null;
  /** Cambia el orden a la columna indicada o invierte el sentido si ya estaba. */
  alternar: (clave: string) => void;
  /** Copia de las filas con el orden vigente aplicado. */
  filasOrdenadas: T[];
}

/**
 * Ordena filas según la columna elegida por el usuario.
 *
 * Al elegir una columna por primera vez, las numéricas empiezan de mayor a
 * menor y el resto de A a Z. Al volver a elegirla se invierte el sentido.
 *
 * @param filas Filas originales.
 * @param columnas Definición de las columnas de la tabla.
 * @param ordenInicial Orden con el que arranca la tabla.
 */
export function useOrdenTabla<T>(
  filas: readonly T[],
  columnas: readonly ColumnaTabla<T>[],
  ordenInicial: OrdenTabla | null = null,
): ResultadoOrdenTabla<T> {
  const [orden, setOrden] = useState<OrdenTabla | null>(ordenInicial);

  const filasOrdenadas = useMemo(() => {
    const columna = columnas.find((c) => c.clave === orden?.clave);
    if (!orden || !columna) {
      return [...filas];
    }
    return ordenarFilas(filas, columna.valor, columna.tipo, orden.direccion);
  }, [filas, columnas, orden]);

  const alternar = useCallback(
    (clave: string) => {
      setOrden((actual) => {
        if (actual?.clave === clave) {
          return {
            clave,
            direccion: actual.direccion === "asc" ? "desc" : "asc",
          };
        }
        const columna = columnas.find((c) => c.clave === clave);
        return {
          clave,
          direccion: columna?.tipo === "numero" ? "desc" : "asc",
        };
      });
    },
    [columnas],
  );

  return { orden, alternar, filasOrdenadas };
}
