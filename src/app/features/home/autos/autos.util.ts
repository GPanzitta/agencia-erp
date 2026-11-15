import type { EstadoPapel, EstadoUnidad, MedioPago, Moneda, OrigenUnidad, Unidad } from './autos.service';

/** Textos y formatos de la agencia. Puro y testeado sin Angular (patrón de la casa). */

export const ROTULO_ESTADO: Record<EstadoUnidad, string> = {
  ingreso: 'Recién ingresada', alistaje: 'En alistaje', disponible: 'Disponible', reservada: 'Reservada',
  vendida: 'Vendida', devuelta: 'Devuelta', baja: 'De baja',
};
export const ROTULO_ORIGEN: Record<OrigenUnidad, string> = { compra: 'Compra', toma: 'Toma en parte de pago', consignacion: 'Consignación' };
export const ROTULO_PAPEL: Record<EstadoPapel, string> = { falta: 'Falta', en_tramite: 'En trámite', ok: 'Está' };
export const ROTULO_MEDIO: Record<MedioPago, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', cheque: 'Cheque', credito: 'Crédito', usado: 'Usado en parte de pago', otro: 'Otro',
};
export const TEXTO_SEMAFORO = { rojo: 'Faltan papeles que frenan la venta', amarillo: 'Nada frena la venta, pero hay papeles en trámite o por completar', verde: 'Papeles en regla' };

export const COMBUSTIBLES = [['nafta', 'Nafta'], ['diesel', 'Diésel'], ['gnc', 'GNC'], ['hibrido', 'Híbrido'], ['electrico', 'Eléctrico']];
export const CAJAS = [['manual', 'Manual'], ['automatica', 'Automática']];
export const CARROCERIAS = [
  ['sedan', 'Sedán'], ['hatchback', 'Hatchback'], ['suv', 'SUV'], ['pickup', 'Pickup'], ['coupe', 'Coupé'],
  ['rural', 'Rural'], ['monovolumen', 'Monovolumen'], ['utilitario', 'Utilitario'], ['moto', 'Moto'], ['otro', 'Otro'],
];

/** «US$ 18.500» o «$ 17.250.000». Sin centavos si son cero. */
export function plata(monto: number | null | undefined, moneda: Moneda): string {
  if (monto === null || monto === undefined) return '—';
  const entero = Math.abs(monto % 1) < 0.005;
  const n = monto.toLocaleString('es-AR', { minimumFractionDigits: entero ? 0 : 2, maximumFractionDigits: entero ? 0 : 2 });
  return `${moneda === 'USD' ? 'US$' : '$'} ${n}`;
}

export const km = (n: number) => `${n.toLocaleString('es-AR')} km`;

/** AB123CD → «AB 123 CD»; ABC123 → «ABC 123». */
export function dominioLegible(d: string | null): string {
  if (!d) return 'Sin dominio';
  if (/^[A-Z]{2}[0-9]{3}[A-Z]{2}$/.test(d)) return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
  if (/^[A-Z]{3}[0-9]{3}$/.test(d)) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return d;
}

/** «2019 · 82.000 km · Automática». */
export function renglon(u: Pick<Unidad, 'anio' | 'km' | 'transmision' | 'condicion'>): string {
  const caja = CAJAS.find(([v]) => v === u.transmision)?.[1];
  return [String(u.anio), u.condicion === '0km' ? '0 km' : km(u.km), caja].filter(Boolean).join(' · ');
}

/** Cuánto lleva parada: a partir de 60 días ya es plata inmovilizada. */
export function claseDias(dias: number): '' | 'pronto' | 'vencido' {
  return dias > 90 ? 'vencido' : dias > 60 ? 'pronto' : '';
}

export function textoDias(dias: number): string {
  return dias === 0 ? 'Entró hoy' : dias === 1 ? '1 día en stock' : `${dias} días en stock`;
}

/** AAAA-MM-DD → DD/MM/AAAA. */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** Texto libre → monto, o null si no es un número mayor a cero. «18.500» son miles; «18,5» es decimal. */
export function monto(texto: string | number | null | undefined): number | null {
  if (texto === null || texto === undefined) return null;
  const limpio = String(texto).trim().replace(/US\$|\$/gi, '').replace(/\s/g, '');
  if (!limpio) return null;
  const normal = limpio.includes(',') ? limpio.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(limpio) ? limpio.replace(/\./g, '') : limpio;
  const n = Number(normal);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * La dirección del sitio público de la agencia: su nombre corto delante del dominio del sitio.
 * `http://localhost:3201` + `perez` → `http://perez.localhost:3201`.
 */
export function urlDelSitio(portalUrl: string, slug: string | null | undefined): string {
  if (!slug) return portalUrl;
  try {
    const u = new URL(portalUrl);
    const host = u.hostname.startsWith('www.') ? u.hostname.slice(4) : u.hostname;
    u.hostname = slug + '.' + host;
    const texto = u.toString();
    return texto.endsWith('/') ? texto.slice(0, -1) : texto;
  } catch {
    return portalUrl;
  }
}
