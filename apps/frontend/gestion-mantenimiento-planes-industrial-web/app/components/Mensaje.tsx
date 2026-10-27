/**
 * Mensaje de estado: sin datos, error o información general.
 */

/** Propiedades de `Mensaje`. */
interface Props {
  /** Tipo de mensaje, que decide su color. */
  tipo: "vacio" | "error" | "info";
  /** Título corto. */
  titulo: string;
  /** Explicación opcional. */
  texto?: string;
}

/** Dibuja un recuadro con un título y un texto opcional. */
export function Mensaje({ tipo, titulo, texto }: Props) {
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={`notice notice-${tipo}`}>
      <strong>{titulo}</strong>
      {texto && <p>{texto}</p>}
    </div>
  );
}
