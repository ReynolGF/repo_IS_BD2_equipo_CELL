/**
 * Pruebas de las pantallas de operación: ejecución, estado, reinspecciones,
 * sensores y distribución entre líneas. Se prueban las tres capas de cada
 * ruta: el `loader` (qué datos pide), el `action` (cómo procesa los
 * formularios) y la página (qué ve el usuario según su rol).
 *
 * Datos (de `app/data/demoData.ts`): el plan 18 (Envasado A) es de Ana Gómez
 * (operaria 1); el plan 17 (Llenado 02), de Sofía Díaz (operaria 3); el plan
 * 16 (Servicios), de Carlos Vega (operario 4). Cuentas de demostración:
 * administrador Elena, jefe Roberto, técnica Laura (Envasado A y Llenado 02)
 * y operaria Ana (Envasado A).
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { createRoutesStub, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { distribucionLineasMock } from "../mocks/distribucionLineas";
import {
  intervencionesMock,
  operariosMock,
  planesAsignadosMock,
  solicitudesMock,
  tecnicosMock,
} from "../mocks/ejecucion";
import { agregadosDeEquipo, equiposMock, estadosEquiposMock } from "../mocks/sensores";
import { reportesMock } from "../mocks/tareasMasEjecutadas";
import { ConSesion, usuarioDe } from "../test/sesion";
import type { SessionUser } from "../types/maintenance";
import type { SolicitudReinspeccion } from "../types/operacion";
import DistribucionLineas, { loader as loaderDistribucion } from "./distribucion-lineas";
import EjecucionEstado, { loader as loaderEstado } from "./ejecucion-estado";
import Ejecucion, {
  action as accionEjecucion,
  loader as loaderEjecucion,
} from "./ejecucion-operario";
import Reinspecciones, {
  action as accionReinspecciones,
  loader as loaderReinspecciones,
} from "./reinspecciones";
import SensoresAnalisis, { loader as loaderAnalisis } from "./sensores-analisis";
import SensoresEstado, { loader as loaderEstadoEquipos } from "./sensores-estado";

const ADMIN = usuarioDe("Administrador");
const JEFE = usuarioDe("Jefe de planta");
const TECNICA = usuarioDe("Técnico");
const OPERARIA = usuarioDe("Operario");
/** Técnico cuyas líneas no tienen ninguna solicitud de reinspección. */
const TECNICO_SERVICIOS: SessionUser = { ...TECNICA, lines: ["Servicios"] };

/** Muestra la búsqueda de la dirección actual, para comprobar redirecciones. */
function Ubicacion() {
  return <p data-testid="ubicacion">{useLocation().search}</p>;
}

/**
 * Monta una página con los datos dados como si vinieran del `loader` y,
 * opcionalmente, del `action`, con la sesión de un usuario (por defecto, el
 * administrador). React Router genera el tipo exacto de las props, por eso se
 * usa una conversión de tipo en las pruebas.
 */
function montar(
  Pagina: React.ComponentType<never>,
  datos: unknown,
  opciones: { accion?: unknown; usuario?: SessionUser; extra?: ReactNode } = {},
) {
  const Componente = Pagina as unknown as React.ComponentType<{
    loaderData: unknown;
    actionData?: unknown;
  }>;
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <ConSesion usuario={opciones.usuario ?? ADMIN}>
          <Componente loaderData={datos} actionData={opciones.accion} />
          {opciones.extra}
        </ConSesion>
      ),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

/** Argumentos mínimos de un `loader` para una dirección dada. */
function argsLoader<T extends (...args: never[]) => unknown>(direccion: string) {
  return { request: new Request(direccion) } as unknown as Parameters<T>[0];
}

/** Argumentos mínimos de un `action` que recibe estos campos de formulario. */
function argsAction<T extends (...args: never[]) => unknown>(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [nombre, valor] of Object.entries(campos)) datos.set(nombre, valor);
  return { request: { formData: async () => datos } } as unknown as Parameters<T>[0];
}

/** Textos de las opciones de un `select`. */
function opciones(select: HTMLElement): (string | null)[] {
  return within(select).getAllByRole("option").map((o) => o.textContent);
}

const LINEAS = Object.values(reportesMock).map((r) => r.linea);

describe("ejecución de planes (T17, T18)", () => {
  /** Datos del `loader` para un operario (o ninguno). */
  const datos = (operarioId: number | null) => ({
    operarios: operariosMock,
    operarioId,
    planes:
      operarioId === null
        ? []
        : planesAsignadosMock.filter((p) => p.tareas.some((t) => t.operario_id === operarioId)),
    intervenciones: intervencionesMock.filter((i) => i.operario_id === operarioId),
    error: null,
  });

  it("el loader sin operario solo devuelve la lista de operarios", async () => {
    const resultado = await loaderEjecucion(argsLoader<typeof loaderEjecucion>("http://localhost/?"));
    expect(resultado.operarios).toHaveLength(6);
    expect(resultado.planes).toEqual([]);
  });

  it("el loader con un operario devuelve sus planes e intervenciones", async () => {
    const resultado = await loaderEjecucion(argsLoader<typeof loaderEjecucion>("http://localhost/?operario=1"));
    expect(resultado.planes.map((p) => p.plan_id)).toEqual([18]);
    expect(resultado.intervenciones.every((i) => i.operario_id === 1)).toBe(true);
  });

  it("el loader devuelve error si el operario no existe o no es un número", async () => {
    const inexistente = await loaderEjecucion(argsLoader<typeof loaderEjecucion>("http://localhost/?operario=99"));
    expect(inexistente.error).toBe("Operario no encontrado");
    const invalido = await loaderEjecucion(argsLoader<typeof loaderEjecucion>("http://localhost/?operario=abc"));
    expect(invalido.error).toBe("Operario no encontrado");
  });

  it("pide elegir un operario cuando todavía no hay ninguno", async () => {
    montar(Ejecucion, datos(null));
    expect(await screen.findByText("Selecciona un operario")).toBeInTheDocument();
  });

  it("muestra las tareas con su estado y el formulario solo en las no cumplidas", async () => {
    montar(Ejecucion, datos(3)); // Sofía: 1 incumplida y 3 pendientes
    // La tarea aparece en la lista y también en el historial de intervenciones.
    expect(await screen.findAllByText("Medir vibración de motor")).toHaveLength(2);
    expect(screen.getAllByText("Incumplida", { selector: "span" })).toHaveLength(2);
    expect(screen.getAllByText("Registrar intervención")).toHaveLength(4);
  });

  it("no ofrece el formulario en las tareas ya cumplidas", async () => {
    montar(Ejecucion, datos(1)); // Ana: 2 cumplidas y 2 pendientes
    expect((await screen.findAllByText("Inspeccionar sello de bomba")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Registrar intervención")).toHaveLength(2);
  });

  it("muestra el avance de las tareas del operario", async () => {
    montar(Ejecucion, datos(1));
    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  it("muestra 'No hay datos' si el operario no tiene planes", async () => {
    montar(Ejecucion, datos(6));
    expect(await screen.findByText("No hay datos")).toBeInTheDocument();
  });

  it("muestra el error de un operario inexistente", async () => {
    montar(Ejecucion, { ...datos(null), operarioId: 99, error: "Operario no encontrado" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Operario no encontrado");
  });

  it("muestra el mensaje que devuelve el action", async () => {
    montar(Ejecucion, datos(null), {
      accion: { error: "El campo observaciones debe tener al menos 5 caracteres." },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("al menos 5 caracteres");
  });

  describe("alcance por rol", () => {
    it("el administrador elige entre los 6 operarios", async () => {
      montar(Ejecucion, datos(1));
      expect(opciones(await screen.findByLabelText("Operario"))).toHaveLength(7);
    });

    it("el técnico solo ve a los operarios de sus líneas", async () => {
      montar(Ejecucion, datos(1), { usuario: TECNICA });
      const nombres = opciones(await screen.findByLabelText("Operario"));
      expect(nombres).toHaveLength(6); // aviso + 5 (Carlos Vega es de Servicios)
      expect(nombres.join("|")).not.toContain("Carlos Vega");
    });

    it("el técnico no accede a un operario de otra línea", async () => {
      montar(Ejecucion, datos(4), { usuario: TECNICA });
      expect(await screen.findByText("Sin acceso a este operario")).toBeInTheDocument();
      expect(screen.queryByText("Revisar quemador de caldera")).not.toBeInTheDocument();
    });

    it("el operario no tiene selector y ve su propio perfil", async () => {
      montar(Ejecucion, datos(1), { usuario: OPERARIA });
      expect(await screen.findByText(/Sesión de operario/)).toBeInTheDocument();
      expect(screen.queryByLabelText("Operario")).not.toBeInTheDocument();
      expect(screen.getAllByText("Registrar intervención")).toHaveLength(2);
    });

    it("si el operario abre el perfil de otro, vuelve al suyo", async () => {
      montar(Ejecucion, datos(3), { usuario: OPERARIA, extra: <Ubicacion /> });
      await waitFor(() => expect(screen.getByTestId("ubicacion")).toHaveTextContent("?operario=1"));
    });

    it("el jefe de planta consulta pero no registra intervenciones", async () => {
      montar(Ejecucion, datos(1), { usuario: JEFE });
      expect(await screen.findByText("Solo consulta")).toBeInTheDocument();
      expect(screen.getAllByText("Inspeccionar sello de bomba").length).toBeGreaterThan(0);
      expect(screen.queryByText("Registrar intervención")).not.toBeInTheDocument();
    });
  });

  it("el action rechaza un formulario sin los datos de la tarea", async () => {
    const resultado = await accionEjecucion(argsAction<typeof accionEjecucion>({ resultado: "cumplida" }));
    expect(resultado).toEqual({ error: expect.stringContaining("Faltan datos") });
  });

  it("el action rechaza un resultado desconocido", async () => {
    const resultado = await accionEjecucion(
      argsAction<typeof accionEjecucion>({ plan_id: "18", tarea_id: "8", operario_id: "1", resultado: "tal vez", observaciones: "Texto válido." }),
    );
    expect(resultado).toEqual({ error: "Elige el resultado de la intervención." });
  });

  it("el action rechaza observaciones demasiado cortas", async () => {
    const resultado = await accionEjecucion(
      argsAction<typeof accionEjecucion>({ plan_id: "18", tarea_id: "8", operario_id: "1", resultado: "cumplida", observaciones: "ok" }),
    );
    expect(resultado).toEqual({ error: expect.stringContaining("al menos 5") });
  });

  it("el action devuelve como mensaje las reglas de negocio incumplidas", async () => {
    const resultado = await accionEjecucion(
      argsAction<typeof accionEjecucion>({ plan_id: "18", tarea_id: "8", operario_id: "2", resultado: "cumplida", observaciones: "Intento de otro operario." }),
    );
    expect(resultado).toEqual({ error: "La tarea está asignada a otro operario." });
  });

  it("el action registra una intervención válida", async () => {
    const resultado = await accionEjecucion(
      argsAction<typeof accionEjecucion>({ plan_id: "18", tarea_id: "8", operario_id: "1", resultado: "cumplida", observaciones: "Banda sustituida y probada." }),
    );
    expect(resultado).toEqual({ ok: "Intervención registrada." });
  });
});

describe("estado de ejecución (T19)", () => {
  const planes = planesAsignadosMock.map((p) => ({ id: p.plan_id, nombre: p.plan, linea: p.linea }));
  const datos = (planId: number | null) => ({
    planes,
    planId,
    plan: planId === null ? null : (planesAsignadosMock.find((p) => p.plan_id === planId) ?? null),
    error: null,
  });

  it("el loader sin plan solo devuelve el selector", async () => {
    const resultado = await loaderEstado(argsLoader<typeof loaderEstado>("http://localhost/?"));
    expect(resultado.plan).toBeNull();
    expect(resultado.planes).toHaveLength(3);
  });

  it("el loader con un plan válido devuelve su estado", async () => {
    const resultado = await loaderEstado(argsLoader<typeof loaderEstado>("http://localhost/?plan=17"));
    expect(resultado.plan?.linea).toBe("Llenado 02");
  });

  it("el loader devuelve error si el plan no existe o no es un número", async () => {
    const inexistente = await loaderEstado(argsLoader<typeof loaderEstado>("http://localhost/?plan=99"));
    expect(inexistente.error).toBe("Plan no encontrado");
    const invalido = await loaderEstado(argsLoader<typeof loaderEstado>("http://localhost/?plan=abc"));
    expect(invalido.error).toBe("Plan no encontrado");
  });

  it("pide elegir un plan cuando todavía no hay ninguno", async () => {
    montar(EjecucionEstado, datos(null));
    expect(await screen.findByText("Selecciona un plan")).toBeInTheDocument();
  });

  it("muestra el avance, las métricas y la tabla de tareas", async () => {
    montar(EjecucionEstado, datos(18));
    expect(await screen.findByText("Resumen del avance", { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Avance del plan" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("100.0 %")).toBeInTheDocument();
    expect(screen.getByText("Inspeccionar sello de bomba")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar a PDF" })).toBeEnabled();
  });

  it("muestra 'No hay datos' y bloquea el PDF si el plan no tiene tareas", async () => {
    montar(EjecucionEstado, { ...datos(18), plan: { ...planesAsignadosMock[0], tareas: [] } });
    expect(await screen.findByText("No hay datos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar a PDF" })).toBeDisabled();
  });

  it("muestra el error de un plan inexistente", async () => {
    montar(EjecucionEstado, { planes, planId: 99, plan: null, error: "Plan no encontrado" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Plan no encontrado");
  });

  describe("alcance por rol", () => {
    it("el técnico solo elige planes de sus líneas", async () => {
      montar(EjecucionEstado, datos(null), { usuario: TECNICA });
      const nombres = opciones(await screen.findByLabelText("Plan de mantenimiento"));
      expect(nombres).toHaveLength(3); // aviso + planes 18 y 17 (no el de Servicios)
      expect(nombres.join("|")).not.toContain("Servicios");
    });

    it("el técnico no ve un plan de otra línea aunque lo pida por la dirección", async () => {
      montar(EjecucionEstado, datos(16), { usuario: TECNICA });
      expect(await screen.findByText("Sin acceso a este plan")).toBeInTheDocument();
      expect(screen.queryByText("Revisar quemador de caldera")).not.toBeInTheDocument();
    });

    it("el operario solo ve los planes donde tiene tareas", async () => {
      montar(EjecucionEstado, datos(17), { usuario: OPERARIA });
      expect(await screen.findByText("Sin acceso a este plan")).toBeInTheDocument();
    });

    it("el operario ve su propio plan", async () => {
      montar(EjecucionEstado, datos(18), { usuario: OPERARIA });
      expect(await screen.findByText("Inspeccionar sello de bomba")).toBeInTheDocument();
    });

    it("el jefe de planta ve cualquier plan", async () => {
      montar(EjecucionEstado, datos(16), { usuario: JEFE });
      expect(await screen.findByText("Revisar quemador de caldera")).toBeInTheDocument();
    });
  });
});

describe("reinspecciones (T20, T21)", () => {
  const datos = { intervenciones: intervencionesMock, solicitudes: solicitudesMock, tecnicos: tecnicosMock };
  const completada: SolicitudReinspeccion = {
    ...solicitudesMock[0],
    id: 9,
    tarea: "Lubricar rodamiento",
    estado: "completada",
    tecnico_apoyo: "Marco Ruiz",
    reinspeccion: {
      fecha: "2026-10-26T12:00:00",
      participantes: ["Laura Méndez", "Marco Ruiz"],
      observaciones: "Rodamiento reemplazado.",
      resultado: "no_conforme",
    },
  };

  it("el loader entrega intervenciones, solicitudes y técnicos", async () => {
    const resultado = await loaderReinspecciones();
    expect(resultado.intervenciones.length).toBeGreaterThan(0);
    expect(resultado.solicitudes.length).toBeGreaterThan(0);
    expect(resultado.tecnicos).toHaveLength(4);
  });

  it("una solicitud completada muestra el resultado y no ofrece formularios", async () => {
    montar(Reinspecciones, { ...datos, solicitudes: [completada] });
    expect(await screen.findByText(/Resultado: No conforme/)).toBeInTheDocument();
    expect(screen.getByText(/Laura Méndez, Marco Ruiz/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar resultado" })).not.toBeInTheDocument();
  });

  it("muestra el mensaje de éxito o de error del action", async () => {
    montar(Reinspecciones, datos, { accion: { error: "El motivo debe tener al menos 5 caracteres." } });
    expect(await screen.findByRole("alert")).toHaveTextContent("al menos 5 caracteres");
  });

  describe("alcance por rol", () => {
    it("el administrador atiende las solicitudes pero no las pide", async () => {
      montar(Reinspecciones, datos);
      expect(await screen.findAllByRole("button", { name: "Guardar resultado" })).toHaveLength(2);
      expect(screen.getAllByRole("button", { name: "Asignar apoyo" })).toHaveLength(2);
      expect(screen.queryByRole("button", { name: "Solicitar reinspección" })).not.toBeInTheDocument();
    });

    it("el operario solicita sobre sus propias intervenciones y ve solo sus solicitudes", async () => {
      montar(Reinspecciones, datos, { usuario: OPERARIA });
      const selector = await screen.findByLabelText("Intervención");
      expect(opciones(selector)).toHaveLength(3); // aviso + las 2 de Ana
      expect(screen.getByRole("button", { name: "Solicitar reinspección" })).toBeInTheDocument();
      expect(screen.getAllByText("Pendiente")).toHaveLength(1); // solo la solicitud de Ana
      expect(screen.queryByRole("button", { name: "Guardar resultado" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Asignar apoyo" })).not.toBeInTheDocument();
    });

    it("el técnico atiende las solicitudes de sus líneas y no solicita", async () => {
      montar(Reinspecciones, datos, { usuario: TECNICA });
      expect(await screen.findAllByRole("button", { name: "Guardar resultado" })).toHaveLength(2);
      expect(screen.queryByRole("button", { name: "Solicitar reinspección" })).not.toBeInTheDocument();
    });

    it("un técnico de otra línea no ve solicitudes ajenas", async () => {
      montar(Reinspecciones, datos, { usuario: TECNICO_SERVICIOS });
      expect(await screen.findByText("No hay datos")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Guardar resultado" })).not.toBeInTheDocument();
    });

    it("el jefe de planta ve las solicitudes sin poder actuar", async () => {
      montar(Reinspecciones, datos, { usuario: JEFE });
      expect(await screen.findAllByText("Pendiente")).toHaveLength(2);
      expect(screen.queryByRole("button", { name: "Guardar resultado" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Solicitar reinspección" })).not.toBeInTheDocument();
    });

    it("el apoyo solo puede ser un técnico autorizado en la línea de la solicitud", async () => {
      montar(Reinspecciones, datos);
      const [primero] = await screen.findAllByLabelText("Pedir técnico de apoyo");
      // Solicitud 1 (Envasado A): Laura, Marco y Elena; no Daniel (Llenado 02 y Servicios).
      const nombres = opciones(primero).join("|");
      expect(nombres).toContain("Laura Méndez");
      expect(nombres).toContain("Marco Ruiz");
      expect(nombres).not.toContain("Daniel Pérez");
    });
  });

  it("el action rechaza una acción desconocida", async () => {
    const resultado = await accionReinspecciones(argsAction<typeof accionReinspecciones>({ accion: "borrar" }));
    expect(resultado).toEqual({ error: "Acción desconocida." });
  });

  it("el action de solicitar exige elegir la intervención y un motivo válido", async () => {
    const sinIntervencion = await accionReinspecciones(
      argsAction<typeof accionReinspecciones>({ accion: "solicitar", motivo: "Motivo suficiente." }),
    );
    expect(sinIntervencion).toEqual({ error: "Elige la intervención a reinspeccionar." });
    const motivoCorto = await accionReinspecciones(
      argsAction<typeof accionReinspecciones>({ accion: "solicitar", intervencion_id: "2", motivo: "no" }),
    );
    expect(motivoCorto).toEqual({ error: expect.stringContaining("al menos 5") });
  });

  it("el action de solicitar crea la solicitud con apoyo opcional", async () => {
    const resultado = await accionReinspecciones(
      argsAction<typeof accionReinspecciones>({ accion: "solicitar", intervencion_id: "2", motivo: "Vibración anormal.", tecnico_apoyo_id: "2" }),
    );
    expect(resultado).toEqual({ ok: "Solicitud de reinspección enviada al técnico." });
  });

  it("el action devuelve como mensaje la regla de solicitud duplicada", async () => {
    const resultado = await accionReinspecciones(
      argsAction<typeof accionReinspecciones>({ accion: "solicitar", intervencion_id: "1", motivo: "Otra vez lo mismo." }),
    );
    expect(resultado).toEqual({ error: expect.stringContaining("Ya hay una reinspección pendiente") });
  });

  it("el action de apoyo exige elegir un técnico", async () => {
    const resultado = await accionReinspecciones(
      argsAction<typeof accionReinspecciones>({ accion: "apoyo", solicitud_id: "1" }),
    );
    expect(resultado).toEqual({ error: "Elige un técnico de apoyo." });
  });

  it("el action de apoyo asigna el técnico", async () => {
    const resultado = await accionReinspecciones(
      argsAction<typeof accionReinspecciones>({ accion: "apoyo", solicitud_id: "1", tecnico_id: "3" }),
    );
    expect(resultado).toEqual({ ok: "Técnico de apoyo asignado." });
  });

  it("el action de resultado valida participantes, observaciones y resultado", async () => {
    const sinParticipantes = await accionReinspecciones(
      argsAction<typeof accionReinspecciones>({ accion: "resultado", solicitud_id: "1", resultado: "conforme", participantes: " , ", observaciones: "Todo en orden." }),
    );
    expect(sinParticipantes).toEqual({ error: expect.stringContaining("participante") });
    const resultadoInvalido = await accionReinspecciones(
      argsAction<typeof accionReinspecciones>({ accion: "resultado", solicitud_id: "1", resultado: "quizá", participantes: "Ana", observaciones: "Todo en orden." }),
    );
    expect(resultadoInvalido).toEqual({ error: "Elige el resultado de la reinspección." });
  });

  it("el action de resultado cierra la solicitud y no permite repetirlo", async () => {
    const campos = { accion: "resultado", solicitud_id: "1", resultado: "conforme", participantes: "Laura Méndez, Ana Gómez", observaciones: "Sello reemplazado." };
    const primera = await accionReinspecciones(argsAction<typeof accionReinspecciones>(campos));
    expect(primera).toEqual({ ok: "Resultado de la reinspección guardado." });
    const segunda = await accionReinspecciones(argsAction<typeof accionReinspecciones>(campos));
    expect(segunda).toEqual({ error: expect.stringContaining("ya fue completada") });
  });
});

describe("análisis de sensores (T23)", () => {
  /** Datos de página equivalentes a un análisis sin filtros. */
  const sinFiltros = {
    lineas: LINEAS,
    equipos: equiposMock,
    filtro: { lineaId: null, equipoId: null, periodo: "24h" as const },
    analisis: { periodo: "24h" as const, agregados: equiposMock.flatMap((e) => agregadosDeEquipo(e, "24h")) },
    error: null,
  };

  it("el loader sin filtros agrega los 12 equipos en 24 horas", async () => {
    const datos = await loaderAnalisis(argsLoader<typeof loaderAnalisis>("http://localhost/?"));
    expect(datos.filtro.periodo).toBe("24h");
    expect(datos.analisis?.agregados).toHaveLength(33);
  });

  it("el loader aplica línea y periodo de la dirección", async () => {
    const datos = await loaderAnalisis(argsLoader<typeof loaderAnalisis>("http://localhost/?linea=2&periodo=7d"));
    expect(datos.filtro).toEqual({ lineaId: 2, equipoId: null, periodo: "7d" });
    expect(datos.analisis?.agregados).toHaveLength(11);
  });

  it("el loader devuelve error si el equipo no existe", async () => {
    const datos = await loaderAnalisis(argsLoader<typeof loaderAnalisis>("http://localhost/?equipo=99"));
    expect(datos.error).toBe("Equipo no encontrado");
    expect(datos.analisis).toBeNull();
  });

  it("el loader descarta un equipo que no pertenece a la línea elegida", async () => {
    const datos = await loaderAnalisis(argsLoader<typeof loaderAnalisis>("http://localhost/?linea=2&equipo=1"));
    expect(datos.filtro.equipoId).toBeNull();
    expect(datos.analisis?.agregados).toHaveLength(11);
  });

  it("muestra los selectores, un gráfico por magnitud y la tabla", async () => {
    montar(SensoresAnalisis, sinFiltros);
    expect(await screen.findByLabelText("Línea")).toBeInTheDocument();
    expect(screen.getByLabelText("Equipo")).toBeInTheDocument();
    expect(screen.getByLabelText("Periodo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Temperatura (°C)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vibración (mm/s)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Presión (bar)" })).toBeInTheDocument();
    expect(screen.getAllByText("Compresor 03").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Exportar a PDF" })).toBeEnabled();
  });

  it("limita el selector de equipos a la línea elegida", async () => {
    montar(SensoresAnalisis, { ...sinFiltros, filtro: { ...sinFiltros.filtro, lineaId: 2 } });
    const selector = await screen.findByLabelText("Equipo");
    expect(opciones(selector)).toEqual([
      "Todos los equipos",
      "Bomba centrífuga 02",
      "Compresor 03",
      "Motor de banda 07",
      "Válvula de presión 01",
    ]);
  });

  it("muestra 'No hay datos' y bloquea el PDF si los filtros no devuelven lecturas", async () => {
    montar(SensoresAnalisis, { ...sinFiltros, analisis: { periodo: "24h", agregados: [] } });
    expect(await screen.findByText("No hay datos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar a PDF" })).toBeDisabled();
  });

  it("muestra el error de un equipo inexistente", async () => {
    montar(SensoresAnalisis, { ...sinFiltros, analisis: null, error: "Equipo no encontrado" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Equipo no encontrado");
  });

  describe("alcance por rol", () => {
    it("el técnico solo ve las líneas y los equipos de sus líneas", async () => {
      montar(SensoresAnalisis, sinFiltros, { usuario: TECNICA });
      const lineas = opciones(await screen.findByLabelText("Línea"));
      expect(lineas).toEqual(["Todas las líneas", "Envasado A", "Llenado 02"]);
      expect(opciones(screen.getByLabelText("Equipo"))).toHaveLength(9); // todos + 8 equipos
      expect(screen.queryByText("Caldera principal")).not.toBeInTheDocument();
      expect(screen.getAllByText("Compresor 03").length).toBeGreaterThan(0);
    });

    it("el técnico no accede a una línea ajena aunque la pida por la dirección", async () => {
      montar(SensoresAnalisis, { ...sinFiltros, filtro: { ...sinFiltros.filtro, lineaId: 3 } }, { usuario: TECNICA });
      expect(await screen.findByText("Sin acceso a esta línea")).toBeInTheDocument();
      expect(screen.queryByText("Caldera principal")).not.toBeInTheDocument();
    });

    it("el jefe de planta ve todas las líneas", async () => {
      montar(SensoresAnalisis, sinFiltros, { usuario: JEFE });
      expect(opciones(await screen.findByLabelText("Línea"))).toHaveLength(4);
      expect(screen.getAllByText("Caldera principal").length).toBeGreaterThan(0);
    });
  });
});

describe("estado operativo de equipos (T24)", () => {
  const todos = { lineas: LINEAS, lineaId: null, equipos: estadosEquiposMock, error: null };

  it("el loader sin línea devuelve los 12 equipos", async () => {
    const datos = await loaderEstadoEquipos(argsLoader<typeof loaderEstadoEquipos>("http://localhost/?"));
    expect(datos.equipos).toHaveLength(12);
  });

  it("el loader con línea devuelve solo sus equipos", async () => {
    const datos = await loaderEstadoEquipos(argsLoader<typeof loaderEstadoEquipos>("http://localhost/?linea=3"));
    expect(datos.equipos.map((e) => e.equipo)).toEqual([
      "Caldera principal",
      "Bomba de alimentación",
      "Motor de ventilador",
      "Válvula de vapor principal",
    ]);
  });

  it("el loader devuelve error si la línea no existe", async () => {
    const datos = await loaderEstadoEquipos(argsLoader<typeof loaderEstadoEquipos>("http://localhost/?linea=99"));
    expect(datos.error).toBe("Línea no encontrada");
    expect(datos.equipos).toEqual([]);
  });

  it("cuenta los equipos por estado y muestra primero los críticos", async () => {
    montar(SensoresEstado, todos);
    expect(await screen.findByText("Equipos normales")).toBeInTheDocument();
    const tarjeta = (titulo: string) => screen.getByText(titulo).closest("article") as HTMLElement;
    expect(within(tarjeta("Equipos normales")).getByText("9")).toBeInTheDocument();
    expect(within(tarjeta("En alerta")).getByText("2")).toBeInTheDocument();
    expect(within(tarjeta("En estado crítico")).getByText("1")).toBeInTheDocument();
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Motor de banda 04");
  });

  it("muestra 'No hay datos' si no hay equipos", async () => {
    montar(SensoresEstado, { lineas: LINEAS, lineaId: 1, equipos: [], error: null });
    expect(await screen.findByText("No hay datos")).toBeInTheDocument();
  });

  it("muestra el error de una línea inexistente", async () => {
    montar(SensoresEstado, { lineas: LINEAS, lineaId: null, equipos: [], error: "Línea no encontrada" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Línea no encontrada");
  });

  describe("alcance por rol", () => {
    it("el técnico solo ve los equipos de sus líneas", async () => {
      montar(SensoresEstado, todos, { usuario: TECNICA });
      expect(await screen.findByText("Equipos normales")).toBeInTheDocument();
      expect(screen.queryByText("Caldera principal")).not.toBeInTheDocument();
      expect(screen.getByText("Compresor 03")).toBeInTheDocument();
      expect(opciones(screen.getByLabelText("Línea de producción"))).toEqual([
        "Todas las líneas",
        "Envasado A",
        "Llenado 02",
      ]);
    });

    it("el técnico no accede a una línea ajena aunque la pida por la dirección", async () => {
      montar(
        SensoresEstado,
        { ...todos, lineaId: 3, equipos: estadosEquiposMock.filter((e) => e.linea === "Servicios") },
        { usuario: TECNICA },
      );
      expect(await screen.findByText("Sin acceso a esta línea")).toBeInTheDocument();
      expect(screen.queryByText("Caldera principal")).not.toBeInTheDocument();
    });
  });
});

describe("distribución entre líneas (T29)", () => {
  it("el loader devuelve la distribución y el criterio de cada línea", async () => {
    const datos = await loaderDistribucion();
    expect(datos.filas.length).toBe(distribucionLineasMock.filas.length);
    expect(datos.equilibrio).toHaveLength(3);
  });

  it("indica qué líneas cumplen el criterio de equilibrio y cuáles no", async () => {
    montar(DistribucionLineas, distribucionLineasMock);
    expect(await screen.findByText("1 de 3 líneas no cumplen el criterio.")).toBeInTheDocument();
    expect(screen.getAllByText("Cumple")).toHaveLength(2);
    expect(screen.getAllByText("No cumple")).toHaveLength(1);
  });

  it("muestra el mensaje de éxito si todas las líneas cumplen", async () => {
    const todasCumplen = {
      ...distribucionLineasMock,
      equilibrio: distribucionLineasMock.equilibrio.map((e) => ({ ...e, cumple_criterio: true })),
    };
    montar(DistribucionLineas, todasCumplen);
    expect(await screen.findByText("Todas las líneas cumplen el criterio.")).toBeInTheDocument();
  });

  it("muestra la tabla de detalle por sistema y habilita el PDF", async () => {
    montar(DistribucionLineas, distribucionLineasMock);
    expect(await screen.findByText("Detalle por sistema")).toBeInTheDocument();
    expect(screen.getAllByText("Compresores").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Exportar a PDF" })).toBeEnabled();
  });

  it("muestra 'No hay datos' y bloquea el PDF si no hay tareas", async () => {
    montar(DistribucionLineas, { filas: [], equilibrio: [] });
    expect(await screen.findByText("No hay datos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar a PDF" })).toBeDisabled();
  });

  describe("alcance por rol", () => {
    it("el técnico solo compara sus líneas", async () => {
      montar(DistribucionLineas, distribucionLineasMock, { usuario: TECNICA });
      expect(await screen.findByText("1 de 2 líneas no cumplen el criterio.")).toBeInTheDocument();
      expect(screen.queryByText("Servicios")).not.toBeInTheDocument();
    });

    it("el operario solo ve su línea", async () => {
      montar(DistribucionLineas, distribucionLineasMock, { usuario: OPERARIA });
      expect(await screen.findByText("Todas las líneas cumplen el criterio.")).toBeInTheDocument();
      expect(screen.queryByText("Llenado 02")).not.toBeInTheDocument();
    });
  });
});
