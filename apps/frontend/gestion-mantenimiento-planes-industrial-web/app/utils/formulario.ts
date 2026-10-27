/**
 * Ayudas para leer los campos de un formulario enviado (`FormData`).
 *
 * Un campo ausente o con otro tipo de dato se trata como "sin valor" en vez
 * de lanzar un error, y la validación posterior decide qué hacer.
 */

/**
 * Lee un campo de texto.
 *
 * @param datos Formulario enviado.
 * @param nombre Atributo `name` del campo.
 * @returns El texto, o cadena vacía si falta o es un archivo.
 */
export function leerTexto(datos: FormData, nombre: string): string {
  const valor = datos.get(nombre);
  return typeof valor === "string" ? valor : "";
}

/**
 * Convierte un texto (campo o parámetro de la dirección) en un entero positivo.
 *
 * @param valor Texto a convertir, o `null` si no viene.
 * @returns El número, o `null` si falta o no es un entero positivo.
 */
export function leerEntero(valor: string | null): number | null {
  if (valor === null || valor.trim() === "") return null;
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

/**
 * Lee un campo numérico entero.
 *
 * @param datos Formulario enviado.
 * @param nombre Atributo `name` del campo.
 * @returns El entero, o `null` si falta o no es un número entero.
 */
export function leerNumero(datos: FormData, nombre: string): number | null {
  const texto = leerTexto(datos, nombre).trim();
  if (texto === "") return null;
  const numero = Number(texto);
  return Number.isInteger(numero) ? numero : null;
}
