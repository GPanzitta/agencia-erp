/** `320 KB`, `1,4 MB`: el tamaño de un archivo como lo lee una persona. */
export function tamanoLegible(bytes: number | null | undefined): string {
  const b = Math.max(0, Number(bytes) || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
}
