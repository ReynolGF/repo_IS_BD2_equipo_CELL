/**
 * Pruebas de que los datos simulados de mis pantallas son los mismos que usa
 * el resto de la aplicación (`app/data/demoData.ts`): nombres, líneas,
 * planes y estados coinciden, solo cambia la forma (ids numéricos, snake_case).
 */
import { describe, expect, it } from "vitest";
import { demoData } from "../data/demoData";
import { analisisCumplimientoMock } from "./analisisCumplimiento";
import { criticidadDe, idNumerico, lineasDemo, operariosDemo, planesAsignadosDemo, tecnicosDemo } from "./desdeDemo";
import { desempenoMock, planesMock } from "./desempenoOperarios";
import { equiposMock } from "./sensores";
import { reportesMock } from "./tareasMasEjecutadas";

describe("conversiones", () => {
  it("idNumerico toma el número final del identificador", () => {
    expect(idNumerico("OP-01")).toBe(1);
    expect(idNumerico("LIN-03")).toBe(3);
    expect(idNumerico("PM-2026-018")).toBe(18);
  });

  it("idNumerico rechaza identificadores sin número", () => {
    expect(() => idNumerico("sin-numero")).toThrow();
  });

  it("criticidadDe pasa la criticidad del dominio a la del contrato", () => {
    expect(criticidadDe("Alta")).toBe("alta");
    expect(criticidadDe("Baja")).toBe("baja");
  });
});

describe("coherencia con demoData", () => {
  it("las líneas, los operarios y los técnicos son los mismos", () => {
    expect(lineasDemo.map((l) => l.nombre)).toEqual(demoData.lines.map((l) => l.name));
    expect(operariosDemo.map((o) => o.nombre)).toEqual(demoData.operators.map((o) => o.name));
    expect(tecnicosDemo.map((t) => t.nombre)).toEqual(demoData.technicians.map((t) => t.name));
  });

  it("los planes del selector de reportes son todos los planes", () => {
    expect(planesMock).toHaveLength(demoData.plans.length);
    expect(planesMock.map((p) => p.nombre)).toEqual(demoData.plans.map((p) => p.name));
  });

  it("solo se ejecutan los planes aprobados, en ejecución o finalizados", () => {
    const aprobados = demoData.plans.filter((p) => ["Aprobado", "En ejecución", "Finalizado"].includes(p.status));
    expect(planesAsignadosDemo).toHaveLength(aprobados.length);
  });

  it("cada tarea de un plan conserva su operario, su sistema y su criticidad", () => {
    const plan = planesAsignadosDemo.find((p) => p.plan_id === 18)!;
    const origen = demoData.plans.find((p) => p.id === "PM-2026-018")!;
    expect(plan.tareas.map((t) => [t.tarea, t.sistema, t.operario])).toEqual(
      origen.tasks.map((t) => [t.name, t.system, t.operator]),
    );
  });

  it("los equipos son los de las líneas", () => {
    expect(equiposMock.map((e) => e.nombre)).toEqual(
      demoData.lines.flatMap((l) => l.equipment.map((e) => e.name)),
    );
  });
});

describe("reportes derivados", () => {
  it("las ejecuciones de cada línea salen del banco de tareas", () => {
    for (const linea of lineasDemo) {
      const esperadas = demoData.tasks
        .filter((t) => t.line === linea.nombre)
        .reduce((suma, t) => suma + t.timesExecuted, 0);
      const obtenidas = reportesMock[linea.id].tareas.reduce((suma, t) => suma + t.ejecuciones, 0);
      expect(obtenidas, linea.nombre).toBe(esperadas);
    }
  });

  it("el desempeño de un plan cuenta las tareas asignadas y cumplidas del plan", () => {
    const filas = desempenoMock[18].filas;
    expect(filas.reduce((s, f) => s + f.tareas_asignadas, 0)).toBe(4);
    expect(filas.reduce((s, f) => s + f.tareas_cumplidas, 0)).toBe(2);
  });

  it("los planes sin operario no tienen filas de desempeño", () => {
    expect([15, 14, 13].map((id) => desempenoMock[id].filas.length)).toEqual([0, 0, 0]);
  });

  it("el análisis incluye a los operarios que pidieron reinspección", () => {
    const nombres = analisisCumplimientoMock.reinspecciones.map((r) => r.operario);
    expect(nombres).toEqual(["Ana Gómez", "Sofía Díaz"]);
  });

  it("el análisis lista siempre las 10 tareas con mayor incumplimiento", () => {
    expect(analisisCumplimientoMock.tareas_mayor_incumplimiento).toHaveLength(10);
  });
});
