/**
 * La factura que acompaña una entrega (compra directa o recepción de OC) y lo
 * que se paga por ella.
 *
 * Es la misma regla que `recepcion-importe.util.ts` del backend, copiada a
 * propósito: el botón dice «pagar $X» y ese $X tiene que ser lo que después
 * egresa la billetera. Antes el ERP mostraba los renglones mientras el gasto
 * nacía por la factura, y el IVA quedaba colgado como deuda.
 *
 * Funciones puras (patrón de la casa): se testean sin levantar Angular.
 */

/** Lo que el operario cargó de la factura, si la cargó. */
export interface FacturaCargada {
  neto?: number | null;
  iva?: number | null;
  percepciones?: number | null;
}

/**
 * Diferencia de redondeo que se tolera entre la factura y los renglones: el
 * proveedor redondea renglón por renglón y el sistema sobre el total. Es la
 * misma tolerancia del backend; si divergen, el backend frena igual y el ERP
 * ofrece la confirmación con lo que contestó (ver FACTURA_DIFIERE).
 */
export const TOLERANCIA_FACTURA = 1;

/** La alícuota de IVA más alta que existe: arriba de esto, es un error de tipeo. */
const ALICUOTA_MAXIMA_IVA = 0.27;

const centavos = (n: number) => Number(Number(n).toFixed(2));

/** Una factura con neto 0 (o sin neto) no es una factura: no viaja. */
export function hayFactura(neto: number | null | undefined): boolean {
  return neto != null && Number(neto) > 0;
}

/**
 * Cuánto vale la entrega, y en contra entrega cuánto sale de la billetera:
 * la factura entera (neto + IVA + percepciones) si vino, si no los renglones.
 * Sin factura el IVA suelto no cuenta, igual que en el backend.
 */
export function importeAPagar(factura: FacturaCargada, renglonesArs: number): number {
  if (!hayFactura(factura.neto)) return centavos(renglonesArs);
  return centavos(Number(factura.neto) + Number(factura.iva ?? 0) + Number(factura.percepciones ?? 0));
}

/**
 * El neto no coincide con lo recibido: un neto viejo, la factura tipeada en
 * dólares, un cero de más… o una bonificación real. No se decide acá cuál
 * es: se le muestra al operario y, si la confirma, viaja `factura_difiere`.
 */
export function netoDifiere(neto: number | null | undefined, renglonesArs: number): boolean {
  if (!hayFactura(neto)) return false;
  return Math.abs(centavos(Number(neto)) - centavos(renglonesArs)) > TOLERANCIA_FACTURA;
}

/**
 * IVA arriba del 27% del neto (más el mismo $1 de redondeo del backend): no
 * hay alícuota más alta, así que es un tipeo (2.100 por 210) y no se puede
 * confirmar. El backend también lo rechaza; se frena antes de mandar porque
 * en la compra directa cada rechazo deja una OC creada y cancelada.
 */
export function ivaExcedido(neto: number | null | undefined, iva: number | null | undefined): boolean {
  if (!hayFactura(neto) || iva == null) return false;
  return centavos(Number(iva)) > centavos(Number(neto) * ALICUOTA_MAXIMA_IVA) + TOLERANCIA_FACTURA;
}
