/**
 * Pruebas del repositorio simulado de sensores y del repositorio de reportes
 * en lo que respecta a la distribución entre líneas.
 *
 * Los equipos son los 12 de las líneas de `app/data/demoData.ts`: la línea 1
 * (Envasado A) tiene los equipos 1 a 4, la 2 (Llenado 02) los 5 a 8 y la 3
 * (Servicios) los 9 a 12. Los equipos 3, 7 y 11 son motores y bandas sin
 * sensor de presión.
 */
import { describe, expect, it } from "vitest";
import { MockReporteRepository } from "./MockReporteRepository";
import { MockSensorRepository } from "./MockSensorRepository";

const repo = new MockSensorRepository(0);

describe("análisis de sensores (T23)", () => {
  it("sin filtros agrega los 12 equipos (3 magnitudes con presión, 2 sin ella)", async () => {
    const analisis = await repo.obtenerAnalisis({ lineaId: null, equipoId: null, periodo: "24h" });
    expect(analisis.periodo).toBe("24h");
    expect(analisis.agregados).toHaveLength(9 * 3 + 3 * 2);
  });

  it("filtra por línea", async () => {
    const analisis = await repo.obtenerAnalisis({ lineaId: 2, equipoId: null, periodo: "24h" });
    expect(new Set(analisis.agregados.map((a) => a.linea))).toEqual(new Set(["Llenado 02"]));
    expect(analisis.agregados).toHaveLength(3 + 3 + 2 + 3);
  });

  it("filtra por equipo", async () => {
    const analisis = await repo.obtenerAnalisis({ lineaId: null, equipoId: 1, periodo: "24h" });
    expect(analisis.agregados.map((a) => a.tipo_sensor)).toEqual(["temperatura", "vibracion", "presion"]);
  });

  it("usa la lectura de la capa de datos cuando el equipo la tiene", async () => {
    const analisis = await repo.obtenerAnalisis({ lineaId: null, equipoId: 1, periodo: "24h" });
    const temperatura = analisis.agregados.find((a) => a.tipo_sensor === "temperatura");
    expect(temperatura?.promedio).toBe(82);
  });

  it("un equipo de otra línea no produce resultados", async () => {
    const analisis = await repo.obtenerAnalisis({ lineaId: 2, equipoId: 1, periodo: "24h" });
    expect(analisis.agregados).toEqual([]);
  });

  it("el mínimo es menor que el promedio y este menor que el máximo", async () => {
    const analisis = await repo.obtenerAnalisis({ lineaId: null, equipoId: null, periodo: "7d" });
    for (const fila of analisis.agregados) {
      expect(fila.minimo).toBeLessThan(fila.promedio);
      expect(fila.promedio).toBeLessThan(fila.maximo);
    }
  });

  it("un periodo más largo tiene más lecturas y más variación", async () => {
    const corto = await repo.obtenerAnalisis({ lineaId: null, equipoId: 1, periodo: "24h" });
    const largo = await repo.obtenerAnalisis({ lineaId: null, equipoId: 1, periodo: "30d" });
    expect(largo.agregados[0].lecturas).toBeGreaterThan(corto.agregados[0].lecturas);
    expect(largo.agregados[0].maximo).toBeGreaterThan(corto.agregados[0].maximo);
  });

  it("lista los equipos para los selectores", async () => {
    const equipos = await repo.listarEquipos();
    expect(equipos).toHaveLength(12);
    expect(equipos[0]).toMatchObject({ id: 1, nombre: "Motor de banda 04", linea: "Envasado A" });
  });
});

describe("estado operativo de los equipos (T24)", () => {
  it("sin línea devuelve todos los equipos", async () => {
    expect(await repo.obtenerEstadoOperativo(null)).toHaveLength(12);
  });

  it("con línea devuelve solo sus equipos", async () => {
    const equipos = await repo.obtenerEstadoOperativo(2);
    expect(equipos.map((e) => e.equipo)).toEqual([
      "Bomba centrífuga 02",
      "Compresor 03",
      "Motor de banda 07",
      "Válvula de presión 01",
    ]);
  });

  it("el estado sale del texto de la capa de datos (Alerta alta, Revisar, Estable)", async () => {
    const equipos = await repo.obtenerEstadoOperativo(null);
    const estado = (nombre: string) => equipos.find((e) => e.equipo === nombre)?.estado;
    expect(estado("Motor de banda 04")).toBe("critico");
    expect(estado("Bomba centrífuga 02")).toBe("alerta");
    expect(estado("Caldera principal")).toBe("normal");
  });

  it("incluye equipos en cada estado", async () => {
    const estados = new Set((await repo.obtenerEstadoOperativo(null)).map((e) => e.estado));
    expect(estados).toEqual(new Set(["normal", "alerta", "critico"]));
  });

  it("una línea sin equipos devuelve lista vacía", async () => {
    expect(await repo.obtenerEstadoOperativo(99)).toEqual([]);
  });
});

describe("distribución de tareas entre líneas (T29)", () => {
  it("devuelve la distribución y el criterio de cada línea", async () => {
    const reporte = await new MockReporteRepository(0).obtenerDistribucionLineas();
    expect(reporte.equilibrio).toHaveLength(3);
    expect(reporte.equilibrio.filter((e) => !e.cumple_criterio).map((e) => e.linea)).toEqual(["Llenado 02"]);
  });

  it("el equilibrio es el promedio del balance de los planes de la línea", async () => {
    const reporte = await new MockReporteRepository(0).obtenerDistribucionLineas();
    const porcentaje = (linea: string) =>
      reporte.equilibrio.find((e) => e.linea === linea)?.porcentaje_equilibrio;
    expect(porcentaje("Envasado A")).toBe(100); // planes con balance 100 y 100
    expect(porcentaje("Llenado 02")).toBe(67); // planes con balance 100 y 33
    expect(porcentaje("Servicios")).toBe(88); // planes con balance 75 y 100
  });

  it("cada línea cumple solo si supera su mínimo exigido", async () => {
    const reporte = await new MockReporteRepository(0).obtenerDistribucionLineas();
    for (const e of reporte.equilibrio) {
      expect(e.cumple_criterio).toBe(e.porcentaje_equilibrio >= e.minimo_requerido);
    }
  });

  it("cuenta las tareas del banco por línea, sistema y criticidad", async () => {
    const { filas } = await new MockReporteRepository(0).obtenerDistribucionLineas();
    const total = filas.reduce((suma, f) => suma + f.tareas, 0);
    expect(total).toBe(14); // las 14 tareas del banco
  });
});
