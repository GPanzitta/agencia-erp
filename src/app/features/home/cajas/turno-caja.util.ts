/**
 * Cuentas del turno de caja, sin Angular: los montos viajan como string
 * (decimal de Postgres) y los centavos se redondean acá, una sola vez, para que
 * la diferencia en vivo del cierre dé lo mismo que va a calcular el backend.
 */

/** Una fila del conteo: lo que el sistema espera y lo que el operador contó. */
export interface FilaConteo {
  wallet_id: string;
  nombre: string;
  /** Lo que dice el sistema (esperado al cerrar; saldo del libro al abrir). */
  esperado: number;
  /** Lo contado. `null` mientras no lo cargó: no cuenta como cero. */
  declarado: number | null;
  /** Al abrir: el saldo del sistema es negativo y se precargó en cero. */
  saldoNegativo?: boolean;
}

/** Número seguro a dos decimales: acepta string, null, NaN. */
export function aNumero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** Diferencia de una fila (contado − esperado), o `null` si todavía no se contó. */
export function diferenciaDeFila(f: FilaConteo): number | null {
  if (f.declarado === null || f.declarado === undefined || Number.isNaN(f.declarado)) return null;
  return aNumero(f.declarado - f.esperado);
}

export function totalEsperado(filas: FilaConteo[]): number {
  return aNumero(filas.reduce((s, f) => s + f.esperado, 0));
}

/** Suma lo contado; las filas sin contar no suman. */
export function totalDeclarado(filas: FilaConteo[]): number {
  return aNumero(filas.reduce((s, f) => s + (f.declarado ?? 0), 0));
}

export function totalDiferencia(filas: FilaConteo[]): number {
  return aNumero(filas.reduce((s, f) => s + (diferenciaDeFila(f) ?? 0), 0));
}

/** Hay diferencia si alguna billetera contada no da con lo esperado. */
export function hayDiferencia(filas: FilaConteo[]): boolean {
  return filas.some((f) => {
    const d = diferenciaDeFila(f);
    return d !== null && d !== 0;
  });
}

/** Todas las filas tienen un monto válido (≥ 0): condición para confirmar. */
export function conteoCompleto(filas: FilaConteo[]): boolean {
  return filas.length > 0 && filas.every((f) => f.declarado !== null && Number.isFinite(f.declarado) && f.declarado >= 0);
}

/** Lo que se manda al abrir: una entrada por billetera. */
export function montosDeApertura(filas: FilaConteo[]): { wallet_id: string; amount: number }[] {
  return filas.map((f) => ({ wallet_id: f.wallet_id, amount: aNumero(f.declarado) }));
}

/** Lo que se manda al cerrar. */
export function montosDeCierre(filas: FilaConteo[]): { wallet_id: string; declared_amount: number }[] {
  return filas.map((f) => ({ wallet_id: f.wallet_id, declared_amount: aNumero(f.declarado) }));
}
