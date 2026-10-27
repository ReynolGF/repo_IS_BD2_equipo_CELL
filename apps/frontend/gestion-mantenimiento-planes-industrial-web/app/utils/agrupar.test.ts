/**
 * Pruebas de las funciones que preparan datos para gráficos y resúmenes.
 */
import { describe, expect, it } from "vitest";
import type { FilaDesempeno, TareaEjecutada } from "../types/reporte";
import {
  ejecucionesPorSistema,
  rendimientoPorLinea,
  resumenPorCriticidad,
  tasasPorOperario,
} from "./agrupar";

/** Crea una fila de desempeño mínima para las pruebas. */
function fila(
  operario: string,
  criticidad: FilaDesempeno["criticidad"],
  asignadas: number,
  cumplidas: number,
): FilaDesempeno {
  return {
    operario_id: operario.length,
    operario,
    turno: "mañana",
    criticidad,
    tareas_asignadas: asignadas,
    tareas_cumplidas: cumplidas,
    tasa_cumplimiento: (cumplidas / asignadas) * 100,
  };
}

describe("ejecucionesPorSistema", () => {
  it("suma las ejecuciones por sistema separadas por criticidad", () => {
    const tareas: TareaEjecutada[] = [
      { tarea_id: 1, tarea: "A", sistema: "Bomba", criticidad: "alta", ejecuciones: 8 },
      { tarea_id: 2, tarea: "B", sistema: "Bomba", criticidad: "alta", ejecuciones: 6 },
      { tarea_id: 3, tarea: "C", sistema: "Bomba", criticidad: "baja", ejecuciones: 4 },
      { tarea_id: 4, tarea: "D", sistema: "Cinta", criticidad: "media", ejecuciones: 5 },
    ];
    expect(ejecucionesPorSistema(tareas)).toEqual([
      { etiqueta: "Bomba", baja: 4, media: 0, alta: 14 },
      { etiqueta: "Cinta", baja: 0, media: 5, alta: 0 },
    ]);
  });

  it("devuelve una lista vacía si no hay tareas", () => {
    expect(ejecucionesPorSistema([])).toEqual([]);
  });
});

describe("tasasPorOperario", () => {
  it("agrupa las tasas de cada operario por criticidad", () => {
    const resultado = tasasPorOperario([
      fila("Ana", "alta", 10, 9),
      fila("Ana", "baja", 10, 10),
      fila("Luis", "alta", 10, 5),
    ]);
    expect(resultado).toEqual([
      { etiqueta: "Ana", baja: 100, media: 0, alta: 90 },
      { etiqueta: "Luis", baja: 0, media: 0, alta: 50 },
    ]);
  });
});

describe("resumenPorCriticidad", () => {
  it("calcula la tasa global con totales, no con el promedio de tasas", () => {
    // Ana 1/2 = 50 % y Luis 9/10 = 90 %: promedio de tasas = 70 %,
    // pero la tasa global correcta es 10/12 = 83,3 %.
    const resumen = resumenPorCriticidad([
      fila("Ana", "alta", 2, 1),
      fila("Luis", "alta", 10, 9),
    ]);
    const alta = resumen.find((r) => r.criticidad === "alta");
    expect(alta).toEqual({ criticidad: "alta", asignadas: 12, cumplidas: 10, tasa: 83.3 });
  });

  it("devuelve siempre las tres criticidades, con tasa 0 si no hay tareas", () => {
    const resumen = resumenPorCriticidad([fila("Ana", "alta", 4, 4)]);
    expect(resumen.map((r) => r.criticidad)).toEqual(["baja", "media", "alta"]);
    expect(resumen[0]).toEqual({ criticidad: "baja", asignadas: 0, cumplidas: 0, tasa: 0 });
  });
});

describe("rendimientoPorLinea", () => {
  it("convierte la correlación de cada línea en un grupo de barras", () => {
    const resultado = rendimientoPorLinea([
      {
        linea_id: 1,
        linea: "Embotellado",
        rendimiento: [
          { criticidad: "baja", rendimiento_promedio: 94 },
          { criticidad: "alta", rendimiento_promedio: 72 },
        ],
        coeficiente_correlacion: -0.9,
      },
    ]);
    expect(resultado).toEqual([{ etiqueta: "Embotellado", baja: 94, media: 0, alta: 72 }]);
  });
});
