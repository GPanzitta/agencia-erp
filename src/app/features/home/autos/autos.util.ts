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

/** Catálogo de marcas y modelos más comercializados en Argentina para autocompletar en 1 clic. */
export const CATALOGO_MARCAS_MODELOS: Record<string, string[]> = {
  Volkswagen: ['Amarok', 'Gol Trend', 'Golf', 'Nivus', 'Polo', 'Saveiro', 'Suran', 'T-Cross', 'Taos', 'Tiguan', 'Up!', 'Vento', 'Virtus', 'Voyage'],
  Toyota: ['Corolla', 'Corolla Cross', 'Etios', 'Hilux', 'RAV4', 'SW4', 'Yaris'],
  Ford: ['Bronco Sport', 'EcoSport', 'Fiesta Kinetic', 'Focus', 'Ka', 'Kuga', 'Maverick', 'Mondeo', 'Ranger', 'Territory'],
  Chevrolet: ['Cruze', 'Equinox', 'Onix', 'Prisma', 'S10', 'Spin', 'Tracker', 'Trailblazer'],
  Peugeot: ['208', '2008', '308', '3008', '408', '5008', 'Partner'],
  Fiat: ['Argo', 'Cronos', 'Fastback', 'Fiorino', 'Mobi', 'Palio', 'Pulse', 'Siena', 'Strada', 'Toro', 'Uno'],
  Renault: ['Alaskan', 'Captur', 'Clio', 'Duster', 'Kangoo', 'Kardian', 'Kwid', 'Logan', 'Oroch', 'Sandero', 'Stepway'],
  'Citroën': ['Berlingo', 'C3', 'C3 Aircross', 'C4 Cactus', 'C4 Lounge', 'C5 Aircross'],
  Jeep: ['Compass', 'Commander', 'Grand Cherokee', 'Renegade', 'Wrangler'],
  Nissan: ['Frontier', 'Kicks', 'March', 'Note', 'Sentra', 'Versa', 'X-Trail'],
  Honda: ['City', 'Civic', 'CR-V', 'Fit', 'HR-V', 'WR-V', 'ZR-V'],
  'Mercedes-Benz': ['Clase A', 'Clase C', 'Clase E', 'GLA', 'GLC', 'Sprinter'],
  BMW: ['Serie 1', 'Serie 2', 'Serie 3', 'X1', 'X3', 'X5'],
  Audi: ['A1', 'A3', 'A4', 'Q2', 'Q3', 'Q5'],
  RAM: ['1500', '2500', 'Rampage'],
  Hyundai: ['Creta', 'Kona', 'Santa Fe', 'Tucson'],
  Kia: ['Carnival', 'Cerato', 'K3', 'Seltos', 'Sportage'],
  Chery: ['QQ', 'Tiggo 2', 'Tiggo 3', 'Tiggo 4', 'Tiggo 7'],
};

export const MARCAS_SUGERIDAS: string[] = Object.keys(CATALOGO_MARCAS_MODELOS);

export function modelosDeMarca(marca: string | null | undefined): string[] {
  const limpia = (marca ?? '').trim().toLowerCase();
  if (!limpia) return [];
  const entrada = Object.entries(CATALOGO_MARCAS_MODELOS).find(([m]) => m.toLowerCase() === limpia);
  return entrada ? entrada[1] : [];
}

/**
 * Estima el año de patentamiento según la serie de chapa patente argentina (DNRPA):
 * - Patente Mercosur (AA 123 AA): AA=2016, AB=2017, AC=2018, AD=2019/20, AE=2020/21, AF=2021/23, AG=2023/24, AH=2025/26.
 * - Patente anterior (AAA 123): A=1995..P=2015.
 */
export function estimarAnioPorPatente(patente: string | null | undefined): number | null {
  const p = (patente ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z]{2}[0-9]{3}[A-Z]{0,2}$/.test(p)) {
    const pref = p.slice(0, 2);
    const num = Number(p.slice(2, 5));
    if (pref === 'AA') return 2016;
    if (pref === 'AB') return 2017;
    if (pref === 'AC') return 2018;
    if (pref === 'AD') return num >= 500 ? 2020 : 2019;
    if (pref === 'AE') return num >= 350 ? 2021 : 2020;
    if (pref === 'AF') return num < 200 ? 2021 : num >= 850 ? 2023 : 2022;
    if (pref === 'AG') return num < 350 ? 2023 : 2024;
    if (pref === 'AH') return num >= 450 ? 2026 : 2025;
    if (pref > 'AH' && pref <= 'AZ') return 2026;
  }
  if (/^[A-Z]{3}[0-9]{3}$/.test(p)) {
    const mapa: Record<string, number> = {
      A: 1996, B: 1998, C: 1999, D: 2001, E: 2004, F: 2006, G: 2007,
      H: 2008, I: 2010, J: 2011, K: 2011, L: 2012, M: 2013, N: 2014, O: 2015, P: 2015,
    };
    return mapa[p[0]] ?? null;
  }
  return null;
}

/** Links oficiales para consultar infracciones y radicación copiando la patente. */
export const LINKS_MULTAS_DNRPA = [
  { rotulo: 'Multas CABA', url: 'https://buenosaires.gob.ar/licenciasdeconducir/consulta-de-infracciones' },
  { rotulo: 'Multas PBA', url: 'https://infraccionesba.gba.gob.ar/consulta-infraccion' },
  { rotulo: 'Radicación DNRPA', url: 'https://www.dnrpa.gov.ar/portal_dnrpa/radicacion2.php' },
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
