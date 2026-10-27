/**
 * Exportación de tablas a PDF.
 *
 * Las librerías `jspdf` y `jspdf-autotable` se cargan solo al exportar
 * (importación dinámica): pesan bastante y no se necesitan para mostrar la
 * página ni funcionan en el servidor.
 */
import type { ColumnaTabla } from "../types/tabla";

/** Una tabla dentro del documento PDF. */
export interface SeccionPDF {
  /** Título de la sección. */
  titulo: string;
  /** Encabezados de las columnas. */
  columnas: string[];
  /** Filas ya convertidas a texto. */
  filas: string[][];
}

/** Documento PDF completo a generar. */
export interface DocumentoPDF {
  /** Título principal del documento. */
  titulo: string;
  /** Línea de contexto bajo el título (por ejemplo, la línea consultada). */
  subtitulo?: string;
  /** Tablas que se incluyen, en orden. */
  secciones: SeccionPDF[];
  /** Nombre del archivo descargado, sin extensión. */
  nombreArchivo: string;
}

/**
 * Convierte filas y columnas de una tabla en una sección de PDF, usando el
 * texto de cada celda en el orden en que se reciben las filas.
 *
 * @param titulo Título de la sección.
 * @param columnas Columnas de la tabla en pantalla.
 * @param filas Filas, normalmente ya ordenadas como las ve el usuario.
 */
export function aSeccionPDF<T>(
  titulo: string,
  columnas: readonly ColumnaTabla<T>[],
  filas: readonly T[],
): SeccionPDF {
  return {
    titulo,
    columnas: columnas.map((c) => c.titulo),
    filas: filas.map((fila) =>
      columnas.map((c) => (c.texto ? c.texto(fila) : String(c.valor(fila)))),
    ),
  };
}

/**
 * Genera el PDF y lo descarga en el navegador.
 *
 * @param documento Contenido del documento.
 */
export async function exportarPDF(documento: DocumentoPDF): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margen = 14;
  let y = 18;

  pdf.setFontSize(16);
  pdf.text(documento.titulo, margen, y);
  y += 7;

  pdf.setFontSize(10);
  if (documento.subtitulo) {
    pdf.text(documento.subtitulo, margen, y);
    y += 5;
  }
  pdf.text(`Generado el ${new Date().toLocaleString("es")}`, margen, y);
  y += 8;

  for (const seccion of documento.secciones) {
    if (y > 175) {
      pdf.addPage();
      y = 18;
    }
    pdf.setFontSize(12);
    pdf.text(seccion.titulo, margen, y);
    y += 3;

    if (seccion.filas.length === 0) {
      pdf.setFontSize(10);
      pdf.text("Sin datos para mostrar.", margen, y + 5);
      y += 12;
      continue;
    }

    autoTable(pdf, {
      head: [seccion.columnas],
      body: seccion.filas,
      startY: y,
      margin: { left: margen, right: margen },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] },
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 10;
  }

  pdf.save(`${documento.nombreArchivo}.pdf`);
}
