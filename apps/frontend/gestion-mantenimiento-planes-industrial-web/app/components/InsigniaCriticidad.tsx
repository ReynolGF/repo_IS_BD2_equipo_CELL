/**
 * Etiqueta de color que muestra el nivel de criticidad de una tarea.
 */
import type { Criticidad } from "../types/reporte";
import { NOMBRE_CRITICIDAD } from "../utils/criticidad";

/** Clase de cada criticidad en el diseño (`severity high|medium|low`). */
const CLASES: Record<Criticidad, string> = {
  baja: "low",
  media: "medium",
  alta: "high",
};

/** Propiedades de `InsigniaCriticidad`. */
interface Props {
  /** Criticidad a mostrar. */
  criticidad: Criticidad;
}

/** Dibuja la criticidad como una píldora de color con su nombre. */
export function InsigniaCriticidad({ criticidad }: Props) {
  return <span className={`severity ${CLASES[criticidad]}`}>{NOMBRE_CRITICIDAD[criticidad]}</span>;
}
