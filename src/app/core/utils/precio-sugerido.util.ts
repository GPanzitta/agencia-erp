/**
 * COPIA de `taller-backend/src/ingredientes/precio-sugerido.util.ts`
 * (spec C §2.3). No se toca de un lado sin tocar el otro.
 *
 * El ERP no decide el precio: el que congela el renglón es el backend. Acá se
 * usa para PROPONER —el placeholder del modal de diagnóstico y el precio
 * inicial del modal de presupuesto— y si las dos cuentas no dieran lo mismo,
 * el técnico vería un número en la pantalla y otro en la orden guardada.
 *
 * Único desvío respecto del original: `cost` y `precio_venta` son opcionales,
 * porque el `Ingredient` del ERP declara `precio_venta` así. Ojo con el
 * repuesto que llega por el escáner: viene con `cost: 0` (el resolver no manda
 * el costo) y con esta cuenta daría $0. Por eso trae aparte el
 * `precio_sugerido` que ya calculó el backend, y el modal de diagnóstico usa
 * ese en vez de llamar acá.
 */
export function precioSugerido(input: {
  cost?: number | null;
  precio_venta?: number | null;
  margen_porcentaje: number;
}): number {
  if (input.precio_venta !== null && input.precio_venta !== undefined) {
    return Number(input.precio_venta);
  }
  const cost = Number(input.cost) || 0;
  const margen = Number(input.margen_porcentaje) || 0;
  return Math.round(cost * (1 + margen / 100));
}
