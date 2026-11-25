import { ROTULO_ORIGEN, plata } from '../autos/autos.util';
import type { Moneda, MotivoRiesgo, PorMoneda, Riesgo } from './rentabilidad.service';

/** Textos, períodos y formatos del tablero de rentabilidad. Puro y testeado sin Angular. */

export { ROTULO_ORIGEN };

export const ROTULO_MOTIVO: Record<MotivoRiesgo, string> = {
  perdida: 'Se vende a pérdida',
  papeles: 'Papeles frenan la entrega',
  parado: 'Más de 60 días parado',
  margen_flaco: 'Margen flaco',
  sin_precio: 'Sin precio',
};

/** La frase que explica el riesgo más grave de esa unidad, con sus números. */
export function detalleDeRiesgo(r: Riesgo): string {
  switch (r.motivos[0]) {
    case 'perdida':
      return `Cuesta ${plata(r.costo, r.moneda)} y está a ${plata(r.precio, r.moneda)}: tal como está, pierde ${plata(Math.abs(r.margen ?? 0), r.moneda)}.`;
    case 'papeles':
      return r.dias >= 60
        ? `Hace ${r.dias} días que está y todavía no se puede entregar.`
        : `Los papeles frenan la entrega desde hace ${r.dias} días.`;
    case 'parado':
      return `${r.dias} días parado, con ${plata(r.costo, r.moneda)} puestos.`;
    case 'margen_flaco':
      return `Deja ${r.margen_pct}% sobre el precio: un mes malo se lo come.`;
    case 'sin_precio':
      return `Hace ${r.dias} días que está en stock y todavía no tiene precio.`;
    default:
      return '';
  }
}

/**
 * En qué moneda mostrar el número grande de una tarjeta. El sistema no convierte
 * entre monedas: si la agencia trabaja en dólares, manda el dólar; si sólo hay
 * pesos, manda el peso.
 */
export function monedaPrincipal(...valores: PorMoneda[]): Moneda {
  const usd = valores.reduce((s, v) => s + Math.abs(v.USD ?? 0), 0);
  const ars = valores.reduce((s, v) => s + Math.abs(v.ARS ?? 0), 0);
  return usd > 0 || ars === 0 ? 'USD' : 'ARS';
}

/** La otra moneda, sólo si tiene algo: «más $ 1.200.000». */
export function monedaSecundaria(principal: Moneda, ...valores: PorMoneda[]): Moneda | null {
  const otra: Moneda = principal === 'USD' ? 'ARS' : 'USD';
  return valores.some((v) => (v[otra] ?? 0) !== 0) ? otra : null;
}

export const pctTexto = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n.toLocaleString('es-AR')}%`);

// ─── Períodos ───────────────────────────────────────────────────────────────

export type AtajoPeriodo = 'mes' | 'mes_pasado' | 'trimestre' | 'anio';

const dos = (n: number) => `${n}`.padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

/**
 * Los atajos del período, calculados sobre el calendario local. Es lo que el
 * dueño quiere ver sin escribir fechas: este mes, el anterior, el trimestre.
 */
export function periodoDe(atajo: AtajoPeriodo, hoy: Date = new Date()): { desde: string; hasta: string } {
  const a = hoy.getFullYear();
  const m = hoy.getMonth();
  switch (atajo) {
    case 'mes':
      return { desde: `${a}-${dos(m + 1)}-01`, hasta: iso(hoy) };
    case 'mes_pasado':
      return { desde: iso(new Date(a, m - 1, 1)), hasta: iso(new Date(a, m, 0)) };
    case 'trimestre':
      return { desde: iso(new Date(a, m, hoy.getDate() - 90)), hasta: iso(hoy) };
    case 'anio':
      return { desde: `${a}-01-01`, hasta: iso(hoy) };
  }
}

/** AAAA-MM-DD → «01/11». */
export const dia = (f: string) => {
  const [, m, d] = f.slice(0, 10).split('-');
  return `${d}/${m}`;
};

export const textoPeriodo = (desde: string, hasta: string) => `Del ${dia(desde)} al ${dia(hasta)}`;
