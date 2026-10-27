/**
 * Pruebas de las utilidades de operación: avance de planes, validación de
 * formularios, lectura de campos y filtros de sensores.
 */
import { describe, expect, it } from "vitest";
import { distribucionLineasMock } from "../mocks/distribucionLineas";
import { planesAsignadosMock } from "../mocks/ejecucion";
import type { TareaAsignada } from "../types/operacion";
import { formatoFechaHora } from "./formato";
import { leerEntero, leerNumero, leerTexto } from "./formulario";
import {
  estadoSegunTareas,
  progresoDePlan,
  progresoDeTareas,
  tareasPorCriticidadYEstado,
  tareasPorLineaYCriticidad,
} from "./progreso";
import { formatoLectura, leerFiltroSensores } from "./sensores";
import {
  LARGO_MAXIMO_TEXTO,
  separarParticipantes,
  validarRegistroReinspeccion,
  validarTextoObligatorio,
} from "./validacion";

/** Plan 18 (Envasado A): 2 tareas cumplidas y 2 pendientes. */
const PLAN_1 = planesAsignadosMock[0];

/** Crea una tarea mínima con el estado dado. */
function tarea(estado: TareaAsignada["estado"]): TareaAsignada {
  return {
    tarea_id: 1,
    tarea: "T",
    sistema: "S",
    criticidad: "media",
    estado,
    operario_id: 1,
    operario: "Ana",
  };
}

describe("progresoDePlan", () => {
  it("cuenta las tareas por estado y calcula los porcentajes", () => {
    expect(progresoDePlan(PLAN_1)).toEqual({
      total: 4,
      cumplidas: 2,
      incumplidas: 0,
      pendientes: 2,
      avance: 50,
      cumplimiento: 100,
    });
  });

  it("cuenta también las tareas incumplidas (plan 17 de Llenado 02)", () => {
    const plan17 = planesAsignadosMock[1];
    expect(progresoDePlan(plan17)).toMatchObject({
      total: 4,
      cumplidas: 0,
      incumplidas: 1,
      pendientes: 3,
      avance: 25,
      cumplimiento: 0,
    });
  });

  it("devuelve ceros si no hay tareas (sin dividir entre cero)", () => {
    expect(progresoDeTareas([])).toEqual({
      total: 0,
      cumplidas: 0,
      incumplidas: 0,
      pendientes: 0,
      avance: 0,
      cumplimiento: 0,
    });
  });

  it("el cumplimiento es 0 mientras no se haya intervenido ninguna tarea", () => {
    const progreso = progresoDeTareas([tarea("pendiente"), tarea("pendiente")]);
    expect(progreso.avance).toBe(0);
    expect(progreso.cumplimiento).toBe(0);
  });
});

describe("estadoSegunTareas", () => {
  it("sin intervenciones el plan sigue aprobado", () => {
    expect(estadoSegunTareas([tarea("pendiente")])).toBe("aprobado");
  });

  it("con intervenciones y tareas pendientes está en ejecución", () => {
    expect(estadoSegunTareas([tarea("cumplida"), tarea("pendiente")])).toBe("en_ejecucion");
  });

  it("sin tareas pendientes queda finalizado", () => {
    expect(estadoSegunTareas([tarea("cumplida"), tarea("incumplida")])).toBe("finalizado");
  });

  it("un plan sin tareas no se considera finalizado", () => {
    expect(estadoSegunTareas([])).toBe("aprobado");
  });
});

describe("tareasPorCriticidadYEstado", () => {
  it("devuelve las tres criticidades de menor a mayor con su conteo", () => {
    expect(tareasPorCriticidadYEstado(PLAN_1.tareas)).toEqual([
      { etiqueta: "Baja", cumplida: 0, incumplida: 0, pendiente: 1 },
      { etiqueta: "Media", cumplida: 1, incumplida: 0, pendiente: 1 },
      { etiqueta: "Alta", cumplida: 1, incumplida: 0, pendiente: 0 },
    ]);
  });
});

describe("tareasPorLineaYCriticidad", () => {
  it("suma las tareas de todos los sistemas de cada línea", () => {
    const datos = tareasPorLineaYCriticidad(distribucionLineasMock.filas);
    expect(datos).toEqual([
      { etiqueta: "Envasado A", baja: 1, media: 2, alta: 2 },
      { etiqueta: "Llenado 02", baja: 1, media: 0, alta: 3 },
      { etiqueta: "Servicios", baja: 1, media: 3, alta: 1 },
    ]);
  });

  it("sin filas devuelve una lista vacía", () => {
    expect(tareasPorLineaYCriticidad([])).toEqual([]);
  });
});

describe("validarTextoObligatorio", () => {
  it("acepta un texto con el largo mínimo", () => {
    expect(validarTextoObligatorio("abcde", "El motivo")).toBeNull();
  });

  it("rechaza un texto demasiado corto", () => {
    expect(validarTextoObligatorio("abcd", "El motivo")).toBe(
      "El motivo debe tener al menos 5 caracteres.",
    );
  });

  it("no cuenta los espacios de los extremos", () => {
    expect(validarTextoObligatorio("   ab   ", "El motivo")).not.toBeNull();
  });

  it("rechaza un texto demasiado largo", () => {
    const largo = "a".repeat(LARGO_MAXIMO_TEXTO + 1);
    expect(validarTextoObligatorio(largo, "El motivo")).toContain("no puede superar");
  });
});

describe("separarParticipantes", () => {
  it("separa por comas, recorta espacios y descarta vacíos", () => {
    expect(separarParticipantes(" Ana , Luis ,, ")).toEqual(["Ana", "Luis"]);
  });

  it("elimina repetidos sin distinguir mayúsculas", () => {
    expect(separarParticipantes("Ana, ana, ANA, Luis")).toEqual(["Ana", "Luis"]);
  });

  it("un texto vacío da una lista vacía", () => {
    expect(separarParticipantes("")).toEqual([]);
  });
});

describe("validarRegistroReinspeccion", () => {
  it("exige al menos un participante", () => {
    expect(validarRegistroReinspeccion([], "Observaciones válidas")).toContain("participante");
  });

  it("exige observaciones", () => {
    expect(validarRegistroReinspeccion(["Ana"], "ok")).toContain("observaciones");
  });

  it("acepta datos completos", () => {
    expect(validarRegistroReinspeccion(["Ana"], "Todo en orden")).toBeNull();
  });
});

describe("lectura de formularios", () => {
  const datos = new FormData();
  datos.set("texto", "hola");
  datos.set("numero", "42");
  datos.set("decimal", "4.5");
  datos.set("vacio", "");

  it("leerTexto devuelve el texto o cadena vacía si falta", () => {
    expect(leerTexto(datos, "texto")).toBe("hola");
    expect(leerTexto(datos, "no_existe")).toBe("");
  });

  it("leerNumero devuelve enteros y null para lo demás", () => {
    expect(leerNumero(datos, "numero")).toBe(42);
    expect(leerNumero(datos, "decimal")).toBeNull();
    expect(leerNumero(datos, "vacio")).toBeNull();
    expect(leerNumero(datos, "texto")).toBeNull();
  });

  it("leerEntero acepta solo enteros positivos", () => {
    expect(leerEntero("3")).toBe(3);
    expect(leerEntero("0")).toBeNull();
    expect(leerEntero("-2")).toBeNull();
    expect(leerEntero("abc")).toBeNull();
    expect(leerEntero(null)).toBeNull();
    expect(leerEntero("  ")).toBeNull();
  });
});

describe("leerFiltroSensores", () => {
  it("lee línea, equipo y periodo de la dirección", () => {
    const filtro = leerFiltroSensores(new URLSearchParams("linea=1&equipo=2&periodo=7d"));
    expect(filtro).toEqual({ lineaId: 1, equipoId: 2, periodo: "7d" });
  });

  it("ignora valores inválidos y usa el periodo por defecto", () => {
    const filtro = leerFiltroSensores(new URLSearchParams("linea=abc&equipo=-1&periodo=1y"));
    expect(filtro).toEqual({ lineaId: null, equipoId: null, periodo: "24h" });
  });

  it("sin parámetros no filtra por línea ni equipo", () => {
    expect(leerFiltroSensores(new URLSearchParams())).toEqual({
      lineaId: null,
      equipoId: null,
      periodo: "24h",
    });
  });
});

describe("formatos de sensores y fechas", () => {
  it("formatoLectura agrega la unidad", () => {
    expect(formatoLectura(72, "°C")).toBe("72 °C");
    expect(formatoLectura(6.1, "bar")).toMatch(/^6[.,]1 bar$/);
  });

  it("formatoFechaHora muestra día, mes, año y hora", () => {
    expect(formatoFechaHora("2026-10-26T08:15:00")).toBe("26/10/2026 08:15");
  });
});
