/**
 * Pruebas de las estrategias de ordenamiento.
 */
import { describe, expect, it } from "vitest";
import { ordenarFilas } from "./ordenamiento";

describe("ordenarFilas", () => {
  it("ordena texto ignorando mayúsculas y acentos", () => {
    const filas = ["beto", "Ana", "Álvaro"];
    const resultado = ordenarFilas(filas, (f) => f, "texto", "asc");
    expect(resultado).toEqual(["Álvaro", "Ana", "beto"]);
  });

  it("ordena números de mayor a menor en sentido descendente", () => {
    const filas = [2, 10, 5];
    const resultado = ordenarFilas(filas, (f) => f, "numero", "desc");
    expect(resultado).toEqual([10, 5, 2]);
  });

  it("ordena la criticidad por nivel y no alfabéticamente", () => {
    const filas = ["media", "alta", "baja"];
    expect(ordenarFilas(filas, (f) => f, "criticidad", "asc")).toEqual([
      "baja",
      "media",
      "alta",
    ]);
    expect(ordenarFilas(filas, (f) => f, "criticidad", "desc")).toEqual([
      "alta",
      "media",
      "baja",
    ]);
  });

  it("es estable: los empates conservan su orden original", () => {
    const filas = [
      { nombre: "b", valor: 2 },
      { nombre: "a", valor: 10 },
      { nombre: "c", valor: 2 },
    ];
    const resultado = ordenarFilas(filas, (f) => f.valor, "numero", "asc");
    expect(resultado.map((f) => f.nombre)).toEqual(["b", "c", "a"]);
  });

  it("no modifica el arreglo original", () => {
    const filas = [3, 1, 2];
    ordenarFilas(filas, (f) => f, "numero", "asc");
    expect(filas).toEqual([3, 1, 2]);
  });
});
