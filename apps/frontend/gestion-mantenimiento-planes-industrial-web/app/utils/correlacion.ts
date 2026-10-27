/**
 * Interpretación textual del coeficiente de correlación de Pearson.
 */

/**
 * Traduce un coeficiente de correlación (-1 a 1) a una lectura en lenguaje
 * natural sobre la relación entre criticidad y rendimiento.
 *
 * Fuerza según el valor absoluto: menor que 0,3 débil o nula; hasta 0,7
 * moderada; mayor, fuerte. El signo indica el sentido de la relación.
 *
 * @param coeficiente Coeficiente de correlación entre -1 y 1.
 */
export function interpretarCorrelacion(coeficiente: number): string {
  const magnitud = Math.abs(coeficiente);
  if (magnitud < 0.3) {
    return "Sin relación clara entre criticidad y rendimiento";
  }
  const fuerza = magnitud < 0.7 ? "moderada" : "fuerte";
  return coeficiente < 0
    ? `Correlación ${fuerza} negativa: a mayor criticidad, menor rendimiento`
    : `Correlación ${fuerza} positiva: a mayor criticidad, mayor rendimiento`;
}
