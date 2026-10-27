/**
 * Selector que envía su valor en la dirección de la página (`?nombre=valor`).
 *
 * Al cambiar la opción se vuelve a ejecutar el `loader` de la ruta con el
 * nuevo valor, y la dirección queda lista para compartirse.
 */
import { Form, useSubmit } from "react-router";

/** Opción del selector. */
export interface OpcionSelector {
  /** Valor enviado en la dirección. */
  valor: string | number;
  /** Texto que ve el usuario. */
  etiqueta: string;
}

/** Propiedades de `SelectorFormulario`. */
interface Props {
  /** Texto de la etiqueta del selector. */
  etiqueta: string;
  /** Nombre del parámetro de la dirección (por ejemplo "linea"). */
  nombre: string;
  /** Opciones disponibles. */
  opciones: readonly OpcionSelector[];
  /** Valor seleccionado actualmente, o `null` si no hay. */
  valorActual: string | number | null;
  /** Texto de la opción vacía inicial. */
  textoVacio: string;
}

/** Dibuja un formulario GET con un selector que se envía al cambiar. */
export function SelectorFormulario({
  etiqueta,
  nombre,
  opciones,
  valorActual,
  textoVacio,
}: Props) {
  const enviar = useSubmit();

  return (
    <Form
      method="get"
      onChange={(evento) => enviar(evento.currentTarget)}
      className="line-select"
    >
      <label htmlFor={nombre} className="field-label" style={{ margin: 0 }}>
        {etiqueta}
      </label>
      <select
        id={nombre}
        name={nombre}
        value={valorActual === null ? "" : String(valorActual)}
        onChange={() => undefined}
        className="control control-auto"
      >
        <option value="">{textoVacio}</option>
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={String(opcion.valor)}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit">Consultar</button>
      </noscript>
    </Form>
  );
}
