/**
 * Pruebas del formato de números, la interpretación de la correlación y la
 * conversión de tablas a secciones de PDF.
 */
import { describe, expect, it } from "vitest";
import type { ColumnaTabla } from "../types/tabla";
import { interpretarCorrelacion } from "./correlacion";
import { aSeccionPDF } from "./exportarPdf";
import { formatoDiferencia, formatoPorcentaje } from "./formato";

describe("formatoPorcentaje", () => {
  it("muestra un decimal y el símbolo", () => {
    expect(formatoPorcentaje(94)).toBe("94.0 %");
    expect(formatoPorcentaje(83.33)).toBe("83.3 %");
  });
});

describe("formatoDiferencia", () => {
  it("agrega + a las diferencias positivas", () => {
    expect(formatoDiferencia(7.5)).toBe("+7.5 pp");
  });

  it("conserva el signo - de las negativas", () => {
    expect(formatoDiferencia(-12.5)).toBe("-12.5 pp");
  });

  it("no agrega signo al cero", () => {
    expect(formatoDiferencia(0)).toBe("0.0 pp");
  });
});

describe("interpretarCorrelacion", () => {
  it("detecta una correlación fuerte negativa", () => {
    expect(interpretarCorrelacion(-0.98)).toContain("fuerte negativa");
  });

  it("detecta una correlación moderada positiva", () => {
    expect(interpretarCorrelacion(0.5)).toContain("moderada positiva");
  });

  it("indica ausencia de relación para valores cercanos a cero", () => {
    expect(interpretarCorrelacion(0.1)).toContain("Sin relación");
    expect(interpretarCorrelacion(-0.29)).toContain("Sin relación");
  });
});

describe("aSeccionPDF", () => {
  interface Fila {
    nombre: string;
    tasa: number;
  }
  const columnas: ColumnaTabla<Fila>[] = [
    { clave: "nombre", titulo: "Nombre", tipo: "texto", valor: (f) => f.nombre },
    {
      clave: "tasa",
      titulo: "Tasa",
      tipo: "numero",
      valor: (f) => f.tasa,
      texto: (f) => `${f.tasa} %`,
    },
  ];

  it("usa los títulos como encabezados y el texto de cada celda", () => {
    const seccion = aSeccionPDF("Prueba", columnas, [{ nombre: "Ana", tasa: 90 }]);
    expect(seccion).toEqual({
      titulo: "Prueba",
      columnas: ["Nombre", "Tasa"],
      filas: [["Ana", "90 %"]],
    });
  });

  it("respeta el orden de las filas recibidas", () => {
    const seccion = aSeccionPDF("Prueba", columnas, [
      { nombre: "Luis", tasa: 5 },
      { nombre: "Ana", tasa: 9 },
    ]);
    expect(seccion.filas.map((f) => f[0])).toEqual(["Luis", "Ana"]);
  });
});
