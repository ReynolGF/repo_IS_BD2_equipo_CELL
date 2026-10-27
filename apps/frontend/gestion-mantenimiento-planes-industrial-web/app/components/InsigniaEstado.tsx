/**
 * Etiqueta de color para mostrar un estado (de tarea, de plan o de equipo).
 */

/** Colores disponibles; cada uno se asocia a un significado en la pantalla. */
export type TonoInsignia = "verde" | "ambar" | "rojo" | "azul" | "gris";

/** Propiedades de `InsigniaEstado`. */
interface Props {
  /** Texto que ve el usuario. */
  texto: string;
  /** Color de la etiqueta. */
  tono: TonoInsignia;
}

/** Clase `status-pill` de cada tono, definida en `app/app.css`. */
const CLASES: Record<TonoInsignia, string> = {
  verde: "status-approved",
  ambar: "status-review",
  rojo: "status-danger",
  azul: "status-running",
  gris: "status-draft",
};

/** Dibuja una etiqueta redondeada con el color del tono. */
export function InsigniaEstado({ texto, tono }: Props) {
  return <span className={`status-pill ${CLASES[tono]}`}>{texto}</span>;
}
