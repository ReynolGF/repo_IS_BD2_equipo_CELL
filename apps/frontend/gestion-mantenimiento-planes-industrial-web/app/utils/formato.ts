/**
 * Funciones para mostrar números como texto en las tablas y el PDF.
 */

/**
 * Formatea un porcentaje con un decimal, por ejemplo `94 -> "94.0 %"`.
 *
 * @param valor Porcentaje entre 0 y 100.
 */
export function formatoPorcentaje(valor: number): string {
  return `${valor.toFixed(1)} %`;
}

/**
 * Formatea una diferencia en puntos porcentuales con signo explícito,
 * por ejemplo `7.5 -> "+7.5 pp"` y `-12.5 -> "-12.5 pp"`.
 *
 * @param valor Diferencia entre dos porcentajes.
 */
export function formatoDiferencia(valor: number): string {
  const signo = valor > 0 ? "+" : "";
  return `${signo}${valor.toFixed(1)} pp`;
}

/**
 * Da formato a una fecha ISO como "26/10/2026 08:15".
 * Se arma a mano para que el resultado no dependa del idioma del servidor.
 *
 * @param iso Fecha en formato ISO 8601 sin zona horaria.
 */
export function formatoFechaHora(iso: string): string {
  const [fecha = "", hora = ""] = iso.split("T");
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio} ${hora.slice(0, 5)}`;
}
