/**
 * Los medios con los que el chofer cobra en la puerta (D2, tanda 3b) y cómo se
 * llaman en pantalla.
 *
 * Los tres de hoy son los `MEDIOS_COBRO_PUERTA` de
 * `taller-backend/src/rutas/ruta.util.ts`: efectivo, transferencia y Mercado
 * Pago, cada uno a su billetera. La tarjeta ya no se ofrece, pero queda en las
 * paradas cobradas antes del cambio y hay que saber nombrarla.
 */
export type MedioCobroPuerta = 'efectivo' | 'transferencia' | 'mercado_pago';

/**
 * Lo que manda el backend en `ruta.medios_cobro`: un medio que el chofer puede
 * usar ahora (su billetera existe y está activa) y el nombre de esa billetera,
 * sin saldo.
 */
export interface MedioDisponible {
  medio: MedioCobroPuerta;
  billetera: string;
}

const ETIQUETAS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercado_pago: 'Mercado Pago',
  tarjeta: 'Tarjeta',
};

/**
 * El nombre del medio para mostrar: «Mercado Pago» y no `mercado_pago`. Un
 * medio que no conoce vuelve tal cual (mejor eso que esconderlo) y sin medio
 * vuelve vacío.
 */
export function etiquetaMedio(medio: string | null | undefined): string {
  if (medio == null) return '';
  return Object.prototype.hasOwnProperty.call(ETIQUETAS, medio) ? ETIQUETAS[medio] : medio;
}
