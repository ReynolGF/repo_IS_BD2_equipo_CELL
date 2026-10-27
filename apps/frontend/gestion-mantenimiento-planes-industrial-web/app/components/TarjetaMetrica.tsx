/**
 * Tarjeta con un número destacado y su explicación (estilo `metric-card`).
 */

/** Propiedades de `TarjetaMetrica`. */
interface Props {
  /** Nombre de la métrica, por ejemplo "Tareas cumplidas". */
  titulo: string;
  /** Valor ya formateado, por ejemplo "5" o "83,3 %". */
  valor: string;
  /** Texto de apoyo opcional bajo el valor. */
  detalle?: string;
}

/** Dibuja una tarjeta pequeña; se usa dentro de una cuadrícula `metric-cards`. */
export function TarjetaMetrica({ titulo, valor, detalle }: Props) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{titulo}</span>
      </div>
      <div className="metric-number">{valor}</div>
      {detalle && <div className="metric-foot">{detalle}</div>}
    </article>
  );
}
