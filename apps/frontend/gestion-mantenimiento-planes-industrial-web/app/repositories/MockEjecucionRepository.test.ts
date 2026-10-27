/**
 * Pruebas del repositorio simulado de ejecución y reinspecciones.
 *
 * Los datos salen de `app/data/demoData.ts` (vía `app/mocks/desdeDemo.ts`):
 * - Plan 18 (Envasado A, en ejecución): operaria Ana Gómez (id 1) con 2 tareas
 *   cumplidas (1 y 2) y 2 pendientes (8 y 9).
 * - Plan 17 (Llenado 02, aprobado): operaria Sofía Díaz (id 3); la tarea 4
 *   quedó incumplida y las tareas 3, 5 y 12 siguen pendientes.
 * - Plan 16 (Servicios, finalizado): operario Carlos Vega (id 4).
 * - Solicitudes pendientes: 1 (plan 18, Laura Méndez) y 3 (plan 17, Daniel Pérez).
 *
 * Cada prueba crea su propia instancia (con latencia 0), así que los cambios
 * de una no afectan a las demás.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { RecursoNoEncontradoError, ReglaDeNegocioError } from "./EjecucionRepository";
import { MockEjecucionRepository } from "./MockEjecucionRepository";
import { PlanNoEncontradoError } from "./ReporteRepository";

let repo: MockEjecucionRepository;

beforeEach(() => {
  repo = new MockEjecucionRepository(0);
});

describe("datos compartidos con el resto de la aplicación", () => {
  it("los operarios y técnicos son los de la capa de datos de Reynol", async () => {
    const operarios = await repo.listarOperarios();
    expect(operarios.map((o) => o.nombre)).toContain("Ana Gómez");
    expect(operarios.find((o) => o.id === 2)).toMatchObject({
      nombre: "Luis Torres",
      turno: "tarde",
      lineas: ["Envasado A", "Llenado 02"],
    });
    const tecnicos = await repo.listarTecnicos();
    expect(tecnicos.map((t) => t.nombre)).toEqual([
      "Laura Méndez",
      "Daniel Pérez",
      "Marco Ruiz",
      "Elena Ríos",
    ]);
  });

  it("solo se ejecutan los planes aprobados, en ejecución o finalizados", async () => {
    const planes = await repo.listarPlanesEnEjecucion();
    expect(planes.map((p) => p.id)).toEqual([18, 17, 16]);
  });
});

describe("consulta de planes del operario (T17)", () => {
  it("devuelve solo los planes donde el operario tiene tareas", async () => {
    const planes = await repo.listarPlanesDeOperario(1);
    expect(planes.map((p) => p.plan_id)).toEqual([18]);
  });

  it("un operario sin tareas asignadas recibe una lista vacía", async () => {
    expect(await repo.listarPlanesDeOperario(6)).toEqual([]);
  });

  it("falla si el operario no existe", async () => {
    await expect(repo.listarPlanesDeOperario(99)).rejects.toBeInstanceOf(RecursoNoEncontradoError);
  });

  it("devuelve copias: modificarlas no cambia los datos del repositorio", async () => {
    const [plan] = await repo.listarPlanesDeOperario(1);
    plan.tareas[0].estado = "pendiente";
    const [otraVez] = await repo.listarPlanesDeOperario(1);
    expect(otraVez.tareas[0].estado).toBe("cumplida");
  });
});

describe("estado de un plan (T19)", () => {
  it("devuelve el plan con sus tareas y sus estados", async () => {
    const plan = await repo.obtenerEstadoPlan(18);
    expect(plan.tareas.map((t) => t.estado)).toEqual(["cumplida", "cumplida", "pendiente", "pendiente"]);
  });

  it("una intervención que pidió reinspección deja la tarea como incumplida", async () => {
    const plan = await repo.obtenerEstadoPlan(17);
    expect(plan.tareas.find((t) => t.tarea_id === 4)?.estado).toBe("incumplida");
  });

  it("falla si el plan no existe", async () => {
    await expect(repo.obtenerEstadoPlan(99)).rejects.toBeInstanceOf(PlanNoEncontradoError);
  });
});

describe("registro de intervenciones (T18)", () => {
  it("guarda la intervención, actualiza la tarea y la deja primera en el historial", async () => {
    const creada = await repo.registrarIntervencion({
      plan_id: 18,
      tarea_id: 8,
      operario_id: 1,
      resultado: "cumplida",
      observaciones: "Banda sustituida y probada.",
    });
    expect(creada.id).toBe(5);
    expect(creada.operario).toBe("Ana Gómez");
    expect(creada.linea).toBe("Envasado A");

    const plan = await repo.obtenerEstadoPlan(18);
    expect(plan.tareas.find((t) => t.tarea_id === 8)?.estado).toBe("cumplida");
    expect(plan.estado).toBe("en_ejecucion");
    const historial = await repo.listarIntervenciones(18);
    expect(historial[0].id).toBe(5);
  });

  it("el plan pasa a finalizado al intervenir su última tarea pendiente", async () => {
    await repo.registrarIntervencion({
      plan_id: 18,
      tarea_id: 8,
      operario_id: 1,
      resultado: "cumplida",
      observaciones: "Banda sustituida y probada.",
    });
    await repo.registrarIntervencion({
      plan_id: 18,
      tarea_id: 9,
      operario_id: 1,
      resultado: "incumplida",
      observaciones: "Sensor sin repuesto disponible.",
    });
    expect((await repo.obtenerEstadoPlan(18)).estado).toBe("finalizado");
  });

  it("el plan aprobado pasa a en ejecución con su primera intervención", async () => {
    expect((await repo.obtenerEstadoPlan(17)).estado).toBe("aprobado");
    await repo.registrarIntervencion({
      plan_id: 17,
      tarea_id: 3,
      operario_id: 3,
      resultado: "cumplida",
      observaciones: "Válvula ajustada a 6 bar.",
    });
    expect((await repo.obtenerEstadoPlan(17)).estado).toBe("en_ejecucion");
  });

  it("una tarea incumplida admite una nueva intervención", async () => {
    const creada = await repo.registrarIntervencion({
      plan_id: 17,
      tarea_id: 4,
      operario_id: 3,
      resultado: "cumplida",
      observaciones: "Vibración corregida.",
    });
    expect(creada.resultado).toBe("cumplida");
  });

  it("rechaza observaciones demasiado cortas", async () => {
    await expect(
      repo.registrarIntervencion({ plan_id: 18, tarea_id: 8, operario_id: 1, resultado: "cumplida", observaciones: "ok" }),
    ).rejects.toBeInstanceOf(ReglaDeNegocioError);
  });

  it("rechaza una tarea ya cumplida", async () => {
    await expect(
      repo.registrarIntervencion({ plan_id: 18, tarea_id: 1, operario_id: 1, resultado: "cumplida", observaciones: "Otra vez revisada." }),
    ).rejects.toThrow("ya fue cumplida");
  });

  it("rechaza que otro operario intervenga la tarea", async () => {
    await expect(
      repo.registrarIntervencion({ plan_id: 18, tarea_id: 8, operario_id: 2, resultado: "cumplida", observaciones: "Intento ajeno." }),
    ).rejects.toThrow("otro operario");
  });

  it("falla si el plan o la tarea no existen", async () => {
    await expect(
      repo.registrarIntervencion({ plan_id: 99, tarea_id: 8, operario_id: 1, resultado: "cumplida", observaciones: "Plan inexistente." }),
    ).rejects.toBeInstanceOf(PlanNoEncontradoError);
    await expect(
      repo.registrarIntervencion({ plan_id: 18, tarea_id: 99, operario_id: 1, resultado: "cumplida", observaciones: "Tarea inexistente." }),
    ).rejects.toBeInstanceOf(RecursoNoEncontradoError);
  });

  it("el historial va de la intervención más reciente a la más antigua", async () => {
    const fechas = (await repo.listarIntervenciones()).map((i) => i.fecha);
    expect(fechas).toEqual([...fechas].sort().reverse());
  });
});

describe("solicitud de reinspección (T20)", () => {
  it("crea una solicitud pendiente asignada al técnico que creó el plan", async () => {
    const solicitud = await repo.solicitarReinspeccion({
      intervencion_id: 2,
      motivo: "Vibración anormal después de la revisión.",
      tecnico_apoyo_id: null,
    });
    expect(solicitud.estado).toBe("pendiente");
    expect(solicitud.tecnico_asignado).toBe("Laura Méndez");
    expect(solicitud.linea).toBe("Envasado A");
    expect(solicitud.tecnico_apoyo).toBeNull();
  });

  it("permite pedir un técnico de apoyo al crearla", async () => {
    const solicitud = await repo.solicitarReinspeccion({
      intervencion_id: 2,
      motivo: "Necesito segunda opinión.",
      tecnico_apoyo_id: 2,
    });
    expect(solicitud.tecnico_apoyo).toBe("Daniel Pérez");
  });

  it("rechaza un motivo corto", async () => {
    await expect(
      repo.solicitarReinspeccion({ intervencion_id: 2, motivo: "no", tecnico_apoyo_id: null }),
    ).rejects.toBeInstanceOf(ReglaDeNegocioError);
  });

  it("rechaza una segunda solicitud pendiente para la misma intervención", async () => {
    await expect(
      repo.solicitarReinspeccion({ intervencion_id: 1, motivo: "Otra vez lo mismo.", tecnico_apoyo_id: null }),
    ).rejects.toThrow("Ya hay una reinspección pendiente");
  });

  it("falla si la intervención o el técnico no existen", async () => {
    await expect(
      repo.solicitarReinspeccion({ intervencion_id: 99, motivo: "Intervención inexistente.", tecnico_apoyo_id: null }),
    ).rejects.toBeInstanceOf(RecursoNoEncontradoError);
    await expect(
      repo.solicitarReinspeccion({ intervencion_id: 2, motivo: "Técnico inexistente.", tecnico_apoyo_id: 99 }),
    ).rejects.toBeInstanceOf(RecursoNoEncontradoError);
  });

  it("asigna un técnico de apoyo a una solicitud pendiente", async () => {
    const solicitud = await repo.asignarApoyo(1, 3);
    expect(solicitud.tecnico_apoyo).toBe("Marco Ruiz");
  });

  it("no asigna apoyo a una solicitud completada", async () => {
    await repo.registrarReinspeccion(1, { participantes: ["Laura Méndez"], observaciones: "Todo en orden.", resultado: "conforme" });
    await expect(repo.asignarApoyo(1, 3)).rejects.toBeInstanceOf(ReglaDeNegocioError);
  });
});

describe("registro de la reinspección manual (T21)", () => {
  it("guarda participantes, observaciones y resultado y cierra la solicitud", async () => {
    const solicitud = await repo.registrarReinspeccion(1, {
      participantes: ["Laura Méndez", "Ana Gómez"],
      observaciones: "Sello reemplazado y revisado.",
      resultado: "conforme",
    });
    expect(solicitud.estado).toBe("completada");
    expect(solicitud.reinspeccion?.participantes).toEqual(["Laura Méndez", "Ana Gómez"]);
    expect(solicitud.reinspeccion?.resultado).toBe("conforme");
    expect(solicitud.reinspeccion?.fecha).toBeTruthy();
  });

  it("conserva el vínculo con la solicitud original", async () => {
    const solicitud = await repo.registrarReinspeccion(3, {
      participantes: ["Daniel Pérez"],
      observaciones: "Sigue vibrando.",
      resultado: "no_conforme",
    });
    expect(solicitud.intervencion_id).toBe(3);
    expect(solicitud.motivo).toContain("Vibración");
  });

  it("rechaza datos incompletos y no cierra la solicitud", async () => {
    await expect(
      repo.registrarReinspeccion(1, { participantes: [], observaciones: "Sin participantes.", resultado: "conforme" }),
    ).rejects.toBeInstanceOf(ReglaDeNegocioError);
    const [solicitud] = await repo.listarSolicitudesReinspeccion();
    expect(solicitud.estado).toBe("pendiente");
  });

  it("no permite registrar dos veces la misma reinspección", async () => {
    const datos = { participantes: ["Laura Méndez"], observaciones: "Revisión completa.", resultado: "conforme" as const };
    await repo.registrarReinspeccion(1, datos);
    await expect(repo.registrarReinspeccion(1, datos)).rejects.toThrow("ya fue completada");
  });

  it("falla si la solicitud no existe", async () => {
    await expect(
      repo.registrarReinspeccion(99, { participantes: ["Ana"], observaciones: "Solicitud inexistente.", resultado: "conforme" }),
    ).rejects.toBeInstanceOf(RecursoNoEncontradoError);
  });

  it("las solicitudes pendientes aparecen antes que las completadas", async () => {
    const nueva = await repo.solicitarReinspeccion({ intervencion_id: 2, motivo: "Revisión adicional.", tecnico_apoyo_id: null });
    await repo.registrarReinspeccion(1, { participantes: ["Laura Méndez"], observaciones: "Revisión completa.", resultado: "conforme" });
    const lista = await repo.listarSolicitudesReinspeccion();
    expect(lista.map((s) => s.id)).toEqual([nueva.id, 3, 1]);
  });
});
