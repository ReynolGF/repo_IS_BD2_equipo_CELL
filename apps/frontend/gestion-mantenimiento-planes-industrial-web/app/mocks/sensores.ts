/**
 * Datos simulados (mock) de los sensores de los equipos.
 *
 * Los equipos son los de las líneas de `app/data/demoData.ts`. La lectura
 * base de cada equipo sale de `demoData.sensors` cuando existe; si no, se
 * calcula de forma determinista a partir de su identificador (sin números
 * aleatorios) para que las pruebas siempre vean los mismos resultados.
 * Los valores agregados se obtienen de esa lectura base y del periodo elegido.
 */
import { demoData } from "../data/demoData";
import type {
  AgregadoSensor,
  EquipoResumen,
  EstadoEquipo,
  EstadoOperativo,
  PeriodoSensor,
  TipoSensor,
} from "../types/operacion";
import { idNumerico, redondear } from "./desdeDemo";

/** Equipos con sensores, repartidos entre las líneas. */
export const equiposMock: EquipoResumen[] = demoData.lines.flatMap((linea) =>
  linea.equipment.map((equipo) => ({
    id: idNumerico(equipo.id),
    nombre: equipo.name,
    linea_id: idNumerico(linea.id),
    linea: linea.name,
  })),
);

/** Unidad de cada magnitud. */
export const UNIDAD_SENSOR: Record<TipoSensor, string> = {
  temperatura: "°C",
  vibracion: "mm/s",
  presion: "bar",
};

/** Sistemas cuyos equipos miden presión. */
const SISTEMAS_CON_PRESION = ["Bombas", "Compresores", "Caldera", "Vapor", "Válvulas"];

/** Sistema al que pertenece cada equipo, por identificador. */
const SISTEMA_DEL_EQUIPO = new Map(
  demoData.lines.flatMap((linea) =>
    linea.equipment.map((equipo) => [idNumerico(equipo.id), equipo.system] as const),
  ),
);

/** Lectura simulada de `demoData` para un equipo, si existe. */
function lecturaDemo(nombre: string) {
  return demoData.sensors.find((lectura) => lectura.equipment === nombre);
}

/**
 * Lectura base (valores de referencia) de un equipo. Una presión de 0 indica
 * que el equipo no tiene sensor de presión.
 */
function lecturaBase(equipo: EquipoResumen): Record<TipoSensor, number> {
  const real = lecturaDemo(equipo.nombre);
  if (real) {
    return { temperatura: real.temperature, vibracion: real.vibration, presion: real.pressure };
  }
  const conPresion = SISTEMAS_CON_PRESION.includes(SISTEMA_DEL_EQUIPO.get(equipo.id) ?? "");
  return {
    temperatura: 40 + ((equipo.id * 7) % 25),
    vibracion: redondear(1.5 + (equipo.id % 5) * 0.6),
    presion: conPresion ? redondear(4.5 + (equipo.id % 4) * 0.7) : 0,
  };
}

/** Cantidad de lecturas (una por minuto) que cubre cada periodo. */
export const LECTURAS_POR_PERIODO: Record<PeriodoSensor, number> = {
  "24h": 1440,
  "7d": 10080,
  "30d": 43200,
};

/** Amplitud de la variación respecto al promedio; crece con el periodo. */
const AMPLITUD: Record<PeriodoSensor, number> = {
  "24h": 0.06,
  "7d": 0.1,
  "30d": 0.15,
};

/**
 * Calcula los valores agregados de un equipo en un periodo.
 *
 * Los equipos sin sensor de presión (base 0) no generan fila de presión.
 *
 * @param equipo Equipo a medir.
 * @param periodo Periodo de análisis.
 * @returns Una fila por cada magnitud que mide el equipo.
 */
export function agregadosDeEquipo(
  equipo: EquipoResumen,
  periodo: PeriodoSensor,
): AgregadoSensor[] {
  const base = lecturaBase(equipo);
  const amplitud = AMPLITUD[periodo];
  const tipos = (Object.keys(base) as TipoSensor[]).filter((t) => base[t] > 0);
  return tipos.map((tipo) => ({
    equipo_id: equipo.id,
    equipo: equipo.nombre,
    linea: equipo.linea,
    tipo_sensor: tipo,
    unidad: UNIDAD_SENSOR[tipo],
    minimo: redondear(base[tipo] * (1 - amplitud)),
    promedio: redondear(base[tipo]),
    maximo: redondear(base[tipo] * (1 + amplitud)),
    lecturas: LECTURAS_POR_PERIODO[periodo],
  }));
}

/** Estado operativo según el texto de estado de `demoData.sensors`. */
const ESTADO_SEGUN_TEXTO: Record<string, EstadoOperativo> = {
  "Alerta alta": "critico",
  Revisar: "alerta",
  Estable: "normal",
};

/** Estado operativo actual de cada equipo (última lectura). */
export const estadosEquiposMock: EstadoEquipo[] = equiposMock.map((equipo) => {
  const base = lecturaBase(equipo);
  const real = lecturaDemo(equipo.nombre);
  return {
    equipo_id: equipo.id,
    equipo: equipo.nombre,
    linea: equipo.linea,
    estado: real ? (ESTADO_SEGUN_TEXTO[real.status] ?? "normal") : "normal",
    temperatura: base.temperatura,
    vibracion: base.vibracion,
    presion: base.presion,
    ultima_lectura: `2026-10-27T07:5${equipo.id % 10}:00`,
  };
});
