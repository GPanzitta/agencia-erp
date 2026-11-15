/**
 * Textos legales de los papeles (relevamiento, sección C; textos exactos de
 * la maqueta B en `common.cjs`, `T.*`). En «vos», como el resto de GUSMAT.
 *
 * Lo que en la maqueta estaba en amarillo es un dato del taller (`ConfigDoc`)
 * y cada uno tiene su «si está vacío» del contrato (§1): sin correo los
 * datos personales se piden «en el local», revisión en 0 «no tiene cargo»,
 * canon en 0 se intima sin cargo, etc. Devuelven HTML: los datos del taller
 * ya vienen escapados en `ConfigDoc`.
 *
 * Se eliminaron (relevamiento C.4 y C.7): «el taller queda eximido de
 * responsabilidad», los 30 días de abandono fijos y «la garantía sobre
 * repuestos queda sujeta a la cobertura del fabricante» (art. 37 LDC).
 */
import { ConfigDoc, $, dias } from './comun';
import { esc } from './plantilla.util';

/** Res. AAIP 14/2018, art. 3 (literal). */
const AAIP =
  'La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.';

/** C.1.3 — Defensa del Consumidor. */
export const DEFENSA =
  '<b>Defensa del Consumidor: 147</b> — Teléfono Gratuito CABA, Área de Defensa y Protección al Consumidor. También podés reclamar en la Ventanilla Única Federal de Defensa del Consumidor (argentina.gob.ar). En el local tenés a disposición el Libro de Quejas.';

/** Dónde se piden los datos: el correo, o «en el local» si no hay. */
function dondePedir(c: ConfigDoc, escribiendo: boolean): string {
  return c.email ? `${escribiendo ? 'escribiendo a' : 'en'} ${c.email}` : 'en el local';
}

/** C.1.4 — Datos personales (versión completa: la orden de servicio). */
export function datosPersonales(c: ConfigDoc): string {
  const domicilio = c.domicilio ? `, con domicilio en ${c.domicilio},` : '';
  return `<b>Tus datos personales.</b> ${c.razon}${domicilio} guarda tus datos para hacer el servicio, avisarte del estado de tu equipo, facturar y darte la garantía. Nombre, teléfono y documento son necesarios para recibir el equipo; el correo es opcional. No los compartimos con terceros, salvo con la marca o aseguradora cuando la reparación es por su garantía. Podés pedir verlos, corregirlos o borrarlos ${dondePedir(c, true)} (Ley 25.326). ${AAIP}`;
}

/** C.1.4 — Datos personales, versión corta (presupuesto, acta, certificado, venta). */
export function datosPersonalesCorto(c: ConfigDoc): string {
  return `<b>Tus datos personales</b> se usan sólo para el servicio, avisos, facturación y garantía; podés pedir verlos, corregirlos o borrarlos ${dondePedir(c, false)} (Ley 25.326). ${AAIP}`;
}

/** C.1.5 — Factura (reemplaza «el cliente tiene derecho a solicitar factura»). */
export function factura(c: ConfigDoc, que = 'del servicio'): string {
  const cuando = c.facturaMomento === 'al_senar' ? 'al cobrar la seña y al cobrar el saldo' : 'al cobrar';
  return `Este comprobante no reemplaza la factura. La factura ${que} se emite ${cuando} y te la damos impresa o te la enviamos por correo.`;
}

/** El cargo por guarda escrito: «$ 1.000 por día». */
function canonTexto(c: ConfigDoc): string {
  return `${$(c.canon)} por día`;
}

/** C.4 — Equipos no retirados (sin el título). Canon 0: se intima, sin cargo. */
export function retiro(c: ConfigDoc): string {
  const despues =
    c.canon > 0
      ? `Pasado ese plazo te enviamos una intimación por escrito y, <b>recién desde esa intimación</b>, podemos cobrar un cargo por guarda de ${canonTexto(c)} (art. 2590 del Código Civil y Comercial).`
      : 'Pasado ese plazo te enviamos una intimación por escrito para que lo retires, <b>sin cargo por guarda</b>.';
  return `Cuando el equipo esté listo (reparado o no) te avisamos por WhatsApp. Tenés <b>${c.diasAbandono} días corridos</b> para retirarlo sin costo. ${despues} Mientras tanto seguimos cuidando tu equipo.`;
}

/** «La revisión cuesta $ X y se descuenta…» / «La revisión y el presupuesto no tienen cargo». */
export function revision(c: ConfigDoc): string {
  if (c.costoRevision <= 0) return '<b>La revisión y el presupuesto no tienen cargo</b>';
  return `<b>La revisión cuesta ${$(c.costoRevision)}</b> y ${c.revisionDescuenta ? 'se descuenta del total si aprobás el presupuesto' : 'no se descuenta del total del presupuesto'}`;
}

/** Lo que se paga si no se aprueba: la revisión (si cuesta) y la visita (si hubo). */
function siNoAprobas(c: ConfigDoc, visitas: number, conMonto: boolean): string {
  const partes = [
    c.costoRevision > 0 ? `la revisión${conMonto ? ` (${$(c.costoRevision)})` : ''}` : '',
    visitas > 0 ? `la visita a domicilio${conMonto ? ` (${$(visitas)})` : ''}` : '',
  ].filter(Boolean);
  return partes.length ? `pagás sólo ${partes.join(' y ')}` : 'no pagás nada';
}

/** C.2 — Condiciones de recepción. */
export function condicionesRecepcion(c: ConfigDoc, d: { fotos: number; visitas: number }): [string, string][] {
  const fotos = d.fotos > 1 ? ' y las fotos tomadas al ingreso' : d.fotos === 1 ? ' y la foto tomada al ingreso' : '';
  return [
    ['Qué dejás', `Recibimos el equipo descripto arriba, con los accesorios y el estado físico anotados${fotos}. Revisá que estén bien antes de firmar.`],
    ['Revisión y presupuesto', `Revisamos el equipo y te mandamos el presupuesto dentro de ${dias(c.plazoPresupuesto, true)}. ${revision(c)}. No reparamos nada sin tu aprobación.`],
    ['Plazo de reparación', 'Una vez aprobado, reparamos en el plazo que figure en el presupuesto; si no figura, en no más de 30 días (Ley 5.672 de la Ciudad, art. 3).'],
    ['Si no aprobás', `Te devolvemos el equipo en el mismo estado en que lo dejaste y ${siNoAprobas(c, d.visitas, false)}.`],
    ['Trabajos imprevistos', 'Si aparece algo que no está en el presupuesto, te avisamos antes y no lo hacemos sin tu aprobación.'],
    ['Retiro', retiro(c)],
    ['Para retirar', 'Traé este comprobante o tu documento. Si retira otra persona, necesita este comprobante y su documento.'],
    ['Garantía', `Toda reparación tiene <b>${c.garantiaDias} días de garantía</b> desde que retirás el equipo (Ley 5.672 de la Ciudad, art. 9).`],
  ];
}

export interface DatosCondPresupuesto {
  /** «02/10/2026», o vacío si el presupuesto todavía no se emitió. */
  vence: string;
  vigencia: number | null;
  /** Seña en pesos (0 = sin seña). */
  sena: number;
  visitas: number;
  hayUsados: boolean;
  /** Garantía de marca: quién paga. */
  cubre?: string | null;
}

/** C.3 — Condiciones del presupuesto. */
export function condicionesPresupuesto(c: ConfigDoc, d: DatosCondPresupuesto): [string, string][] {
  const aceptar = d.vence
    ? `hasta el <b>${d.vence}</b>${d.vigencia !== null ? ` (${d.vigencia} días corridos desde la emisión)` : ''}. Vencido, los precios pueden cambiar y lo recotizamos sin cargo.`
    : 'lo fijamos al emitir el presupuesto. Vencido, los precios pueden cambiar y lo recotizamos sin cargo.';
  const repuestos = 'son <b>nuevos</b>, salvo los marcados «usado» o «reconstituido» en el detalle, que llevan su precio y su garantía en esa línea.';
  const pago = d.cubre
    ? `la reparación es por la garantía de ${d.cubre}: <b>no pagás</b> el trabajo ni los repuestos.`
    : d.sena > 0
      ? `para empezar pedimos una seña del ${c.senaPct} % (${$(d.sena)}); el saldo se paga al retirar. Precios en pesos, con IVA incluido.`
      : 'Sin seña: pagás el total al retirar el equipo. Precios en pesos, con IVA incluido.';
  const traslado = d.visitas > 0 ? ` La visita a domicilio (${$(d.visitas)}) se cobra aparte.` : ' Equipo recibido en el taller: sin costo de traslado.';
  const guarda =
    c.canon > 0
      ? `Después te intimamos por escrito y, recién desde la intimación, corre un cargo de guarda de ${canonTexto(c)} (art. 2590 CCyC).`
      : 'Después te intimamos por escrito para que lo retires, sin cargo por guarda.';
  return [
    ['Plazo para aceptar', aceptar],
    ['Plazo de reparación', `${dias(c.plazoReparacion, true)} desde tu aprobación${d.sena > 0 && !d.cubre ? ' y el pago de la seña' : ''}. Si un repuesto demora más, te avisamos antes con la nueva fecha; nunca más de 30 días salvo que lo acordemos por escrito (Ley 5.672 CABA, art. 3).`],
    ['Garantía', `<b>${c.garantiaDias} días</b> desde que retirás el equipo, sobre el trabajo y los repuestos colocados (Ley 5.672 CABA, art. 9). Los repuestos nuevos tienen además 6 meses de garantía legal y los usados 3 meses (Ley 24.240, art. 11).`],
    // Art. 20 LDC: con repuestos no nuevos, la cláusula va destacada.
    ['Repuestos', d.hayUsados ? `<b>${repuestos.replace(/<\/?b>/g, '')}</b>` : repuestos],
    ['Pago', pago + traslado],
    ['Si no aprobás', `te devolvemos el equipo sin reparar y ${siNoAprobas(c, d.visitas, true)}.`],
    ['Trabajos imprevistos', 'no hacemos nada fuera de este presupuesto sin avisarte y tener tu aprobación.'],
    ['Retiro', `una vez listo tenés ${c.diasAbandono} días corridos para retirarlo sin costo. ${guarda}`],
  ];
}

/** C.5 — Garantía en el acta de entrega. */
export function garantiaEntrega(c: ConfigDoc, d: { desde: string; hasta: string }): string {
  const donde = c.domicilio ? `, en ${c.domicilio}` : '';
  return `<b>Garantía de la reparación: ${c.garantiaDias} días, desde el ${d.desde} hasta el ${d.hasta}.</b> Cubre el trabajo detallado y los repuestos colocados. La da ${c.razon}${donde}. Si la falla reparada vuelve dentro de ese plazo, la corregimos sin costo. El tiempo que el equipo esté en el taller por la garantía se suma al plazo. Los repuestos nuevos tienen además 6 meses de garantía legal y los usados 3 meses (Ley 24.240, art. 11).`;
}

export const ENTREGA_ART17 =
  'Si la reparación no quedó bien, podés pedir que la rehagamos, la devolución de lo pagado o una rebaja proporcional (Ley 24.240, art. 17).';
export const ENTREGA_CONFORME = 'Con mi firma confirmo que recibí el equipo funcionando y los accesorios indicados.';

/** C.6 — Acta sin reparar. */
export const SIN_REPARAR_GARANTIA =
  'Esta devolución no tiene garantía de reparación porque no se hizo ningún trabajo; sí respondemos por el estado en que te lo entregamos.';
export const SIN_REPARAR_CONFORME = 'Con mi firma confirmo que revisé el equipo y los accesorios y que los recibí como ingresaron.';

/** C.7 punto 5 — traslado por defecto (contrato §1, `traslado_garantia` vacío). */
export const TRASLADO_POR_DEFECTO =
  'si la reparación fue en el taller, traés el equipo y lo retirás vos; si no se puede trasladar o el servicio fue a domicilio, vamos sin cargo dentro del área de cobertura.';

/** Cómo contactar al taller: teléfono y correo, lo que haya. */
export function contacto(c: ConfigDoc, verbo = true): string {
  const partes = [c.telefono ? `${verbo ? 'llamá al' : 'Tel.'} ${c.telefono}` : '', c.email ? `${verbo ? 'escribí a' : ''} ${c.email}`.trim() : ''].filter(Boolean);
  return partes.length ? partes.join(' o ') : 'acercate al local';
}

/** C.7 — Condiciones del certificado de garantía. */
export function condicionesCertificado(c: ConfigDoc, d: { desde: string; hasta: string }): [string, string][] {
  const quien = [c.razon, c.cuit ? `CUIT ${c.cuit}` : '', c.domicilio ? `en ${c.domicilio}` : '', c.horario].filter(Boolean).join(', ');
  const llama = contacto(c);
  return [
    ['Qué cubre', `el trabajo y los repuestos detallados en este certificado, durante <b>${c.garantiaDias} días</b> desde la entrega (${d.desde} al ${d.hasta}), o el plazo mayor indicado en cada repuesto.`],
    ['Quién la da y dónde', `${quien}. ${llama.charAt(0).toUpperCase() + llama.slice(1)} con el número de orden.`],
    ['Cuánto tardamos', `revisamos el equipo en garantía dentro de ${dias(c.revisionGarantia, true)}. El tiempo que esté en el taller se suma a la garantía (Ley 24.240, art. 16).`],
    ['Qué no cubre', 'daños por golpes, caídas, líquidos, sobretensión de la red, instalación o uso contrario al manual, ni fallas de partes que no intervinimos. Tampoco lo que haya abierto o reparado otra persona <b>cuando esa intervención causó la falla</b>.'],
    ['Traslado', c.traslado || TRASLADO_POR_DEFECTO],
    ['Tus derechos', 'esta garantía no reduce los derechos que te dan la Ley 24.240 y la Ley 5.672 de la Ciudad. Si la reparación no queda bien, podés pedir que la rehagamos, la devolución o una rebaja proporcional.'],
  ];
}

/** C.8 — Garantía de los repuestos vendidos (comprobante de venta). */
export const GARANTIA_REPUESTOS_VENTA =
  '<b>Garantía:</b> los repuestos <b>nuevos</b> tienen 6 meses de garantía y los <b>usados o reacondicionados</b> 3 meses, desde la entrega (Ley 24.240, art. 11). Si el repuesto falla, lo cambiamos o reparamos sin costo; si hay que mandarlo a revisar, el envío lo pagamos nosotros. La garantía no cubre daños por instalación incorrecta o uso distinto del indicado. Conservá este comprobante.';

/** C.8 — Revocación de las ventas a distancia (negrita, el doble del cuerpo: Res. 906/98 art. 4). */
export function revocacion(sitio: string | null | undefined): string {
  const donde = sitio ? `desde «Botón de arrepentimiento» en ${esc(sitio.replace(/\/$/, ''))}/arrepentimiento` : 'desde el «Botón de arrepentimiento» del sitio';
  return `Tenés derecho a revocar esta compra dentro de los 10 días corridos desde que recibís el producto, sin explicar el motivo y sin costo. Hacelo ${donde}.`;
}
