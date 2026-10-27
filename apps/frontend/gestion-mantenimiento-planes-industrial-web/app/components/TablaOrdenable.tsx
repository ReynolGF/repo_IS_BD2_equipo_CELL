/**
 * Tabla reutilizable cuyas columnas se pueden ordenar con un clic.
 *
 * Es un componente "de presentación": no guarda el orden, lo recibe y avisa
 * cuando el usuario pide cambiarlo. Así la página controla el estado.
 */
import type { ColumnaTabla, OrdenTabla } from "../types/tabla";

/** Propiedades de `TablaOrdenable`. */
interface Props<T> {
  /** Descripción de la tabla, leída por lectores de pantalla. */
  descripcion: string;
  /** Definición de las columnas. */
  columnas: readonly ColumnaTabla<T>[];
  /** Filas a dibujar, ya ordenadas. */
  filas: readonly T[];
  /** Devuelve un identificador único y estable de cada fila. */
  claveFila: (fila: T) => string | number;
  /** Orden vigente, para marcar la columna activa. */
  orden: OrdenTabla | null;
  /** Se llama con la clave de la columna cuando el usuario pulsa su encabezado. */
  onOrdenar: (clave: string) => void;
}

/** Clases de alineación del texto según la columna. */
const ALINEACION = {
  izquierda: "text-left",
  derecha: "text-right",
  centro: "text-center",
} as const;

/** Flecha que indica el sentido del orden de una columna. */
function indicador(orden: OrdenTabla | null, clave: string): string {
  if (orden?.clave !== clave) return "↕";
  return orden.direccion === "asc" ? "▲" : "▼";
}

/** Dibuja una tabla con encabezados pulsables para ordenar. */
export function TablaOrdenable<T>({
  descripcion,
  columnas,
  filas,
  claveFila,
  orden,
  onOrdenar,
}: Props<T>) {
  return (
    <div className="table-scroll report-table">
      <table>
        <caption className="sr-only">{descripcion}</caption>
        <thead>
          <tr>
            {columnas.map((columna) => {
              const activa = orden?.clave === columna.clave;
              const alineacion = ALINEACION[columna.alineacion ?? "izquierda"];
              return (
                <th
                  key={columna.clave}
                  scope="col"
                  aria-sort={
                    activa
                      ? orden.direccion === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={alineacion}
                >
                  <button
                    type="button"
                    onClick={() => onOrdenar(columna.clave)}
                    className="sort-heading"
                  >
                    {columna.titulo}
                    <span aria-hidden="true">
                      {indicador(orden, columna.clave)}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={claveFila(fila)}>
              {columnas.map((columna) => (
                <td
                  key={columna.clave}
                  className={ALINEACION[columna.alineacion ?? "izquierda"]}
                >
                  {columna.celda
                    ? columna.celda(fila)
                    : columna.texto
                      ? columna.texto(fila)
                      : String(columna.valor(fila))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
