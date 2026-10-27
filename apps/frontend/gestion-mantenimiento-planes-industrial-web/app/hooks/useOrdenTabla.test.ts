/**
 * Pruebas del hook que gestiona el orden de una tabla.
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ColumnaTabla } from "../types/tabla";
import { useOrdenTabla } from "./useOrdenTabla";

interface Fila {
  nombre: string;
  cantidad: number;
}

const COLUMNAS: ColumnaTabla<Fila>[] = [
  { clave: "nombre", titulo: "Nombre", tipo: "texto", valor: (f) => f.nombre },
  { clave: "cantidad", titulo: "Cantidad", tipo: "numero", valor: (f) => f.cantidad },
];

const FILAS: Fila[] = [
  { nombre: "b", cantidad: 5 },
  { nombre: "a", cantidad: 9 },
  { nombre: "c", cantidad: 1 },
];

describe("useOrdenTabla", () => {
  it("sin orden inicial devuelve las filas como llegaron", () => {
    const { result } = renderHook(() => useOrdenTabla(FILAS, COLUMNAS));
    expect(result.current.orden).toBeNull();
    expect(result.current.filasOrdenadas.map((f) => f.nombre)).toEqual(["b", "a", "c"]);
  });

  it("aplica el orden inicial", () => {
    const { result } = renderHook(() =>
      useOrdenTabla(FILAS, COLUMNAS, { clave: "cantidad", direccion: "desc" }),
    );
    expect(result.current.filasOrdenadas.map((f) => f.cantidad)).toEqual([9, 5, 1]);
  });

  it("una columna de texto empieza de la A a la Z", () => {
    const { result } = renderHook(() => useOrdenTabla(FILAS, COLUMNAS));
    act(() => result.current.alternar("nombre"));
    expect(result.current.orden).toEqual({ clave: "nombre", direccion: "asc" });
    expect(result.current.filasOrdenadas.map((f) => f.nombre)).toEqual(["a", "b", "c"]);
  });

  it("una columna numérica empieza de mayor a menor", () => {
    const { result } = renderHook(() => useOrdenTabla(FILAS, COLUMNAS));
    act(() => result.current.alternar("cantidad"));
    expect(result.current.orden).toEqual({ clave: "cantidad", direccion: "desc" });
  });

  it("pulsar la misma columna otra vez invierte el sentido", () => {
    const { result } = renderHook(() => useOrdenTabla(FILAS, COLUMNAS));
    act(() => result.current.alternar("nombre"));
    act(() => result.current.alternar("nombre"));
    expect(result.current.orden?.direccion).toBe("desc");
    expect(result.current.filasOrdenadas.map((f) => f.nombre)).toEqual(["c", "b", "a"]);
  });
});
