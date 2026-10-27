/**
 * Pruebas de las reglas de alcance por rol. Usan las cuentas de demostración
 * y los datos simulados compartidos con el resto de la aplicación.
 */
import { describe, expect, it } from "vitest";
import {
  intervencionesMock,
  operariosMock,
  planesAsignadosMock,
  solicitudesMock,
} from "../mocks/ejecucion";
import { usuarioDe } from "../test/sesion";
import {
  SIN_ALCANCE,
  alcanceDeUsuario,
  filtrarPorLinea,
  intervencionVisible,
  lineaVisible,
  operarioVisible,
  planVisible,
  puedeAtenderReinspeccion,
  puedeEjecutar,
  puedeSolicitarReinspeccion,
  solicitudVisible,
  veTodaLaPlanta,
} from "./alcance";

const admin = alcanceDeUsuario(usuarioDe("Administrador"));
const jefe = alcanceDeUsuario(usuarioDe("Jefe de planta"));
const tecnica = alcanceDeUsuario(usuarioDe("Técnico")); // Envasado A y Llenado 02
const operaria = alcanceDeUsuario(usuarioDe("Operario")); // Ana Gómez, Envasado A

const plan = (id: number) => planesAsignadosMock.find((p) => p.plan_id === id)!;
const operario = (id: number) => operariosMock.find((o) => o.id === id)!;

describe("alcanceDeUsuario", () => {
  it("toma el rol, el nombre y las líneas de la sesión", () => {
    expect(tecnica).toEqual({ rol: "Técnico", nombre: "Laura Méndez", lineas: ["Envasado A", "Llenado 02"] });
  });

  it("sin sesión no hay alcance", () => {
    expect(alcanceDeUsuario(null)).toBe(SIN_ALCANCE);
    expect(lineaVisible(SIN_ALCANCE, "Envasado A")).toBe(false);
    expect(puedeEjecutar(SIN_ALCANCE)).toBe(false);
  });
});

describe("líneas", () => {
  it("el administrador y el jefe ven toda la planta", () => {
    expect(veTodaLaPlanta(admin)).toBe(true);
    expect(veTodaLaPlanta(jefe)).toBe(true);
    expect(lineaVisible(jefe, "Servicios")).toBe(true);
  });

  it("el técnico y el operario solo ven sus líneas", () => {
    expect(lineaVisible(tecnica, "Llenado 02")).toBe(true);
    expect(lineaVisible(tecnica, "Servicios")).toBe(false);
    expect(lineaVisible(operaria, "Envasado A")).toBe(true);
    expect(lineaVisible(operaria, "Llenado 02")).toBe(false);
  });

  it("compara sin distinguir mayúsculas ni acentos", () => {
    const alcance = { rol: "Técnico" as const, nombre: "T", lineas: ["Envasado A"] };
    expect(lineaVisible(alcance, "  envasado a ")).toBe(true);
  });

  it("filtrarPorLinea deja solo los elementos visibles", () => {
    const filas = [{ linea: "Envasado A" }, { linea: "Servicios" }, { linea: "Llenado 02" }];
    expect(filtrarPorLinea(tecnica, filas, (f) => f.linea).map((f) => f.linea)).toEqual([
      "Envasado A",
      "Llenado 02",
    ]);
    expect(filtrarPorLinea(admin, filas, (f) => f.linea)).toHaveLength(3);
  });
});

describe("planes", () => {
  it("el técnico ve los planes de sus líneas", () => {
    expect(planVisible(tecnica, plan(18))).toBe(true);
    expect(planVisible(tecnica, plan(17))).toBe(true);
    expect(planVisible(tecnica, plan(16))).toBe(false);
  });

  it("el operario solo ve los planes donde tiene tareas", () => {
    expect(planVisible(operaria, plan(18))).toBe(true);
    expect(planVisible(operaria, plan(17))).toBe(false);
  });

  it("el administrador y el jefe ven todos", () => {
    expect(planesAsignadosMock.every((p) => planVisible(admin, p) && planVisible(jefe, p))).toBe(true);
  });
});

describe("operarios, intervenciones y solicitudes", () => {
  it("el técnico ve a los operarios de sus líneas, no a los de otras", () => {
    expect(operarioVisible(tecnica, operario(1))).toBe(true); // Ana, Envasado A
    expect(operarioVisible(tecnica, operario(6))).toBe(true); // Pedro, Llenado 02 y Servicios
    expect(operarioVisible(tecnica, operario(4))).toBe(false); // Carlos, solo Servicios
  });

  it("el operario solo se ve a sí mismo", () => {
    expect(operariosMock.filter((o) => operarioVisible(operaria, o)).map((o) => o.nombre)).toEqual(["Ana Gómez"]);
  });

  it("el operario solo ve sus intervenciones; el técnico, las de sus líneas", () => {
    expect(intervencionesMock.filter((i) => intervencionVisible(operaria, i)).map((i) => i.id)).toEqual([1, 2]);
    expect(intervencionesMock.filter((i) => intervencionVisible(tecnica, i)).map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it("las solicitudes se filtran igual que las intervenciones", () => {
    expect(solicitudesMock.filter((s) => solicitudVisible(operaria, s)).map((s) => s.id)).toEqual([1]);
    expect(solicitudesMock.filter((s) => solicitudVisible(tecnica, s))).toHaveLength(2);
    const servicios = { rol: "Técnico" as const, nombre: "T", lineas: ["Servicios"] };
    expect(solicitudesMock.filter((s) => solicitudVisible(servicios, s))).toEqual([]);
  });
});

describe("acciones", () => {
  it("todos ejecutan salvo el jefe de planta", () => {
    expect(puedeEjecutar(admin)).toBe(true);
    expect(puedeEjecutar(tecnica)).toBe(true);
    expect(puedeEjecutar(operaria)).toBe(true);
    expect(puedeEjecutar(jefe)).toBe(false);
  });

  it("solo el operario solicita reinspecciones", () => {
    expect(puedeSolicitarReinspeccion(operaria)).toBe(true);
    expect([admin, jefe, tecnica].some(puedeSolicitarReinspeccion)).toBe(false);
  });

  it("solo el técnico y el administrador atienden reinspecciones", () => {
    expect(puedeAtenderReinspeccion(tecnica)).toBe(true);
    expect(puedeAtenderReinspeccion(admin)).toBe(true);
    expect(puedeAtenderReinspeccion(jefe)).toBe(false);
    expect(puedeAtenderReinspeccion(operaria)).toBe(false);
  });
});
