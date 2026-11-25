/**
 * Chasis de los documentos impresos, opción B «De marca» (elegida por el
 * dueño el 13/10/2026; maqueta en documentos/opciones/B del relevamiento).
 * Reemplaza al chasis del prototipo de Figma del 08/09/2026.
 *
 * Todo es función pura que devuelve HTML: la plantilla no sabe de Angular ni
 * del navegador, así que se testea leyendo el string. Quien abre la ventana
 * de impresión es DocumentosService.
 *
 * Reglas del diseño (relevamiento, sección D):
 * - Hoja A4 en milímetros y tamaños en puntos: impresa al 100 % mide lo que
 *   dice. Nada que cree derechos u obligaciones por debajo de 10 pt (Res.
 *   906/98: 1,8 mm aun midiendo la «x»); rótulos y pie, oscuros (contraste
 *   ≥ 4,5:1), nunca gris claro.
 * - Membrete de la EMPRESA USUARIA (el papel es del taller, no de GUSMAT):
 *   logo si lo hay, razón social, domicilio, contacto, CUIT, IVA, IIBB.
 * - Leyenda «X — DOCUMENTO NO VÁLIDO COMO FACTURA» junto al número (RG 1415).
 * - Tipografías Montserrat (títulos) y Figtree (texto) desde Google Fonts,
 *   con Arial de respaldo (la ventana de impresión puede no tener red).
 * - Pie con la identificación del prestador y «Página n de m».
 */
import { scriptDocumento } from './script-documento';

export interface MembreteEmpresa {
  name: string;
  direccion?: string | null;
  telefono?: string | null;
  cuit?: string | null;
  /** Datos legales (contrato opción B §1). Vacíos = no se imprimen. */
  razon_social?: string | null;
  condicion_iva?: string | null;
  iibb?: string | null;
  inicio_actividades?: string | null;
  email_contacto?: string | null;
  horario_atencion?: string | null;
  /** Dominio del sitio del taller, si la API lo manda. */
  domain?: string | null;
  /** Logo del perfil público (Configuración › Sitio web), si hay. */
  logo_url?: string | null;
}

export interface Columna {
  texto: string;
  ancho?: string;
  alinear?: 'izq' | 'centro' | 'der';
}

export interface LineaTotal {
  rotulo: string;
  valor: string;
  /** Fila oscura con el monto grande (el TOTAL). */
  destacado?: boolean;
}

// ─── Texto y formato ──────────────────────────────────────────────────────

/** Todo lo que viene del usuario entra al HTML escapado. */
export function esc(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * SEG-ERP-02: lo único que entra a un `src`/`href` armado a mano. Sólo
 * http(s) absoluto; cualquier otro esquema (`javascript:`, `data:`,
 * `vbscript:`), una URL relativa o una «//otro-host» sale vacía. Las
 * relativas del backend se resuelven ANTES con `urlFoto`. Después de esto,
 * igual va por `esc()`.
 */
export function soloHttp(url: string | null | undefined): string {
  const u = String(url ?? '').trim();
  return /^https?:\/\/[^\s/]/i.test(u) ? u : '';
}

/** Texto libre multilínea, escapado, con saltos respetados. */
export function texto(s: string | null | undefined): string {
  return esc(s).replace(/\r?\n/g, '<br>');
}

/** Monto con centavos: «$ 1.234,50». Las tablas de compras y ventas. */
export function plata(n: number | string | null | undefined, usd = false): string {
  const v = Number(n) || 0;
  return `${usd ? 'USD ' : '$ '}${v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Monto del papel del cliente (diseño B): sin «,00» si es entero, con
 * centavos si los tiene. «$ 450.000», «$ 1.234,50». Espacio duro: el signo
 * no queda solo al final de un renglón.
 */
export function pesos(n: number | string | null | undefined): string {
  const v = Number(n) || 0;
  const entero = Math.round(v * 100) % 100 === 0;
  return '$ ' + v.toLocaleString('es-AR', { minimumFractionDigits: entero ? 0 : 2, maximumFractionDigits: entero ? 0 : 2 });
}

export function aFecha(d: string | Date | null | undefined): Date | null {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
  // Una fecha sin hora ("2026-09-08", como la de la ruta) es un día del
  // calendario local: parseada como ISO caería a las 21:00 del día anterior.
  const soloDia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (soloDia) return new Date(Number(soloDia[1]), Number(soloDia[2]) - 1, Number(soloDia[3]));
  const f = new Date(d);
  return isNaN(f.getTime()) ? null : f;
}

/** «08/09/2026»: día y mes con dos cifras, como en la maqueta. */
export function fechaCorta(d: string | Date | null | undefined): string {
  const f = aFecha(d);
  return f ? f.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
}

export function hora(d: string | Date | null | undefined): string {
  const f = aFecha(d);
  // 24 h siempre: según el motor, es-AR sale «03:51 p. m.».
  return f ? f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';
}

/** "8 de marzo de 2027": para el vencimiento de la garantía. */
export function fechaLarga(d: string | Date | null | undefined): string {
  const f = aFecha(d);
  return f ? f.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

/** Días enteros desde hoy hasta la fecha (negativo si ya pasó). */
export function diasHasta(d: string | Date | null | undefined, hoy = new Date()): number {
  const f = aFecha(d);
  if (!f) return 0;
  const a = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  const b = new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

/** La misma fecha N meses después (garantía legal de los repuestos, art. 11). */
export function sumarMeses(d: Date, meses: number): Date {
  const f = new Date(d.getFullYear(), d.getMonth() + meses, d.getDate());
  // 31/08 + 6 meses no existe: queda el último día de febrero.
  if (f.getDate() !== d.getDate()) f.setDate(0);
  return f;
}

export function sumarDias(d: Date, dias: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
}

// ─── Identificación del prestador ─────────────────────────────────────────

/** Razón social; si no está cargada, el nombre del taller (contrato §1). */
export function razonSocial(e: MembreteEmpresa | null | undefined): string {
  return (e?.razon_social ?? '').trim() || (e?.name ?? '').trim() || 'Taller';
}

const IVA: Record<string, string> = {
  responsable_inscripto: 'IVA Responsable Inscripto',
  monotributo: 'Responsable Monotributo',
  exento: 'IVA Exento',
};

/** La condición frente al IVA como se imprime; vacía o desconocida no se imprime. */
export function condicionIva(c: string | null | undefined): string {
  return IVA[c ?? ''] ?? '';
}

/**
 * Pie de identificación (relevamiento C.1.2): razón social · CUIT · IVA ·
 * IIBB · inicio · domicilio · tel · correo · web. Sólo lo que está cargado.
 */
export function lineaPie(e: MembreteEmpresa | null | undefined): string {
  return [
    razonSocial(e),
    e?.cuit ? `CUIT ${e.cuit}` : '',
    condicionIva(e?.condicion_iva),
    e?.iibb ? `IIBB ${e.iibb}` : '',
    e?.inicio_actividades ? `Inicio de act. ${fechaCorta(String(e.inicio_actividades).slice(0, 10))}` : '',
    e?.direccion ?? '',
    e?.telefono ? `Tel. ${e.telefono}` : '',
    e?.email_contacto ?? '',
    e?.domain ?? '',
  ]
    .filter(Boolean)
    .map((x) => esc(x))
    .join(' · ');
}

// ─── Piezas ───────────────────────────────────────────────────────────────

/** Título de sección con el cuadradito naranja. */
export function h2(titulo: string, estilo = ''): string {
  return `<h2${estilo ? ` style="${estilo}"` : ''}>${esc(titulo)}</h2>`;
}

/** Recuadro de borde fino. El contenido llega como HTML ya escapado. */
export function card(html: string, clase = ''): string {
  return `<div class="card${clase ? ' ' + clase : ''}">${html}</div>`;
}

/** Pares rótulo / valor. Los valores se escapan; vacíos salen como «—». */
export function kv(pares: [string, string | number | null | undefined][]): string {
  return `<div class="kv">${pares
    .map(([k, v]) => `<div class="k">${esc(k)}</div><div>${v === null || v === undefined || v === '' ? '—' : esc(v)}</div>`)
    .join('')}</div>`;
}

/** Dos tarjetas con título lado a lado (cliente y equipo). */
export function cards(...bloques: string[]): string {
  return `<div class="cards">${bloques.join('')}</div>`;
}

export function bloque(titulo: string, contenido: string): string {
  return `<div>${h2(titulo)}${card(contenido)}</div>`;
}

export interface Dato {
  rotulo: string;
  valor: string;
  /** Valor largo (un domicilio): va en un cuerpo más chico. */
  chico?: boolean;
}

/**
 * La banda de color de arriba: lo que el cliente tiene que ver primero
 * (total, garantía, plazos) y, si hay, el QR al seguimiento.
 */
export function hero(h: { etiqueta: string; grande: string; grandeChico?: boolean; bajada?: string; datos: Dato[]; qr?: string | null; qrTexto?: string }): string {
  const datos = h.datos
    .map((d) => `<div class="fact"><div class="lbl">${esc(d.rotulo)}</div><div class="v${d.chico ? ' chico' : ''}">${esc(d.valor)}</div></div>`)
    .join('');
  const qr = h.qr ? `<div class="qrb">${h.qr}${esc(h.qrTexto ?? '')}</div>` : '';
  return `<div class="hero${h.qr ? '' : ' sin-qr'}"><div><div class="lbl">${esc(h.etiqueta)}</div><div class="big${h.grandeChico ? ' chico' : ''}">${esc(h.grande)}</div>${
    h.bajada ? `<div class="bajada">${h.bajada}</div>` : ''
  }<div class="facts c${Math.max(1, Math.min(4, h.datos.length))}">${datos}</div></div>${qr}</div>`;
}

/** Tabla de encabezado claro. Las celdas llegan como HTML ya escapado. */
export function tabla(columnas: Columna[], filas: string[][], vacio = 'Sin renglones.'): string {
  const th = columnas
    .map((c) => `<th style="${c.ancho ? `width:${c.ancho};` : ''}text-align:${alinear(c.alinear)}">${esc(c.texto)}</th>`)
    .join('');
  const tr = filas.length
    ? filas
        .map((f) => `<tr>${f.map((celda, i) => `<td style="text-align:${alinear(columnas[i]?.alinear)}">${celda}</td>`).join('')}</tr>`)
        .join('')
    : `<tr><td colspan="${columnas.length}" class="vacio">${esc(vacio)}</td></tr>`;
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

function alinear(a?: 'izq' | 'centro' | 'der'): string {
  return a === 'der' ? 'right' : a === 'centro' ? 'center' : 'left';
}

/** Nuevo / USADO del repuesto (`ml_condicion`). Sin dato, una raya. */
export function chipCondicion(c: string | null | undefined): string {
  if (c === 'usado') return '<span class="chip usado">USADO</span>';
  if (c === 'nuevo') return '<span class="chip">Nuevo</span>';
  return '—';
}

/** Cuadro de totales a la derecha; la fila destacada es oscura con el monto grande. */
export function totales(lineas: LineaTotal[], nota = ''): string {
  const filas = lineas
    .map((l) => `<div class="k${l.destacado ? ' big' : ''}"><span>${esc(l.rotulo)}</span><span>${esc(l.valor)}</span></div>`)
    .join('');
  return `<div class="tot"><div class="nota">${nota}</div><div>${filas}</div></div>`;
}

/** Destacado con barra naranja: 15 pt negrita (Res. 906/98 art. 3: 1,5 × el cuerpo). */
export function destacado(html: string, estilo = ''): string {
  return `<div class="dest"${estilo ? ` style="${estilo}"` : ''}>${html}</div>`;
}

/** Condiciones numeradas en dos columnas. Los textos llegan como HTML. */
export function condiciones(lista: [string, string][]): string {
  return `<div class="cond">${lista
    .map(([t, v], i) => `<div class="it"><div class="nn">${i + 1}</div><div><b class="t">${esc(t)}</b>${mayuscula(v)}</div></div>`)
    .join('')}</div>`;
}

function mayuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Párrafo legal a 10 pt; en caja gris claro (fondo, nunca el texto). */
export function legal(html: string, caja = true): string {
  return `<div class="legal${caja ? ' box' : ''}">${html}</div>`;
}

/** Recuadro de firma: la frase que se acepta arriba y las líneas debajo. */
export function firma(acepto: string, rotulos: string[], anchos?: string): string {
  const cols = anchos ?? rotulos.map(() => '1fr').join(' ');
  return `<div class="firma"><div class="acepto">${esc(acepto)}</div><div class="lineas" style="grid-template-columns:${cols}">${rotulos
    .map((r) => `<div>${esc(r)}</div>`)
    .join('')}</div></div>`;
}

/** QR chico con un texto al lado (aprobar online, seguir la orden). */
export function qrLinea(qr: string, html: string): string {
  return `<div class="qrline">${qr}<div>${html}</div></div>`;
}

/** Pasos numerados en tarjetas («Cómo sigue», «Cómo pedir la garantía»). */
export function pasos(lista: [string, string][]): string {
  return `<div class="pasos p${lista.length}">${lista
    .map(([t, v], i) => `<div class="paso"><div class="nn">${i + 1}</div><b>${esc(t)}</b>${v}</div>`)
    .join('')}</div>`;
}

/** Control de calidad: ✓ lo aprobado; lo pendiente, marcado como tal. */
export function checks(items: { texto: string; ok: boolean }[]): string {
  return `<div class="checks">${items
    .map((i) => `<span class="${i.ok ? 'ok' : 'pend'}">${i.ok ? '' : 'Pendiente: '}${esc(i.texto)}</span>`)
    .join('')}</div>`;
}

/** Talón de retiro recortable: el cliente lo presenta para retirar el equipo. */
export function talonRetiro(t: { numero: string; detalle: string; ayuda: string; qr?: string | null }): string {
  return `<div class="corte">✂ Talón de retiro — cortá y guardalo</div>
<div class="talon${t.qr ? '' : ' sin-qr'}"><div><div class="lbl">Presentalo para retirar tu equipo</div><div class="big">${esc(t.numero)}</div>${esc(t.detalle)}<br>${t.ayuda}</div>${t.qr ?? ''}</div>`;
}

// ─── Chasis ───────────────────────────────────────────────────────────────

export type Leyenda = 'x' | { interno: string };

export interface Hoja {
  /** Título grande (h1). */
  titulo: string;
  /** Segunda línea del título: «Constancia de recepción». */
  subtitulo?: string;
  numero: string;
  /**
   * El caso de la marca («Caso LG N° RNN…», texto plano): bajo el número y
   * con su mismo peso, porque es con el que la marca busca el equipo.
   */
  caso?: string | null;
  /** Líneas de referencia bajo el número (HTML ya escapado). */
  meta?: string;
  /** Default: la «X — documento no válido como factura». */
  leyenda?: Leyenda;
  cuerpo: string;
  /** «Original para el cliente», «Duplicado para el taller»… */
  copia?: string;
  /** «1 de 2». Sin dato no se numera. */
  pagina?: string;
  /**
   * Hoja de continuación: membrete reducido a una línea, con esta
   * referencia («Orden OR-2026-9050»).
   */
  continuacion?: string;
}

function leyendaHtml(l: Leyenda | undefined): string {
  if (l && typeof l === 'object') return `<div class="xchip interno">${esc(l.interno)}</div>`;
  return '<div class="xchip"><span class="x">X</span>DOCUMENTO NO VÁLIDO COMO FACTURA</div>';
}

function logo(e: MembreteEmpresa | null | undefined, clase = 'logo'): string {
  const src = soloHttp(e?.logo_url);
  if (src) return `<img class="${clase}" src="${esc(src)}" alt="${esc(e?.name ?? '')}">`;
  return `<div class="marca${clase === 'logo' ? '' : ' chica'}">${esc(e?.name || 'Taller')}</div>`;
}

/** Bloque del membrete: una línea por dato, sólo lo cargado. */
function membrete(e: MembreteEmpresa | null | undefined): string {
  const par = (a: string, b: string) => [a, b].filter(Boolean).join(' · ');
  const lineas = [
    `<b>${esc(razonSocial(e))}</b>`,
    esc(e?.direccion ?? ''),
    esc(par(e?.telefono ? `Tel. ${e.telefono}` : '', e?.email_contacto ?? '')),
    esc(par(e?.domain ?? '', e?.horario_atencion ?? '')),
    esc(par(e?.cuit ? `CUIT ${e.cuit}` : '', condicionIva(e?.condicion_iva))),
    esc(par(e?.iibb ? `IIBB ${e.iibb}` : '', e?.inicio_actividades ? `Inicio de act. ${fechaCorta(String(e.inicio_actividades).slice(0, 10))}` : '')),
  ].filter(Boolean);
  return `<div class="emp">${lineas.join('<br>')}</div>`;
}

/** Una hoja A4: membrete (completo o de continuación), cuerpo y pie. */
export function hoja(h: Hoja, empresa: MembreteEmpresa | null | undefined): string {
  const cabecera = h.continuacion
    ? `<div class="mini">${logo(empresa, 'logo-mini')}<div class="t">${esc(h.titulo)} N° ${esc(h.numero)}<span>${esc(
        [h.continuacion, razonSocial(empresa), empresa?.cuit ? `CUIT ${empresa.cuit}` : ''].filter(Boolean).join(' · '),
      )}</span></div>${leyendaHtml(h.leyenda)}</div>`
    : `<div class="hdr">${logo(empresa)}${membrete(empresa)}<div class="doc"><h1>${esc(h.titulo)}</h1>${
        h.subtitulo ? `<div class="sub">${esc(h.subtitulo)}</div>` : ''
      }<div class="num">N° ${esc(h.numero)}</div>${h.caso ? lineaDelCaso(h.caso) : ''}${h.meta ? `<div class="meta">${h.meta}</div>` : ''}${leyendaHtml(h.leyenda)}</div></div>`;
  const pg = [h.copia ? esc(h.copia) : '', h.pagina ? `Página ${esc(h.pagina)}` : ''].filter(Boolean).join('<br>');
  return `<section class="page">
${cabecera}<div class="barra"></div>
${h.cuerpo}
<div class="spacer"></div>
<div class="foot"><div>${lineaPie(empresa)}</div><div class="pg">${pg}</div></div>
</section>`;
}

/**
 * «Caso LG N° RNN…» en una línea, como el número: a 15 pt si entra en la
 * columna (86 mm ≈ 244 pt; Montserrat 800 mide ~0,66 em por carácter) y, si
 * no, achicado lo justo; por debajo de 11 pt se deja cortar. «N°» va pegado
 * al número. Mismo criterio que el PDF del backend (`lineaDelCaso`).
 */
function lineaDelCaso(caso: string): string {
  const medida = Math.floor((244 / (caso.length * 0.66)) * 2) / 2;
  const pt = Math.max(11, Math.min(15, medida));
  const corte = medida >= 11 ? ';white-space:nowrap' : '';
  return `<div class="num caso" style="font-size:${pt}pt${corte}">${esc(caso).replace(/N° /g, 'N°&nbsp;')}</div>`;
}

/** Varias hojas en una misma impresión: cada `hoja()` sale en su propia A4. */
export function documento(titulo: string, paginas: string[]): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Figtree:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
<style>${ESTILOS}</style>
</head>
<body>
${paginas.join('\n')}
<div class="no-print">
  <p>Imprimí al 100 % (sin «Ajustar a la página»). Podés tocar <b>«Editar texto en la hoja»</b> para retocar cualquier párrafo o dato antes de imprimir.</p>
  <button data-accion="imprimir">🖨️ Imprimir / Guardar PDF</button>
  <button class="secundario" data-accion="editar">✏️ Editar texto en la hoja</button>
  <button class="secundario" data-accion="cerrar">Cerrar</button>
</div>
${scriptDocumento()}
</body>
</html>`;
}

/** Atajo: un documento de una sola hoja. */
export function unaHoja(h: Hoja, empresa: MembreteEmpresa | null | undefined, tituloVentana?: string): string {
  return documento(tituloVentana ?? `${h.titulo} ${h.numero}`, [hoja(h, empresa)]);
}

/**
 * CSS de la opción B (generador b.cjs de la maqueta), con los ajustes del
 * ERP: la hoja crece si el contenido no entra (en vez de recortarlo), la
 * vista en pantalla tiene fondo y sombra, y los tamaños mínimos de D.3.
 */
const ESTILOS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
:root { --nar: #FF7F00; --ant: #2D2F31; --tinte: #FFF3E6; --linea: #CFC9C2; --suave: #F5F3F0; --rot: #3b3d40; --rot-tinte: #4a3a2a; }
html, body { margin: 0; padding: 0; }
body { background: #e7e4e0; font-family: 'Figtree', Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.32; color: #1d1f21; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; min-height: 297mm; margin: 8mm auto; padding: 10mm 11mm; background: #fff; box-shadow: 0 6px 30px rgba(0,0,0,.25); display: flex; flex-direction: column; }
.page > * { flex-shrink: 0; }
.spacer { flex: 1 1 auto; }
h1, h2, .mont { font-family: 'Montserrat', Arial, sans-serif; }
svg { display: block; }
.hdr { display: grid; grid-template-columns: auto 1fr auto; gap: 5mm; align-items: center; }
.hdr img.logo { height: 22mm; max-width: 45mm; object-fit: contain; }
.marca { font: 800 15pt/1.05 'Montserrat', Arial, sans-serif; color: var(--ant); max-width: 42mm; word-wrap: break-word; }
.marca.chica { font-size: 11pt; max-width: 30mm; }
.hdr .emp { font-size: 8.5pt; line-height: 1.38; color: var(--ant); border-left: 2pt solid var(--nar); padding-left: 3.5mm; }
.hdr .emp b { font-size: 9.5pt; }
.hdr .doc { text-align: right; max-width: 86mm; }
.hdr .doc h1 { margin: 0; font-weight: 800; font-size: 22pt; line-height: 1.05; color: var(--ant); letter-spacing: -.01em; }
.hdr .doc .sub { font: 700 12pt/1.2 'Montserrat', Arial, sans-serif; color: var(--ant); margin-top: .8mm; }
.hdr .doc .num { font: 800 15pt 'Montserrat', Arial, sans-serif; margin-top: 1mm; }
.hdr .doc .meta { font-size: 9pt; margin-top: .6mm; }
.xchip { display: inline-flex; align-items: center; gap: 1.6mm; border: 1.2pt solid var(--ant); border-radius: 1.5mm; padding: .6mm 2mm .6mm .6mm; margin-top: 1.6mm; font: 700 8.5pt 'Figtree', Arial, sans-serif; color: var(--ant); text-align: left; }
.xchip .x { width: 6.5mm; height: 6.5mm; background: var(--ant); color: #fff; border-radius: 1mm; font: 800 13pt/6.5mm 'Montserrat', Arial, sans-serif; text-align: center; flex-shrink: 0; }
.xchip.interno { padding: .8mm 2.4mm; }
.barra { height: 2.2mm; margin: 3mm 0; background: linear-gradient(90deg, var(--nar) 0 78%, var(--ant) 78% 100%); border-radius: 1mm; }
.hero { display: grid; grid-template-columns: 1fr 36mm; gap: 5mm; background: var(--tinte); border-radius: 3mm; padding: 3.5mm 5mm; align-items: center; }
.hero.sin-qr { grid-template-columns: 1fr; }
.hero .big { font: 800 26pt/1 'Montserrat', Arial, sans-serif; color: var(--ant); }
.hero .big.chico { font-size: 20pt; }
.hero .bajada { font-size: 10pt; margin-top: 1mm; }
.lbl { font: 700 8.5pt 'Figtree', Arial, sans-serif; text-transform: uppercase; letter-spacing: .04em; color: var(--rot-tinte); }
.hero .facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-top: 3.5mm; }
.hero .facts.c4 { grid-template-columns: repeat(4, 1fr); }
.hero .facts.c2 { grid-template-columns: repeat(2, 1fr); }
.hero .fact { background: #fff; border-radius: 2mm; padding: 1.8mm 2.5mm; }
.hero .fact .v { font: 700 15pt/1.12 'Figtree', Arial, sans-serif; color: #111; }
.hero .fact .v.chico { font-size: 11pt; }
.hero .qrb { text-align: center; font-size: 8.5pt; line-height: 1.25; font-weight: 600; }
.hero .qrb svg { width: 34mm; height: 34mm; background: #fff; padding: 1.5mm; border-radius: 2mm; margin: 0 auto 1mm; box-sizing: content-box; }
h2 { font-weight: 800; font-size: 13pt; margin: 3.4mm 0 1.6mm; color: var(--ant); display: flex; align-items: center; gap: 2.2mm; }
h2::before { content: ''; width: 3.2mm; height: 3.2mm; background: var(--nar); border-radius: .6mm; flex-shrink: 0; }
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
.card { border: .8pt solid var(--linea); border-radius: 2.5mm; padding: 2.2mm 3mm; font-size: 10pt; overflow-wrap: anywhere; }
.card.alto { min-height: 16mm; }
.card .k { font-weight: 700; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .04em; color: var(--rot-tinte); }
.kv { display: grid; grid-template-columns: 27mm 1fr; gap: .5mm 2mm; font-size: 10pt; }
.kv .k { font-weight: 600; color: var(--rot); font-size: 9pt; padding-top: .3mm; text-transform: none; letter-spacing: 0; }
.trio { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 3mm; }
table { width: 100%; border-collapse: collapse; font-size: 10pt; }
th { text-align: left; font: 700 8.5pt 'Figtree', Arial, sans-serif; color: var(--ant); background: var(--suave); padding: 1.4mm 2mm; }
th:first-child { border-radius: 1.5mm 0 0 1.5mm; } th:last-child { border-radius: 0 1.5mm 1.5mm 0; }
td { padding: 1.5mm 2mm; border-bottom: .6pt solid var(--linea); vertical-align: top; }
td.vacio { text-align: center; color: var(--rot); }
td small, .chico-gris { font-size: 8.5pt; color: var(--rot); }
.chip { display: inline-block; font: 700 8.5pt 'Figtree', Arial, sans-serif; border: 1pt solid var(--ant); border-radius: 5mm; padding: .1mm 2mm; white-space: nowrap; }
.chip.usado { background: var(--ant); color: #fff; }
.tot { display: grid; grid-template-columns: 1fr 70mm; gap: 4mm; margin-top: 2mm; align-items: end; }
.tot .k { display: grid; grid-template-columns: 1fr auto; gap: 3mm; padding: .8mm 2mm; font-size: 10pt; }
.tot .k.big { background: var(--ant); color: #fff; border-radius: 2mm; font: 800 14pt 'Montserrat', Arial, sans-serif; padding: 2mm 3mm; margin-top: 1mm; }
.tot .nota { font-size: 10pt; }
.aviso { margin-top: 2.5mm; border-left: 3mm solid var(--nar); background: var(--tinte); border-radius: 0 2mm 2mm 0; padding: 1.3mm 4mm 1.5mm; font-size: 10pt; line-height: 1.25; }
.aviso .t { display: block; font: 800 11.5pt/1.25 'Montserrat', Arial, sans-serif; color: var(--ant); margin-bottom: .3mm; }
.aviso.linea .t { display: inline; margin: 0; }
.aviso.alerta { border: 1.6pt solid var(--ant); background: #fff; border-radius: 2mm; padding: 0; overflow: hidden; }
.aviso.linea, .aviso.alerta.linea { padding: 1.1mm 3.5mm; }
.dest { margin-top: 3.5mm; border-left: 3mm solid var(--nar); background: var(--tinte); border-radius: 0 2mm 2mm 0; padding: 2mm 4mm; font: 700 15pt/1.2 'Figtree', Arial, sans-serif; }
.cond { display: grid; grid-template-columns: 1fr 1fr; gap: 2.4mm 6mm; }
.cond .it { display: grid; grid-template-columns: 6.5mm 1fr; gap: 2mm; font-size: 10pt; line-height: 1.33; }
.cond .nn { width: 6.5mm; height: 6.5mm; border-radius: 50%; background: var(--tinte); border: 1pt solid var(--nar); font: 800 9pt/6.1mm 'Montserrat', Arial, sans-serif; text-align: center; color: var(--ant); }
.cond .it b.t { display: block; font-weight: 700; }
.legal { font-size: 10pt; line-height: 1.33; margin-top: 2.6mm; }
.legal.box { background: var(--suave); border-radius: 2.5mm; padding: 2.5mm 3.5mm; }
.firma { border: 1.2pt solid var(--ant); border-radius: 3mm; margin-top: 4mm; overflow: hidden; break-inside: avoid; }
.firma .acepto { background: var(--ant); color: #fff; padding: 2mm 4mm; font: 700 10.5pt 'Figtree', Arial, sans-serif; }
.firma .lineas { display: grid; gap: 5mm; padding: 13mm 4mm 2.5mm; }
.firma .lineas div { border-top: .8pt solid var(--ant); padding-top: .8mm; font-size: 8.5pt; font-weight: 600; }
.qrline { display: grid; grid-template-columns: 24mm 1fr; gap: 4mm; align-items: center; margin-top: 4mm; border: .8pt solid var(--linea); border-radius: 2.5mm; padding: 2.5mm 3.5mm; font-size: 10pt; }
.qrline svg { width: 24mm; height: 24mm; }
.qrline b { font-family: 'Montserrat', Arial, sans-serif; font-size: 11pt; }
.checks { display: flex; flex-wrap: wrap; gap: 2mm; }
.checks span { border: .8pt solid var(--linea); border-radius: 5mm; padding: .8mm 3mm; font-size: 10pt; }
.checks span.ok::before { content: '✓ '; font-weight: 800; color: var(--ant); }
.checks span.pend { border: 1.2pt solid var(--ant); font-weight: 700; }
.pasos { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2.5mm; }
.pasos.p3 { grid-template-columns: repeat(3, 1fr); }
.pasos.p4 { grid-template-columns: repeat(4, 1fr); }
.paso { border: .8pt solid var(--linea); border-radius: 2.5mm; padding: 2.2mm 2.5mm; font-size: 10pt; line-height: 1.3; }
.paso .nn { width: 6.5mm; height: 6.5mm; border-radius: 50%; background: var(--nar); color: var(--ant); font: 800 9.5pt/6.5mm 'Montserrat', Arial, sans-serif; text-align: center; margin-bottom: 1.2mm; }
.paso b { display: block; font-family: 'Montserrat', Arial, sans-serif; font-size: 10pt; margin-bottom: .5mm; }
.foot { border-top: 1.4pt solid var(--nar); margin-top: 3mm; padding-top: 1.5mm; display: grid; grid-template-columns: 1fr auto; gap: 4mm; font-size: 8.5pt; line-height: 1.38; color: #1d1f21; }
.foot .pg { text-align: right; font-weight: 700; white-space: nowrap; }
.mini { display: grid; grid-template-columns: auto 1fr auto; gap: 4mm; align-items: center; }
.mini img.logo-mini { height: 12mm; max-width: 30mm; object-fit: contain; }
.mini .t { font: 800 13pt 'Montserrat', Arial, sans-serif; color: var(--ant); }
.mini .t span { font: 500 9pt 'Figtree', Arial, sans-serif; display: block; }
.mini .xchip { margin-top: 0; }
.corte { margin-top: 4mm; border-top: 1pt dashed var(--ant); font-size: 8.5pt; padding-top: .6mm; }
.talon { display: grid; grid-template-columns: 1fr 26mm; gap: 4mm; align-items: center; border: 1.2pt solid var(--ant); border-radius: 3mm; padding: 2.5mm 4mm; margin-top: 1.5mm; font-size: 10pt; }
.talon.sin-qr { grid-template-columns: 1fr; }
.talon svg { width: 26mm; height: 26mm; }
.talon .big { font: 800 16pt 'Montserrat', Arial, sans-serif; }
.firma-celda { min-height: 12mm; }
.revocacion { margin-top: 3.5mm; border: 1.6pt solid var(--ant); border-radius: 2.5mm; padding: 2.5mm 4mm; font: 700 20pt/1.2 'Figtree', Arial, sans-serif; }
.no-print { text-align: center; padding: 0 0 32px; font-size: 10.5pt; color: #2d2f31; }
.no-print p { margin: 0 0 10px; }
.no-print button { background: var(--ant); color: #fff; border: none; border-radius: 6px; padding: 9px 20px; font: 600 12px 'Figtree', Arial, sans-serif; cursor: pointer; margin: 0 4px; }
.no-print button.secundario { background: #6b6f73; }
body.modo-edicion .page { outline: 2.5px dashed var(--nar); outline-offset: -4px; cursor: text; }
@media print {
  body { background: #fff; }
  .page { margin: 0; box-shadow: none; min-height: 296.5mm; break-after: page; page-break-after: always; }
  section.page:last-of-type { break-after: auto; page-break-after: auto; }
  .no-print { display: none; }
}
`;
