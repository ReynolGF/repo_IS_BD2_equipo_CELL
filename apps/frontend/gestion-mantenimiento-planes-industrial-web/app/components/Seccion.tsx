/**
 * Bloques de estructura de las páginas: encabezado y panel con título.
 * Usan las clases del diseño del borrador (`page-heading`, `panel`…).
 */
import type { ReactNode } from "react";

/** Propiedades de `EncabezadoReporte`. */
interface PropsEncabezado {
  /** Título de la página. */
  titulo: string;
  /** Explicación breve de qué muestra la pantalla. */
  descripcion: string;
}

/**
 * Descripción breve al inicio de cada pantalla.
 *
 * El título de la página lo dibuja `AppShell` (a partir del menú), así que
 * aquí solo se muestra la explicación; `titulo` queda como etiqueta accesible.
 */
export function EncabezadoReporte({ titulo, descripcion }: PropsEncabezado) {
  return (
    <p className="page-intro" aria-label={titulo}>
      {descripcion}
    </p>
  );
}

/** Propiedades de `Seccion`. */
interface PropsSeccion {
  /** Título de la sección. */
  titulo: string;
  /** Texto de apoyo opcional bajo el título. */
  descripcion?: string;
  /** Contenido de la sección. */
  children: ReactNode;
}

/** Panel blanco con título dentro de una pantalla. */
export function Seccion({ titulo, descripcion, children }: PropsSeccion) {
  return (
    <section className="panel panel-block">
      <div className="panel-heading">
        <div>
          <h2>{titulo}</h2>
          {descripcion && <p>{descripcion}</p>}
        </div>
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}
