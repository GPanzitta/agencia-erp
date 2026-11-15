/**
 * La publicación de un auto (14/11/2026): lo que el sitio muestra además de los
 * datos básicos. Se edita en el ERP con la misma forma que tiene en el sitio.
 */
export interface Destacado { nombre: string; categoria: string }
export interface Caracteristica { grupo: string; etiqueta: string; valor: string }
export interface ColorDeAuto { nombre: string; hex: string }

export interface Publicacion {
  /** Lo que más vende del auto: «Tapizado de cuero», «Apple CarPlay». */
  destacados: Destacado[];
  /** La ficha técnica, agrupada: General, Exterior, Seguridad… */
  caracteristicas: Caracteristica[];
  /** Los colores en que se consigue (un usado suele tener uno). */
  colores: ColorDeAuto[];
  /** El precio si lo financia con la agencia; vacío = no se muestra esa opción. */
  precio_financiado: number | null;
  /** Mostrar la opción «Entregá tu usado en parte de pago». */
  mostrar_toma: boolean;
  /** Otros autos del stock que se ofrecen al lado; vacío = los elige el sitio (mismo modelo y precio parecido). */
  relacionadas: string[];
}

export const PUBLICACION_VACIA: Publicacion = { destacados: [], caracteristicas: [], colores: [], precio_financiado: null, mostrar_toma: true, relacionadas: [] };

export const CATEGORIAS = ['Confort', 'Entretenimiento', 'Seguridad', 'Tapizado', 'Exterior', 'Motor'];
export const GRUPOS = ['General', 'Exterior', 'Equipamiento y confort', 'Seguridad', 'Interior', 'Entretenimiento'];

export const TOPES = { destacados: 12, caracteristicas: 60, colores: 8, relacionadas: 6, texto: 60 };

/** Las características que suele traer una publicación, para no arrancar de una hoja en blanco. */
export const PLANTILLA: [string, string][] = [
  ['General', 'Caballos de fuerza'], ['General', 'Litros'], ['General', 'Cilindros'], ['General', 'Velocidades'], ['General', 'Tracción'],
  ['Exterior', 'Puertas'], ['Exterior', 'Llantas'], ['Exterior', 'Faros'],
  ['Equipamiento y confort', 'Aire acondicionado'], ['Equipamiento y confort', 'Sensor de estacionamiento'], ['Equipamiento y confort', 'Cámara de retroceso'], ['Equipamiento y confort', 'Botón de encendido'], ['Equipamiento y confort', 'Control de velocidad crucero'],
  ['Seguridad', 'Airbags'], ['Seguridad', 'Frenos ABS'], ['Seguridad', 'Control de estabilidad'], ['Seguridad', 'Anclajes ISOFIX'],
  ['Interior', 'Pasajeros'], ['Interior', 'Tapizado'],
  ['Entretenimiento', 'Pantalla táctil'], ['Entretenimiento', 'Apple CarPlay'], ['Entretenimiento', 'Android Auto'], ['Entretenimiento', 'Bluetooth'],
];

const limpio = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, TOPES.texto);
export const esHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s);

/** Suma a lo cargado las características de la plantilla que todavía no están, sin valor. */
export function conPlantilla(actuales: Caracteristica[]): Caracteristica[] {
  const tiene = new Set(actuales.map((c) => `${c.grupo}|${c.etiqueta}`.toLowerCase()));
  const nuevas = PLANTILLA.filter(([g, e]) => !tiene.has(`${g}|${e}`.toLowerCase())).map(([grupo, etiqueta]) => ({ grupo, etiqueta, valor: '' }));
  return [...actuales, ...nuevas].slice(0, TOPES.caracteristicas);
}

/** Las características por grupo, en el orden de siempre y con los grupos propios al final. */
export function porGrupo<T extends { grupo: string }>(lista: T[]): { grupo: string; items: T[] }[] {
  const grupos = [...GRUPOS, ...lista.map((c) => c.grupo).filter((g) => !GRUPOS.includes(g))];
  return [...new Set(grupos)].map((grupo) => ({ grupo, items: lista.filter((c) => c.grupo === grupo) })).filter((g) => g.items.length);
}

/**
 * Lo que se manda a guardar: sin renglones vacíos ni repetidos y dentro de los topes.
 * Una característica sin valor no se publica: es un renglón de la plantilla que no se llenó.
 */
export function paraGuardar(p: Publicacion): Publicacion {
  const unicos = <T>(lista: T[], clave: (x: T) => string) => [...new Map(lista.map((x) => [clave(x).toLowerCase(), x])).values()];
  return {
    destacados: unicos(p.destacados.map((d) => ({ nombre: limpio(d.nombre), categoria: limpio(d.categoria) || CATEGORIAS[0] })).filter((d) => d.nombre), (d) => d.nombre).slice(0, TOPES.destacados),
    caracteristicas: unicos(
      p.caracteristicas.map((c) => ({ grupo: limpio(c.grupo) || GRUPOS[0], etiqueta: limpio(c.etiqueta), valor: limpio(c.valor) })).filter((c) => c.etiqueta && c.valor),
      (c) => `${c.grupo}|${c.etiqueta}`,
    ).slice(0, TOPES.caracteristicas),
    colores: unicos(p.colores.map((c) => ({ nombre: limpio(c.nombre), hex: esHex(c.hex) ? c.hex.toLowerCase() : '#888888' })).filter((c) => c.nombre), (c) => c.nombre).slice(0, TOPES.colores),
    precio_financiado: p.precio_financiado !== null && p.precio_financiado > 0 ? p.precio_financiado : null,
    mostrar_toma: !!p.mostrar_toma,
    relacionadas: [...new Set(p.relacionadas)].slice(0, TOPES.relacionadas),
  };
}
