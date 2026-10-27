/**
 * Validación de los formularios de ejecución y reinspección.
 *
 * Cada función devuelve un mensaje de error o `null` si los datos son
 * válidos. Se usa en las acciones de las rutas (antes de llamar a la API) y
 * el repositorio simulado la repite, porque el backend real también valida.
 */

/** Largo mínimo exigido a las observaciones y motivos, sin contar espacios. */
export const LARGO_MINIMO_TEXTO = 5;

/** Largo máximo permitido a las observaciones y motivos. */
export const LARGO_MAXIMO_TEXTO = 500;

/**
 * Valida un texto libre obligatorio (observaciones o motivo).
 *
 * @param texto Texto escrito por el usuario.
 * @param nombre Nombre del campo, usado en el mensaje de error.
 * @returns Mensaje de error, o `null` si el texto es válido.
 */
export function validarTextoObligatorio(texto: string, nombre: string): string | null {
  const limpio = texto.trim();
  if (limpio.length < LARGO_MINIMO_TEXTO) {
    return `${nombre} debe tener al menos ${LARGO_MINIMO_TEXTO} caracteres.`;
  }
  if (limpio.length > LARGO_MAXIMO_TEXTO) {
    return `${nombre} no puede superar ${LARGO_MAXIMO_TEXTO} caracteres.`;
  }
  return null;
}

/**
 * Convierte el texto "Ana, Luis" en la lista ["Ana", "Luis"], sin vacíos
 * ni repetidos (sin distinguir mayúsculas).
 *
 * @param texto Nombres separados por comas.
 */
export function separarParticipantes(texto: string): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const parte of texto.split(",")) {
    const nombre = parte.trim();
    const clave = nombre.toLocaleLowerCase("es");
    if (nombre && !vistos.has(clave)) {
      vistos.add(clave);
      lista.push(nombre);
    }
  }
  return lista;
}

/**
 * Valida el formulario de registro de una reinspección manual.
 *
 * @param participantes Nombres ya separados (ver `separarParticipantes`).
 * @param observaciones Observaciones del técnico.
 */
export function validarRegistroReinspeccion(
  participantes: readonly string[],
  observaciones: string,
): string | null {
  if (participantes.length === 0) {
    return "Indica al menos un participante de la reinspección.";
  }
  return validarTextoObligatorio(observaciones, "El campo observaciones");
}
