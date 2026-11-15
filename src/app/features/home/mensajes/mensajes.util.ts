/**
 * Espejo del render de plantillas del backend (`mensajes/plantilla.util.ts`),
 * para la vista previa de Configuración → Mensajes. Si cambia una regla allá,
 * cambia acá.
 */
export type Contexto = 'interesado' | 'operacion';
export type Canal = 'whatsapp' | 'email';

export interface Plantilla {
  id: string; clave: string | null; nombre: string; texto: string; contexto: Contexto; canal: Canal; asunto: string | null; activa: boolean; orden_visual: number;
}
export interface PlantillaLista { id: string; nombre: string; asunto: string | null; texto: string }
export interface EstadoCorreo { configurado: boolean; remitente: string | null; pruebas: boolean }
export interface MensajesPara {
  nombre: string; whatsapp: string | null; telefono: string | null; email: string | null;
  plantillas: Record<Canal, PlantillaLista[]>; correo: EstadoCorreo;
}
export interface MensajeEnviado { id: string; canal: Canal; para: string; asunto: string | null; cuerpo: string; plantilla: string | null; estado: 'abierto' | 'enviado' | 'fallido'; error: string | null; autor: string | null; created_at: string }
export interface Catalogo { plantillas: Plantilla[]; variables: Record<Contexto, string[]>; ayuda: Record<string, string>; correo: EstadoCorreo }

export const ROTULO_CONTEXTO: Record<Contexto, string> = { interesado: 'A quien consultó', operacion: 'A quien reservó o compró' };
export const ROTULO_CANAL: Record<Canal, string> = { whatsapp: 'WhatsApp', email: 'Correo' };

/** Datos de ejemplo para ver cómo queda un mensaje mientras se lo escribe. */
export const EJEMPLO: Record<string, string> = {
  cliente: 'Carolina', auto: 'Fiat Cronos Drive 1.3 2022', precio: 'US$ 15.200', link_auto: 'https://tuagencia.fgautos.com/autos/…', su_auto: 'Volkswagen Gol Trend 2015',
  cotizacion: 'US$ 6.500', vendedor: 'Lucas', agencia: 'Tu agencia', direccion: 'Av. Rivadavia 1234', telefono: '11 5555 0100', link_sitio: 'https://tuagencia.fgautos.com',
  operacion: 'OP-2026-0010', pagado: 'US$ 500', saldo: 'US$ 14.700', vence: '20/11/2026',
};

const RE_VARIABLE = /\{([a-z_]+)\}/g;
const prolija = (linea: string): string => linea.replace(/[ \t]{2,}/g, ' ').replace(/ +([.,;:!?)])/g, '$1').trimEnd();

/** La línea de una variable vacía desaparece entera; una variable desconocida queda a la vista. */
export function renderizarPlantilla(texto: string, datos: Record<string, string | null | undefined>): string {
  const lineas = (texto ?? '').split('\n').map((linea) => {
    let tieneVariables = false;
    let todasVacias = true;
    const rendida = linea.replace(RE_VARIABLE, (crudo, nombre: string) => {
      if (!(nombre in datos)) { todasVacias = false; return crudo; }
      tieneVariables = true;
      const valor = datos[nombre];
      const resuelto = valor === null || valor === undefined ? '' : String(valor);
      if (resuelto !== '') todasVacias = false;
      return resuelto;
    });
    return tieneVariables && todasVacias ? null : prolija(rendida);
  });
  return lineas.filter((l): l is string => l !== null).join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Las variables que el texto usa y ese tipo de mensaje no tiene. */
export function variablesDesconocidas(texto: string, permitidas: readonly string[]): string[] {
  return [...new Set([...(texto ?? '').matchAll(RE_VARIABLE)].map((m) => m[1]).filter((v) => !permitidas.includes(v)))];
}

/** La dirección que abre WhatsApp con el texto ya escrito. */
export function enlaceDeWhatsapp(telefono: string, texto: string): string {
  return `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`;
}

export const correoValido = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
