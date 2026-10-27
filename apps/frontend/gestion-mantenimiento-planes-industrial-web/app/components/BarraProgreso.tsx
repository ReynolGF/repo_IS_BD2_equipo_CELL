/**
 * Barra horizontal que muestra un porcentaje de avance.
 */

/** Propiedades de `BarraProgreso`. */
interface Props {
  /** Texto que describe qué mide la barra (también lo leen los lectores de pantalla). */
  etiqueta: string;
  /** Porcentaje entre 0 y 100. */
  porcentaje: number;
}

/** Dibuja la barra con su porcentaje escrito a la derecha. */
export function BarraProgreso({ etiqueta, porcentaje }: Props) {
  const valor = Math.min(100, Math.max(0, porcentaje));
  return (
    <div className="progress">
      <div
        role="progressbar"
        aria-label={etiqueta}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valor}
        className="progress-track"
      >
        <i style={{ width: `${valor}%` }} />
      </div>
      <strong>{valor.toLocaleString("es", { maximumFractionDigits: 1 })} %</strong>
    </div>
  );
}
