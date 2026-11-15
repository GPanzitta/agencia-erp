import type { EtapaInteresado, Interesado } from './autos.service';
import { CARROCERIAS, fecha, plata } from './autos.util';

/** Textos del tablero de interesados. Puro y testeado sin Angular. */

export const ETAPAS_DEL_TABLERO: { valor: EtapaInteresado; rotulo: string }[] = [
  { valor: 'nuevo', rotulo: 'Nuevos' },
  { valor: 'contactado', rotulo: 'Contactados' },
  { valor: 'visita', rotulo: 'Vienen a verlo' },
  { valor: 'negociando', rotulo: 'Negociando' },
];

export const ROTULO_ETAPA: Record<EtapaInteresado, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', visita: 'Viene a verlo', negociando: 'Negociando', ganado: 'Compró', perdido: 'Se perdió',
};

export const ORIGENES: [string, string][] = [
  ['salon', 'Vino al salón'], ['whatsapp', 'WhatsApp'], ['telefono', 'Llamó'], ['sitio', 'Sitio web'],
  ['mercado_libre', 'Mercado Libre'], ['referido', 'Recomendado'], ['otro', 'Otro'],
];
export const rotuloOrigen = (o: string): string => ORIGENES.find(([v]) => v === o)?.[1] ?? o;

export const TEMPERATURAS: [string, string][] = [['caliente', 'Caliente'], ['tibio', 'Tibio'], ['frio', 'Frío']];

/** Lo que busca, en una línea: «Pickup Toyota hasta US$ 36.000». Vacío si no cargó nada cruzable. */
export function resumenDeBusqueda(i: Pick<Interesado, 'busca_marca' | 'busca_carroceria' | 'precio_max' | 'precio_moneda'>): string {
  const tipo = CARROCERIAS.find(([v]) => v === i.busca_carroceria)?.[1];
  const tope = i.precio_max ? `hasta ${plata(i.precio_max, i.precio_moneda === 'ARS' ? 'ARS' : 'USD')}` : null;
  return [tipo, i.busca_marca, tope].filter(Boolean).join(' ');
}

/** Cuándo toca hablarle, dicho como se lo diría un compañero. */
export function textoProxima(i: Pick<Interesado, 'proxima_accion' | 'atrasado' | 'toca_hoy' | 'etapa'>): string {
  if (i.etapa === 'ganado' || i.etapa === 'perdido') return '';
  if (!i.proxima_accion) return 'Sin fecha para volver a hablarle';
  if (i.toca_hoy) return 'Hablarle hoy';
  return i.atrasado ? `Había que hablarle el ${fecha(i.proxima_accion)}` : `Hablarle el ${fecha(i.proxima_accion)}`;
}

export function claseProxima(i: Pick<Interesado, 'proxima_accion' | 'atrasado' | 'toca_hoy'>): '' | 'vencido' | 'pronto' {
  return i.atrasado ? 'vencido' : i.toca_hoy || !i.proxima_accion ? 'pronto' : '';
}

/** El WhatsApp del interesado: número argentino de celular con país. null si no hay cómo armarlo. */
export function linkWhatsapp(telefono: string | null, nombre: string, mensaje = ''): string | null {
  let d = (telefono ?? '').replace(/\D/g, '');
  if (d.startsWith('549')) d = d.slice(3);
  else if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length !== 10) return null;
  const saludo = `Hola ${nombre.split(' ')[0]}, ${mensaje}`;
  return `https://wa.me/549${d}?text=${encodeURIComponent(saludo)}`;
}

/** Los números de arriba del tablero. */
export function cuentas(activos: Interesado[]): { hoy: number; atrasados: number; sinFecha: number; conAutos: number } {
  return {
    hoy: activos.filter((i) => i.toca_hoy).length,
    atrasados: activos.filter((i) => i.atrasado).length,
    sinFecha: activos.filter((i) => !i.proxima_accion).length,
    conAutos: activos.filter((i) => i.sugeridas.length > 0).length,
  };
}

/** El orden dentro de una columna: primero lo atrasado, después lo de hoy, después por fecha. */
export function ordenar(lista: Interesado[]): Interesado[] {
  const peso = (i: Interesado) => (i.atrasado ? 0 : i.toca_hoy ? 1 : i.proxima_accion ? 2 : 3);
  return [...lista].sort((a, b) => peso(a) - peso(b) || (a.proxima_accion ?? '').localeCompare(b.proxima_accion ?? ''));
}

/** Lo que se le escribe al mandarle la cotización de su auto (sigue al «Hola Fulano, »). */
export function mensajeDeCotizacion(i: Pick<Interesado, 'tiene_usado'>, importe: string): string {
  const auto = (i.tiene_usado ?? '').split(',')[0].trim();
  return `te pasamos la cotización de tu ${auto || 'auto'}: ${importe}. Es un valor estimado, se confirma viendo la unidad y sus papeles. ¿Cuándo te queda bien acercarla?`;
}
