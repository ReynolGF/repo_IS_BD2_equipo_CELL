/**
 * Constantes y utilidades compartidas sobre el nivel de criticidad.
 */
import type { Criticidad } from "../types/reporte";

/** Criticidades de menor a mayor; define el orden en tablas y gráficos. */
export const ORDEN_CRITICIDAD: readonly Criticidad[] = [
  "baja",
  "media",
  "alta",
];

/** Valor numérico de cada criticidad (baja=1, media=2, alta=3). */
export const NIVEL_CRITICIDAD: Record<Criticidad, number> = {
  baja: 1,
  media: 2,
  alta: 3,
};

/** Color de cada criticidad en los gráficos (verde, ámbar y coral, como en el diseño). */
export const COLOR_CRITICIDAD: Record<Criticidad, string> = {
  baja: "#69a980",
  media: "#d0ae5e",
  alta: "#d17d68",
};

/** Nombre legible de cada criticidad, usado en leyendas y encabezados. */
export const NOMBRE_CRITICIDAD: Record<Criticidad, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};

/** Series de un gráfico con una barra por cada criticidad. */
export const SERIES_CRITICIDAD = ORDEN_CRITICIDAD.map((criticidad) => ({
  clave: criticidad,
  nombre: NOMBRE_CRITICIDAD[criticidad],
  color: COLOR_CRITICIDAD[criticidad],
}));
