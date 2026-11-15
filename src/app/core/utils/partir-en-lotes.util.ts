const codificador = new TextEncoder();
const bytesDe = (x: unknown) => codificador.encode(JSON.stringify(x)).length;

/**
 * Parte filas para mandarlas de a pedazos: por cantidad y por tamaño, porque el
 * cuerpo de un pedido tiene un límite y un renglón con notas largas pesa mucho más
 * que uno corto.
 */
export function partirEnLotes<T>(filas: T[], maxFilas: number, maxBytes: number): T[][] {
  const lotes: T[][] = [];
  let lote: T[] = [];
  let bytes = 2; // los corchetes
  for (const fila of filas) {
    const peso = bytesDe(fila) + 1; // la coma
    if (lote.length && (lote.length >= maxFilas || bytes + peso > maxBytes)) {
      lotes.push(lote);
      lote = [];
      bytes = 2;
    }
    lote.push(fila);
    bytes += peso;
  }
  if (lote.length) lotes.push(lote);
  return lotes;
}
