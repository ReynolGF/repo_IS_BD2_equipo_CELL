/**
 * Pruebas del repositorio de datos simulados. Verifican también que los
 * datos respetan las reglas del contrato de la API.
 */
import { describe, expect, it } from "vitest";
import { MockReporteRepository } from "./MockReporteRepository";
import { LineaNoEncontradaError, PlanNoEncontradoError } from "./ReporteRepository";

/** Repositorio sin retardo para que las pruebas sean rápidas. */
const repositorio = new MockReporteRepository(0);

describe("funcionalidad 2: tareas más ejecutadas", () => {
  it("lista las líneas disponibles", async () => {
    const lineas = await repositorio.listarLineas();
    expect(lineas.map((l) => l.nombre)).toEqual(["Envasado A", "Llenado 02", "Servicios"]);
  });

  it("ordena de mayor a menor y, en empate, por nombre (RF-2.5, CA-3, CA-4)", async () => {
    const { tareas } = await repositorio.obtenerTareasMasEjecutadas(1);
    for (let i = 1; i < tareas.length; i++) {
      const anterior = tareas[i - 1];
      const actual = tareas[i];
      expect(anterior.ejecuciones).toBeGreaterThanOrEqual(actual.ejecuciones);
      if (anterior.ejecuciones === actual.ejecuciones) {
        expect(anterior.tarea.localeCompare(actual.tarea, "es")).toBeLessThan(0);
      }
    }
  });

  it("nunca incluye tareas sin ejecuciones (D5, CA-5)", async () => {
    const { tareas } = await repositorio.obtenerTareasMasEjecutadas(1);
    expect(tareas.every((t) => t.ejecuciones > 0)).toBe(true);
  });

  it("cada línea del selector trae al menos una tarea ejecutada", async () => {
    for (const linea of await repositorio.listarLineas()) {
      const { tareas } = await repositorio.obtenerTareasMasEjecutadas(linea.id);
      expect(tareas.length, linea.nombre).toBeGreaterThan(0);
    }
  });

  it("usa las ejecuciones del banco de tareas de la capa de datos", async () => {
    const { tareas } = await repositorio.obtenerTareasMasEjecutadas(1);
    expect(tareas[0]).toMatchObject({ tarea: "Lubricar rodamiento", ejecuciones: 42 });
  });

  it("lanza LineaNoEncontradaError para una línea inexistente (CA-8)", async () => {
    await expect(repositorio.obtenerTareasMasEjecutadas(99)).rejects.toBeInstanceOf(
      LineaNoEncontradaError,
    );
  });

  it("entrega copias: modificar el resultado no altera los datos", async () => {
    const primero = await repositorio.obtenerTareasMasEjecutadas(1);
    primero.tareas.length = 0;
    const segundo = await repositorio.obtenerTareasMasEjecutadas(1);
    expect(segundo.tareas.length).toBeGreaterThan(0);
  });
});

describe("funcionalidad 4: desempeño de operarios", () => {
  it("lista los planes disponibles", async () => {
    const planes = await repositorio.listarPlanes();
    expect(planes).toHaveLength(6);
  });

  it("la tasa de cada fila coincide con cumplidas entre asignadas", async () => {
    const { filas } = await repositorio.obtenerDesempenoOperarios(18);
    for (const f of filas) {
      const esperada = Math.round((f.tareas_cumplidas / f.tareas_asignadas) * 1000) / 10;
      expect(f.tasa_cumplimiento).toBe(esperada);
      expect(f.tareas_cumplidas).toBeLessThanOrEqual(f.tareas_asignadas);
    }
  });

  it("cada operario aparece con las tres criticidades", async () => {
    const { filas } = await repositorio.obtenerDesempenoOperarios(18);
    const operarios = new Set(filas.map((f) => f.operario_id));
    expect(filas).toHaveLength(operarios.size * 3);
  });

  it("devuelve lista vacía para un plan que aún no tiene operarios asignados", async () => {
    const reporte = await repositorio.obtenerDesempenoOperarios(15);
    expect(reporte.filas).toEqual([]);
  });

  it("lanza PlanNoEncontradoError para un plan inexistente", async () => {
    await expect(repositorio.obtenerDesempenoOperarios(99)).rejects.toBeInstanceOf(
      PlanNoEncontradoError,
    );
  });
});

describe("funcionalidad 6: análisis de cumplimiento", () => {
  it("devuelve exactamente las 10 tareas más incumplidas, de mayor a menor", async () => {
    const { tareas_mayor_incumplimiento: tareas } =
      await repositorio.obtenerAnalisisCumplimiento();
    expect(tareas).toHaveLength(10);
    for (let i = 1; i < tareas.length; i++) {
      expect(tareas[i - 1].tasa_incumplimiento).toBeGreaterThanOrEqual(
        tareas[i].tasa_incumplimiento,
      );
    }
  });

  it("cada tarea trae su técnico creador y su línea", async () => {
    const { tareas_mayor_incumplimiento: tareas } =
      await repositorio.obtenerAnalisisCumplimiento();
    expect(tareas.every((t) => t.tecnico_creador && t.linea)).toBe(true);
  });

  it("la diferencia de reinspecciones es operario menos promedio del turno", async () => {
    const { reinspecciones } = await repositorio.obtenerAnalisisCumplimiento();
    for (const r of reinspecciones) {
      const esperada = Math.round((r.tasa_operario - r.tasa_promedio_turno) * 10) / 10;
      expect(r.diferencia).toBe(esperada);
    }
  });

  it("cada línea ordena sus criticidades de menor a mayor y trae un coeficiente entre -1 y 1", async () => {
    const { correlacion_por_linea: lineas } = await repositorio.obtenerAnalisisCumplimiento();
    const orden = ["baja", "media", "alta"];
    for (const l of lineas) {
      const posiciones = l.rendimiento.map((r) => orden.indexOf(r.criticidad));
      expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));
      expect(Math.abs(l.coeficiente_correlacion)).toBeLessThanOrEqual(1);
    }
  });

  it("una línea cuyo rendimiento crece con la criticidad tiene correlación positiva", async () => {
    const { correlacion_por_linea: lineas } = await repositorio.obtenerAnalisisCumplimiento();
    expect(lineas.find((l) => l.linea === "Envasado A")?.coeficiente_correlacion).toBe(1);
  });
});
