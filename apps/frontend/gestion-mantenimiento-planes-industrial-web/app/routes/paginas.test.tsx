/**
 * Pruebas de las páginas de reporte: de los datos del `loader` a lo que ve
 * el usuario según su rol. Cada página se monta dentro de un enrutador de
 * prueba porque usa `Form`, `NavLink` y `useNavigation`.
 *
 * Datos (de `app/data/demoData.ts`): líneas Envasado A (1), Llenado 02 (2) y
 * Servicios (3); planes con operario: 18 (Envasado A), 17 (Llenado 02) y 16
 * (Servicios); planes sin operario: 15, 14 y 13.
 */
import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { analisisCumplimientoMock } from "../mocks/analisisCumplimiento";
import { desempenoMock, planesMock } from "../mocks/desempenoOperarios";
import { reportesMock } from "../mocks/tareasMasEjecutadas";
import { ConSesion, usuarioDe } from "../test/sesion";
import type { SessionUser } from "../types/maintenance";
import AnalisisCumplimiento from "./analisis-cumplimiento";
import DesempenoOperarios, { loader as loaderDesempeno } from "./desempeno-operarios";
import TareasMasEjecutadas, { loader as loaderTareas } from "./tareas-mas-ejecutadas";

const TECNICA = usuarioDe("Técnico"); // Envasado A y Llenado 02
const OPERARIA = usuarioDe("Operario"); // Envasado A

/**
 * Monta una página con los datos dados como si vinieran del `loader`, con la
 * sesión de un usuario (por defecto, el administrador). Las páginas reciben
 * `loaderData` como propiedad; el tipo exacto lo genera React Router, por eso
 * se usa una conversión de tipo en las pruebas.
 */
function montar(Pagina: React.ComponentType<never>, datos: unknown, usuario?: SessionUser) {
  const Componente = Pagina as unknown as React.ComponentType<{ loaderData: unknown }>;
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <ConSesion usuario={usuario}>
          <Componente loaderData={datos} />
        </ConSesion>
      ),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

/** Textos de las opciones de un `select`. */
function opciones(select: HTMLElement): (string | null)[] {
  return within(select).getAllByRole("option").map((o) => o.textContent);
}

const LINEAS = Object.values(reportesMock).map((r) => r.linea);

describe("página de tareas más ejecutadas", () => {
  it("pide elegir una línea cuando todavía no hay ninguna", async () => {
    montar(TareasMasEjecutadas, { lineas: LINEAS, lineaId: null, reporte: null, error: null });
    expect(await screen.findByText("Selecciona una línea de producción")).toBeInTheDocument();
  });

  it("muestra la tabla con las tareas de la línea", async () => {
    montar(TareasMasEjecutadas, {
      lineas: LINEAS,
      lineaId: 1,
      reporte: reportesMock[1],
      error: null,
    });
    expect(await screen.findByText("Lubricar rodamiento")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar a PDF" })).toBeEnabled();
  });

  it("muestra 'No hay datos' y bloquea el PDF si la línea no tiene tareas (CA-7)", async () => {
    montar(TareasMasEjecutadas, {
      lineas: LINEAS,
      lineaId: 1,
      reporte: { ...reportesMock[1], tareas: [] },
      error: null,
    });
    expect(await screen.findByText("No hay datos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar a PDF" })).toBeDisabled();
  });

  it("muestra el error de una línea inexistente (CA-8)", async () => {
    montar(TareasMasEjecutadas, {
      lineas: LINEAS,
      lineaId: 99,
      reporte: null,
      error: "Línea no encontrada",
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Línea no encontrada");
  });

  describe("alcance por rol", () => {
    const datos = (lineaId: number | null) => ({
      lineas: LINEAS,
      lineaId,
      reporte: lineaId === null ? null : reportesMock[lineaId],
      error: null,
    });

    it("el técnico solo elige entre sus líneas", async () => {
      montar(TareasMasEjecutadas, datos(null), TECNICA);
      expect(opciones(await screen.findByLabelText("Línea de producción"))).toEqual([
        "Selecciona una línea…",
        "Envasado A",
        "Llenado 02",
      ]);
    });

    it("el técnico no ve una línea ajena aunque la pida por la dirección", async () => {
      montar(TareasMasEjecutadas, datos(3), TECNICA);
      expect(await screen.findByText("Sin acceso a esta línea")).toBeInTheDocument();
      expect(screen.queryByText("Verificar presión de vapor")).not.toBeInTheDocument();
    });

    it("el operario solo ve su línea", async () => {
      montar(TareasMasEjecutadas, datos(null), OPERARIA);
      expect(opciones(await screen.findByLabelText("Línea de producción"))).toEqual([
        "Selecciona una línea…",
        "Envasado A",
      ]);
    });

    it("el administrador ve las tres líneas", async () => {
      montar(TareasMasEjecutadas, datos(3));
      expect(await screen.findByText("Verificar presión de vapor")).toBeInTheDocument();
      expect(opciones(screen.getByLabelText("Línea de producción"))).toHaveLength(4);
    });
  });
});

describe("loader de tareas más ejecutadas", () => {
  /** Construye los argumentos mínimos que recibe un loader. */
  const argumentos = (direccion: string) =>
    ({ request: new Request(direccion) }) as Parameters<typeof loaderTareas>[0];

  it("sin parámetro solo devuelve las líneas", async () => {
    const datos = await loaderTareas(argumentos("http://localhost/?"));
    expect(datos.reporte).toBeNull();
    expect(datos.lineas).toHaveLength(3);
  });

  it("con una línea válida devuelve su reporte", async () => {
    const datos = await loaderTareas(argumentos("http://localhost/?linea=1"));
    expect(datos.reporte?.linea.nombre).toBe("Envasado A");
  });

  it("con una línea inexistente devuelve el mensaje de error", async () => {
    const datos = await loaderTareas(argumentos("http://localhost/?linea=99"));
    expect(datos.error).toBe("Línea no encontrada");
    expect(datos.reporte).toBeNull();
  });

  it("con un valor que no es número devuelve el mensaje de error", async () => {
    const datos = await loaderTareas(argumentos("http://localhost/?linea=abc"));
    expect(datos.error).toBe("Línea no encontrada");
  });
});

describe("página de desempeño de operarios", () => {
  const datos = (planId: number | null) => ({
    planes: planesMock,
    planId,
    reporte: planId === null ? null : desempenoMock[planId],
    error: null,
  });

  it("muestra el resumen por criticidad y el detalle por operario", async () => {
    montar(DesempenoOperarios, datos(18));
    expect(await screen.findByText("Cumplimiento global por criticidad")).toBeInTheDocument();
    expect(screen.getAllByText("Ana Gómez").length).toBeGreaterThan(0);
    expect(screen.getByText("Detalle por operario y criticidad")).toBeInTheDocument();
  });

  it("muestra 'No hay datos' para un plan que aún no tiene operarios", async () => {
    montar(DesempenoOperarios, datos(15));
    expect(await screen.findByText("No hay datos")).toBeInTheDocument();
  });

  it("el loader devuelve error si el plan no existe", async () => {
    const resultado = await loaderDesempeno({
      request: new Request("http://localhost/?plan=99"),
    } as Parameters<typeof loaderDesempeno>[0]);
    expect(resultado.error).toBe("Plan no encontrado");
  });

  describe("alcance por rol", () => {
    it("el técnico solo elige planes de sus líneas", async () => {
      montar(DesempenoOperarios, datos(null), TECNICA);
      const nombres = opciones(await screen.findByLabelText("Plan de mantenimiento"));
      expect(nombres).toHaveLength(5); // aviso + 2 planes de Envasado A + 2 de Llenado 02
      expect(nombres.join("|")).not.toContain("Servicios");
    });

    it("el técnico no ve el desempeño de un plan ajeno", async () => {
      montar(DesempenoOperarios, datos(16), TECNICA);
      expect(await screen.findByText("Sin acceso a este plan")).toBeInTheDocument();
      expect(screen.queryByText("Carlos Vega")).not.toBeInTheDocument();
    });

    it("el operario solo ve planes de su línea", async () => {
      montar(DesempenoOperarios, datos(null), OPERARIA);
      expect(opciones(await screen.findByLabelText("Plan de mantenimiento"))).toHaveLength(3);
    });
  });
});

describe("página de análisis de cumplimiento", () => {
  it("muestra las tres secciones del análisis", async () => {
    montar(AnalisisCumplimiento, analisisCumplimientoMock);
    expect(await screen.findByText("Criticidad y rendimiento por línea")).toBeInTheDocument();
    expect(screen.getByText("Las 10 tareas con mayor incumplimiento")).toBeInTheDocument();
    expect(screen.getByText("Operarios que pidieron reinspección")).toBeInTheDocument();
  });

  it("interpreta la correlación de cada línea", async () => {
    montar(AnalisisCumplimiento, analisisCumplimientoMock);
    // Envasado A mejora con la criticidad; en las otras dos no hay variación.
    expect(await screen.findAllByText(/fuerte positiva/)).toHaveLength(1);
    expect(screen.getAllByText(/Sin relación clara/)).toHaveLength(2);
  });

  it("muestra el técnico creador de las tareas más incumplidas", async () => {
    montar(AnalisisCumplimiento, analisisCumplimientoMock);
    expect((await screen.findAllByText("Daniel Pérez")).length).toBeGreaterThan(0);
  });

  it("indica 'No hay datos' si el análisis llega vacío", async () => {
    montar(AnalisisCumplimiento, {
      correlacion_por_linea: [],
      tareas_mayor_incumplimiento: [],
      reinspecciones: [],
    });
    expect(await screen.findByText("No hay datos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar a PDF" })).toBeDisabled();
  });

  describe("alcance por rol", () => {
    it("el administrador ve las tres líneas", async () => {
      montar(AnalisisCumplimiento, analisisCumplimientoMock);
      expect((await screen.findAllByText("Servicios")).length).toBeGreaterThan(0);
    });

    it("el técnico no ve datos de líneas ajenas", async () => {
      montar(AnalisisCumplimiento, analisisCumplimientoMock, TECNICA);
      expect(await screen.findByText("Criticidad y rendimiento por línea")).toBeInTheDocument();
      expect(screen.queryAllByText("Servicios")).toHaveLength(0);
      expect(screen.getAllByText("Envasado A").length).toBeGreaterThan(0);
    });

    it("el operario solo ve su línea", async () => {
      montar(AnalisisCumplimiento, analisisCumplimientoMock, OPERARIA);
      expect(await screen.findByText("Criticidad y rendimiento por línea")).toBeInTheDocument();
      expect(screen.queryAllByText("Llenado 02")).toHaveLength(0);
      expect(screen.queryAllByText("Servicios")).toHaveLength(0);
    });
  });
});
