/**
 * Pruebas del componente de tabla ordenable.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ColumnaTabla } from "../types/tabla";
import { TablaOrdenable } from "./TablaOrdenable";

interface Fila {
  id: number;
  nombre: string;
  cantidad: number;
}

const COLUMNAS: ColumnaTabla<Fila>[] = [
  { clave: "nombre", titulo: "Nombre", tipo: "texto", valor: (f) => f.nombre },
  {
    clave: "cantidad",
    titulo: "Cantidad",
    tipo: "numero",
    valor: (f) => f.cantidad,
    texto: (f) => `${f.cantidad} u.`,
  },
];

const FILAS: Fila[] = [
  { id: 1, nombre: "Bomba", cantidad: 5 },
  { id: 2, nombre: "Cinta", cantidad: 9 },
];

/** Dibuja la tabla con valores por defecto, que cada prueba puede cambiar. */
function dibujar(opciones: Partial<Parameters<typeof TablaOrdenable<Fila>>[0]> = {}) {
  return render(
    <TablaOrdenable
      descripcion="Tabla de prueba"
      columnas={COLUMNAS}
      filas={FILAS}
      claveFila={(f) => f.id}
      orden={null}
      onOrdenar={() => undefined}
      {...opciones}
    />,
  );
}

describe("TablaOrdenable", () => {
  it("dibuja los encabezados y una fila por cada elemento", () => {
    dibujar();
    expect(screen.getByRole("button", { name: /Nombre/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cantidad/ })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3); // encabezado + 2 filas
  });

  it("muestra el texto formateado de la celda", () => {
    dibujar();
    expect(screen.getByText("9 u.")).toBeInTheDocument();
  });

  it("avisa con la clave de la columna al pulsar su encabezado", async () => {
    const onOrdenar = vi.fn();
    dibujar({ onOrdenar });
    await userEvent.click(screen.getByRole("button", { name: /Cantidad/ }));
    expect(onOrdenar).toHaveBeenCalledWith("cantidad");
  });

  it("marca la columna ordenada con aria-sort", () => {
    dibujar({ orden: { clave: "cantidad", direccion: "desc" } });
    const encabezado = screen.getByRole("columnheader", { name: /Cantidad/ });
    expect(encabezado).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: /Nombre/ })).toHaveAttribute(
      "aria-sort",
      "none",
    );
  });

  it("usa el contenido personalizado de la celda cuando existe", () => {
    const columnas: ColumnaTabla<Fila>[] = [
      {
        clave: "nombre",
        titulo: "Nombre",
        tipo: "texto",
        valor: (f) => f.nombre,
        celda: (f) => <strong>{f.nombre.toUpperCase()}</strong>,
      },
    ];
    dibujar({ columnas });
    const cuerpo = screen.getAllByRole("row")[1];
    expect(within(cuerpo).getByText("BOMBA")).toBeInTheDocument();
  });
});
