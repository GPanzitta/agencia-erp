/**
 * COPIA IDÉNTICA de `taller-backend/src/ingredientes/normalizar-texto.util.ts`
 * (spec C5 §2.1). No se toca de un lado sin tocar el otro.
 *
 * El front no busca por su cuenta: quien decide qué encuentra `q` es el
 * backend. Acá se usa para tres cosas, todas de ahorro y de coherencia:
 * saber que el texto que se acaba de tipear normaliza igual que el anterior
 * (y entonces no repetir el pedido), y comparar dos términos de sinónimo
 * dentro del grupo que se está editando antes de mandarlos.
 *
 * `escaparLike` NO se copia: es del armado del SQL, y eso vive solo allá.
 */
export function normalizarTexto(valor: string | null | undefined): string {
  return String(valor ?? '')
    .normalize('NFD')
    // Bloque "Combining Diacritical Marks": es lo que NFD separó de la letra.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * La identidad de un código. `CAP-30`, `cap 30` y `CAP30` son el mismo código:
 * el proveedor que factura `30UF450V` y la etiqueta que dice `30 UF 450 V` no
 * son dos códigos distintos, son dos formas de tipear uno.
 */
export function normalizarCodigo(valor: string | null | undefined): string {
  return normalizarTexto(valor).replace(/ /g, '');
}

/**
 * Los términos con los que se busca. Los de un solo carácter se descartan:
 * "a" y "F" aparecen en medio catálogo y empatan todo con todo.
 */
export function tokenizar(valor: string | null | undefined): string[] {
  const normal = normalizarTexto(valor);
  if (!normal) return [];
  return normal.split(' ').filter((t) => t.length > 1);
}
