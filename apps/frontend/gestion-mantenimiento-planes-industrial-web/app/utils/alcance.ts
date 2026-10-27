/**
 * Reglas de alcance por rol para las pantallas de ejecución, sensores y
 * reportes. Son funciones puras: reciben el alcance del usuario y los datos y
 * devuelven qué parte puede ver o qué acciones puede hacer.
 *
 * Siguen las mismas reglas que el resto de la aplicación
 * (`visiblePlansFor` en `maintenanceRules.mjs`):
 * - Administrador y Jefe de planta ven todo.
 * - Técnico ve solo sus líneas autorizadas.
 * - Operario ve solo sus líneas y sus propias tareas.
 * - El Jefe de planta revisa, pero no ejecuta.
 *
 * Importante: en esta versión con datos simulados el recorte se hace en el
 * navegador. Con un backend real, la API debe aplicar las mismas reglas.
 */
import type { Role, SessionUser } from "../types/maintenance";
import type {
  Intervencion,
  OperarioResumen,
  PlanAsignado,
  SolicitudReinspeccion,
} from "../types/operacion";

/** Quién consulta y qué líneas tiene a su alcance. */
export interface Alcance {
  /** Rol de la sesión, o `null` si no hay sesión. */
  rol: Role | null;
  /** Nombre del usuario (los planes guardan operarios por nombre). */
  nombre: string;
  /** Líneas a su alcance; solo se usan para Técnico y Operario. */
  lineas: string[];
}

/** Alcance de quien no ha iniciado sesión: no puede ver nada. */
export const SIN_ALCANCE: Alcance = { rol: null, nombre: "", lineas: [] };

/**
 * Construye el alcance a partir del usuario de la sesión.
 *
 * @param usuario Usuario autenticado, o `null`.
 */
export function alcanceDeUsuario(usuario: SessionUser | null): Alcance {
  if (!usuario) return SIN_ALCANCE;
  return { rol: usuario.role, nombre: usuario.name, lineas: [...usuario.lines] };
}

/** Normaliza un texto para compararlo sin distinguir mayúsculas ni acentos. */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** ¿Ve toda la planta? (Administrador y Jefe de planta.) */
export function veTodaLaPlanta(alcance: Alcance): boolean {
  return alcance.rol === "Administrador" || alcance.rol === "Jefe de planta";
}

/** ¿La línea está a su alcance? */
export function lineaVisible(alcance: Alcance, linea: string): boolean {
  if (veTodaLaPlanta(alcance)) return true;
  if (alcance.rol === null) return false;
  return alcance.lineas.some((propia) => normalizar(propia) === normalizar(linea));
}

/** Deja solo los elementos cuya línea está a su alcance. */
export function filtrarPorLinea<T>(
  alcance: Alcance,
  elementos: readonly T[],
  lineaDe: (elemento: T) => string,
): T[] {
  return elementos.filter((elemento) => lineaVisible(alcance, lineaDe(elemento)));
}

/** ¿El plan está a su alcance? El operario solo ve planes donde tiene tareas. */
export function planVisible(alcance: Alcance, plan: PlanAsignado): boolean {
  if (veTodaLaPlanta(alcance)) return true;
  if (alcance.rol === "Operario") {
    return plan.tareas.some((tarea) => normalizar(tarea.operario) === normalizar(alcance.nombre));
  }
  return lineaVisible(alcance, plan.linea);
}

/** ¿El operario está a su alcance? El operario solo se ve a sí mismo. */
export function operarioVisible(alcance: Alcance, operario: OperarioResumen): boolean {
  if (veTodaLaPlanta(alcance)) return true;
  if (alcance.rol === "Operario") return normalizar(operario.nombre) === normalizar(alcance.nombre);
  if (alcance.rol === "Técnico") {
    return operario.lineas.some((linea) => lineaVisible(alcance, linea));
  }
  return false;
}

/** ¿La intervención está a su alcance? El operario solo ve las suyas. */
export function intervencionVisible(alcance: Alcance, intervencion: Intervencion): boolean {
  if (veTodaLaPlanta(alcance)) return true;
  if (alcance.rol === "Operario") {
    return normalizar(intervencion.operario) === normalizar(alcance.nombre);
  }
  return lineaVisible(alcance, intervencion.linea);
}

/** ¿La solicitud de reinspección está a su alcance? */
export function solicitudVisible(alcance: Alcance, solicitud: SolicitudReinspeccion): boolean {
  if (veTodaLaPlanta(alcance)) return true;
  if (alcance.rol === "Operario") {
    return normalizar(solicitud.operario) === normalizar(alcance.nombre);
  }
  return lineaVisible(alcance, solicitud.linea);
}

/** ¿Puede registrar intervenciones? Todos menos el Jefe de planta. */
export function puedeEjecutar(alcance: Alcance): boolean {
  return alcance.rol !== null && alcance.rol !== "Jefe de planta";
}

/** ¿Puede solicitar reinspecciones? Solo el operario, sobre lo suyo. */
export function puedeSolicitarReinspeccion(alcance: Alcance): boolean {
  return alcance.rol === "Operario";
}

/** ¿Puede asignar apoyo y registrar el resultado manual? Técnico y Administrador. */
export function puedeAtenderReinspeccion(alcance: Alcance): boolean {
  return alcance.rol === "Técnico" || alcance.rol === "Administrador";
}
