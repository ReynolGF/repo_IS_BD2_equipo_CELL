/**
 * Botón que genera un PDF con lo que el usuario está viendo.
 */
import { useState } from "react";

/** Propiedades de `BotonExportarPDF`. */
interface Props {
  /** Acción que genera y descarga el PDF. */
  onExportar: () => Promise<void>;
  /** Desactiva el botón (por ejemplo, cuando no hay datos). */
  deshabilitado?: boolean;
}

/** Dibuja el botón y gestiona su estado "generando" y los errores. */
export function BotonExportarPDF({ onExportar, deshabilitado = false }: Props) {
  const [generando, setGenerando] = useState(false);
  const [fallo, setFallo] = useState(false);

  async function manejarClic() {
    setGenerando(true);
    setFallo(false);
    try {
      await onExportar();
    } catch {
      setFallo(true);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={manejarClic}
        disabled={deshabilitado || generando}
        className="button button-primary"
      >
        {generando ? "Generando PDF…" : "Exportar a PDF"}
      </button>
      {fallo && (
        <span role="alert" className="text-muted" style={{ color: "#ae6f60" }}>
          No se pudo generar el PDF.
        </span>
      )}
    </div>
  );
}
