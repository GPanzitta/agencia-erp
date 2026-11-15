/**
 * Identidad estable para los `*ngFor` del módulo.
 *
 * Sin `trackBy`, Angular destruye y recrea el nodo del DOM en cada ciclo de
 * detección. No es una cuestión de velocidad: en la Etapa 1 eso hacía que los
 * modales abiertos dentro de una lista se cerraran solos, y los tests seguían
 * en verde porque un test no ve un modal que desaparece.
 *
 * Se usa en toda colección que venga del backend o cambie por socket. Los
 * arreglos constantes declarados en el componente no lo necesitan.
 */

/** Para colecciones cuyo elemento trae `id`. */
export function trackPorId(indice: number, item: { id?: string }): string | number {
  return item?.id ? item.id : indice;
}

/** Para órdenes en templates donde viaja `numero` pero no `id`. */
export function trackPorNumero(indice: number, item: { numero?: string }): string | number {
  return item?.numero ? item.numero : indice;
}

/**
 * Para listas de strings (nombres de acción, de documento, fechas ISO): el
 * valor es la identidad.
 *
 * Cae al índice también con `''`, igual que los otros tres helpers: un string
 * vacío no identifica a nadie, y dos vacíos en la misma lista compartirían
 * clave — que es exactamente lo que un `trackBy` tiene que evitar.
 */
export function trackPorValor(indice: number, valor: string): string | number {
  return valor ? valor : indice;
}

/**
 * Para colecciones agrupadas cuyo elemento se identifica por `clave`.
 * Acepta `null` además de `undefined` porque hay pseudo-ítems agregados en el
 * componente (el "Todas" de la barra de filtrado) cuya `clave` es `null` a
 * propósito, no ausente: son la misma falta de identidad para este helper.
 */
export function trackPorClave(indice: number, item: { clave?: string | null }): string | number {
  return item?.clave ? item.clave : indice;
}
