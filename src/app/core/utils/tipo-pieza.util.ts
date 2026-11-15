/**
 * COPIA DECLARADA de `taller-backend/src/ingredientes/tipo-pieza.util.ts`,
 * idéntica de `export const ETIQUETAS_TIPO_PIEZA` para abajo (la tercera
 * copia es `taller-portal/app/lib/tipo-pieza.ts`). No se toca de un lado sin
 * tocar los otros: un tipo que este selector ofrece y el backend no conoce es
 * un 400 al guardar el repuesto.
 */
export const ETIQUETAS_TIPO_PIEZA = {
  amortiguador: 'Amortiguador',
  bisagra: 'Bisagra',
  blocapuerta: 'Blocapuerta',
  'bomba-desagote': 'Bomba de desagote',
  botonera: 'Botonera',
  burlete: 'Burlete',
  'capacitor-alta': 'Capacitor de alta tensión',
  compresor: 'Compresor',
  'control-remoto': 'Control remoto',
  correa: 'Correa',
  'diodo-alta': 'Diodo de alta tensión',
  electrovalvula: 'Electroválvula',
  estante: 'Estante o cajón',
  filtro: 'Filtro',
  flex: 'Cable flex',
  forzador: 'Forzador',
  fuente: 'Fuente de alimentación',
  fusible: 'Fusible',
  lampara: 'Lámpara',
  magnetron: 'Magnetrón',
  manguera: 'Manguera',
  manija: 'Manija',
  membrana: 'Membrana o teclado',
  mica: 'Mica',
  microswitch: 'Microswitch de puerta',
  'modulo-wifi': 'Módulo WiFi',
  motor: 'Motor',
  'motor-plato': 'Motor del plato',
  'motor-ventilador': 'Motor ventilador',
  pantalla: 'Pantalla (panel)',
  parlante: 'Parlante',
  perilla: 'Perilla',
  pie: 'Pie o base',
  'placa-main': 'Placa main',
  plaqueta: 'Plaqueta electrónica',
  plato: 'Plato giratorio',
  presostato: 'Presostato',
  'receptor-ir': 'Receptor infrarrojo',
  rele: 'Relé de arranque',
  resistencia: 'Resistencia',
  rodamiento: 'Rodamiento',
  't-con': 'Placa T-con',
  termostato: 'Termostato',
  timer: 'Timer de desescarche',
  'tira-led': 'Tira LED',
  'transformador-alta': 'Transformador de alta tensión',
} as const;

export type TipoPieza = keyof typeof ETIQUETAS_TIPO_PIEZA;

export const TIPOS_PIEZA = Object.keys(ETIQUETAS_TIPO_PIEZA) as TipoPieza[];

/** `hasOwnProperty` y no `in`: "toString" está en el prototipo de cualquier objeto. */
export function esTipoPieza(valor: unknown): valor is TipoPieza {
  return typeof valor === 'string' && Object.prototype.hasOwnProperty.call(ETIQUETAS_TIPO_PIEZA, valor);
}
