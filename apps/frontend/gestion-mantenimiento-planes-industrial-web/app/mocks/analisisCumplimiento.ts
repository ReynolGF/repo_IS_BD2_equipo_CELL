/**
 * Datos simulados (mock) de la funcionalidad 6: análisis de cumplimiento.
 *
 * Se calculan con los planes que ya tienen operarios en
 * `app/data/demoData.ts`. Los coeficientes de correlación son los de Pearson
 * entre la criticidad (baja=1, media=2, alta=3) y el rendimiento de cada
 * línea; si no hay variación valen 0.
 */
import { demoData } from "../data/demoData";
import type {
  ComparacionReinspeccion,
  CorrelacionLinea,
  ReporteAnalisisCumplimiento,
  TareaIncumplida,
} from "../types/reporte";
import { NIVEL_CRITICIDAD, ORDEN_CRITICIDAD } from "../utils/criticidad";
import {
  criticidadDe,
  idNumerico,
  lineasDemo,
  operarioPorNombre,
  planesConOperario,
  redondear,
} from "./desdeDemo";

/** Tareas de planes con operario, con la línea del plan y si se cumplieron. */
const asignaciones = planesConOperario.flatMap((plan) =>
  plan.tasks
    .filter((tarea) => operarioPorNombre(tarea.operator))
    .map((tarea) => ({ plan, tarea, operario: operarioPorNombre(tarea.operator)! })),
);

/** Porcentaje de elementos cumplidos; 0 si la lista está vacía. */
function porcentaje(cumplidas: number, total: number): number {
  return total === 0 ? 0 : redondear((cumplidas / total) * 100);
}

/** Coeficiente de Pearson entre dos series; 0 si alguna no varía. */
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const numerador = xs.reduce((suma, x, i) => suma + (x - mx) * (ys[i] - my), 0);
  const denominador = Math.sqrt(
    xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0),
  );
  return denominador === 0 ? 0 : Math.round((numerador / denominador) * 100) / 100;
}

/** Correlación entre criticidad y rendimiento, una entrada por línea. */
const correlacionPorLinea: CorrelacionLinea[] = lineasDemo.map((linea) => {
  const deLaLinea = asignaciones.filter((a) => a.plan.line === linea.nombre);
  const rendimiento = ORDEN_CRITICIDAD.flatMap((criticidad) => {
    const tareas = deLaLinea.filter((a) => criticidadDe(a.tarea.severity) === criticidad);
    if (tareas.length === 0) return [];
    return [
      {
        criticidad,
        rendimiento_promedio: porcentaje(tareas.filter((a) => a.tarea.completed).length, tareas.length),
      },
    ];
  });
  return {
    linea_id: linea.id,
    linea: linea.nombre,
    rendimiento,
    coeficiente_correlacion: pearson(
      rendimiento.map((r) => NIVEL_CRITICIDAD[r.criticidad]),
      rendimiento.map((r) => r.rendimiento_promedio),
    ),
  };
});

/** Las diez tareas con mayor porcentaje de ejecuciones sin cumplir (aunque sea 0 %). */
const tareasMayorIncumplimiento: TareaIncumplida[] = [
  ...new Set(asignaciones.map((a) => a.tarea.id)),
]
  .map((id) => {
    const registros = asignaciones.filter((a) => a.tarea.id === id);
    const tarea = registros[0].tarea;
    return {
      tarea_id: idNumerico(tarea.id),
      tarea: tarea.name,
      criticidad: criticidadDe(tarea.severity),
      tecnico_creador: tarea.author,
      linea: tarea.line,
      tasa_incumplimiento: porcentaje(registros.filter((r) => !r.tarea.completed).length, registros.length),
    };
  })
  .sort((a, b) => b.tasa_incumplimiento - a.tasa_incumplimiento || a.tarea.localeCompare(b.tarea, "es"))
  .slice(0, 10);

/** Operarios que pidieron reinspección frente al promedio de su turno en la línea. */
const reinspecciones: ComparacionReinspeccion[] = demoData.interventions
  .filter((item) => item.reinspection)
  .flatMap((item) => {
    const plan = demoData.plans.find((candidato) => candidato.id === item.planId);
    const operario = operarioPorNombre(item.operator);
    if (!plan || !operario) return [];
    const enLinea = asignaciones.filter((a) => a.plan.line === plan.line);
    const propias = enLinea.filter((a) => a.operario.id === operario.id);
    const delTurno = enLinea.filter((a) => a.operario.shift === operario.shift);
    const tasaOperario = porcentaje(propias.filter((a) => a.tarea.completed).length, propias.length);
    const tasaTurno = porcentaje(delTurno.filter((a) => a.tarea.completed).length, delTurno.length);
    return [
      {
        operario_id: idNumerico(operario.id),
        operario: operario.name,
        turno: operario.shift.toLowerCase(),
        linea: plan.line,
        tasa_operario: tasaOperario,
        tasa_promedio_turno: tasaTurno,
        diferencia: redondear(tasaOperario - tasaTurno),
      },
    ];
  });

/** Análisis simulado completo. */
export const analisisCumplimientoMock: ReporteAnalisisCumplimiento = {
  correlacion_por_linea: correlacionPorLinea,
  tareas_mayor_incumplimiento: tareasMayorIncumplimiento,
  reinspecciones,
};
