/**
 * Papeles de la venta de un auto (agencia, tanda de la demo 12/11/2026): el
 * recibo de la seña o de un pago, y el boleto de compraventa.
 *
 * Son MODELOS. El texto del boleto es genérico y no reemplaza al que use la
 * agencia: conviene que lo revise su abogado o su gestor antes de firmar uno
 * con un cliente. Lo que sí resuelven es no volver a tipear los datos del
 * auto, del cliente y de los pagos, que ya están cargados.
 */
import { bloque, cards, documento, esc, fechaCorta, firma, hoja, kv, legal, plata, tabla } from './plantilla.util';
import { EmpresaDoc, ExtrasDoc } from './comun';

export interface PagoDoc {
  medio: string;
  monto: number;
  moneda: 'ARS' | 'USD';
  tipo_cambio: number | null;
  equivalente: number;
  toma: { numero: string; titulo: string } | null;
  detalle: string | null;
  fecha: string;
}

export interface VentaAutoDoc {
  numero: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  cliente_documento: string | null;
  precio: number;
  moneda: 'ARS' | 'USD';
  pagado: number;
  saldo: number;
  reserva_vence: string | null;
  pagos: PagoDoc[];
  unidad: {
    titulo: string; anio: number; km: number; dominio: string | null; color: string | null;
    nro_motor: string | null; nro_chasis: string | null; condicion: string;
  };
}

const MEDIOS: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', cheque: 'Cheque', credito: 'Crédito', usado: 'Usado en parte de pago', otro: 'Otro',
};
const monto = (n: number, moneda: 'ARS' | 'USD') => plata(n, moneda === 'USD');
const blanco = (v: string | null | undefined, largo = 22) => (v && v.trim() ? v : '_'.repeat(largo));

function paresDelAuto(v: VentaAutoDoc): [string, string][] {
  const u = v.unidad;
  return [
    ['Vehículo', `${u.titulo} ${u.anio}`],
    ['Dominio', blanco(u.dominio, 12)],
    ['Kilómetros', u.condicion === '0km' ? '0 km' : u.km.toLocaleString('es-AR')],
    ['Color', u.color ?? ''],
    ['Motor N°', blanco(u.nro_motor)],
    ['Chasis N°', blanco(u.nro_chasis)],
  ];
}

function filaDePago(p: PagoDoc, moneda: 'ARS' | 'USD'): string[] {
  const que = p.toma ? `${MEDIOS[p.medio]}: ${p.toma.titulo} (${p.toma.numero})` : `${MEDIOS[p.medio] ?? p.medio}${p.detalle ? ` · ${p.detalle}` : ''}`;
  const convertido = p.tipo_cambio ? `${monto(p.monto, p.moneda)} a ${plata(p.tipo_cambio)} = ${monto(p.equivalente, moneda)}` : monto(p.monto, p.moneda);
  return [esc(fechaCorta(p.fecha)), esc(que), esc(convertido)];
}

/** Recibo de un pago de la operación (la seña es el primero). */
export function armarReciboDePago(v: VentaAutoDoc, pago: PagoDoc, empresa: EmpresaDoc | null, extras: ExtrasDoc = {}): string {
  const hoy = extras.hoy ?? new Date();
  const agencia = empresa?.name || 'la agencia';
  const esSena = v.pagos.length > 0 && v.pagos[0] === pago;
  const cuerpo = `
${cards(
  bloque('Recibimos de', kv([['Nombre', v.cliente_nombre], ['DNI / CUIT', blanco(v.cliente_documento)], ['Teléfono', v.cliente_telefono ?? '']])),
  bloque('Por el vehículo', kv(paresDelAuto(v).slice(0, 3))),
)}
${tabla([{ texto: 'Fecha' }, { texto: 'Concepto' }, { texto: 'Importe', alinear: 'der' }], [filaDePago(pago, v.moneda)])}
${legal(`<p><b>${esc(agencia)}</b> recibe el importe detallado en concepto de <b>${esSena ? 'seña y reserva' : 'pago a cuenta'}</b> de la operación <b>${esc(v.numero)}</b>, por un precio total acordado de <b>${esc(monto(v.precio, v.moneda))}</b>.</p>
<p>Con este pago lleva abonado ${esc(monto(v.pagado, v.moneda))} y resta un saldo de <b>${esc(monto(Math.max(v.saldo, 0), v.moneda))}</b>.${
  v.reserva_vence ? ` La unidad queda reservada hasta el ${esc(fechaCorta(v.reserva_vence))}.` : ''
}</p>`)}
${firma('', ['Firma del cliente', 'Aclaración y DNI', `Recibió por ${agencia}`])}`;

  return documento(`Recibo ${v.numero}`, [
    hoja({ titulo: esSena ? 'Recibo de seña' : 'Recibo de pago', subtitulo: 'Compra de un vehículo', numero: v.numero, meta: fechaCorta(hoy), copia: 'Original para el cliente', cuerpo }, empresa),
  ]);
}

/** Boleto de compraventa, con los datos del auto, las partes y los pagos ya cargados. MODELO a revisar. */
export function armarBoletoDeCompraventa(v: VentaAutoDoc, empresa: EmpresaDoc | null, extras: ExtrasDoc = {}): string {
  const hoy = extras.hoy ?? new Date();
  const agencia = empresa?.name || 'la agencia';
  const pagos = v.pagos.length
    ? tabla([{ texto: 'Fecha' }, { texto: 'Forma de pago' }, { texto: 'Importe', alinear: 'der' }], v.pagos.map((p) => filaDePago(p, v.moneda)))
    : '';
  const cuerpo = `
${cards(
  bloque('Vendedor', kv([['Razón social', agencia], ['CUIT', blanco(empresa?.cuit)], ['Domicilio', blanco(empresa?.direccion, 30)]])),
  bloque('Comprador', kv([['Nombre', v.cliente_nombre], ['DNI / CUIT', blanco(v.cliente_documento)], ['Domicilio', blanco(null, 30)], ['Teléfono', v.cliente_telefono ?? '']])),
)}
${bloque('Vehículo', kv(paresDelAuto(v)))}
${legal(`<p><b>1. Objeto.</b> El vendedor vende al comprador, y este compra, el vehículo descripto, en el estado en que se encuentra, que el comprador declara haber revisado y probado a su conformidad.</p>
<p><b>2. Precio.</b> El precio total es de <b>${esc(monto(v.precio, v.moneda))}</b>. A la fecha se abonaron ${esc(monto(v.pagado, v.moneda))}${
  v.saldo > 0 ? ` y queda un saldo de <b>${esc(monto(v.saldo, v.moneda))}</b>, que el comprador abonará antes de la entrega` : ', quedando el precio íntegramente cancelado'
}.</p>
<p><b>3. Entrega.</b> El vehículo se entrega con el precio cancelado, junto con la documentación necesaria para su transferencia.</p>
<p><b>4. Transferencia.</b> Las partes se obligan a firmar la documentación registral (formulario 08 y demás) para inscribir la transferencia en el Registro de la Propiedad del Automotor. Los gastos de transferencia quedan a cargo de: ________________________.</p>
<p><b>5. Deudas e infracciones.</b> Las deudas de patentes e infracciones anteriores a la entrega son a cargo del vendedor; las posteriores, del comprador, que se hace responsable del uso del vehículo desde que lo recibe.</p>
<p><b>6. Observaciones.</b> ______________________________________________________________________________</p>`)}
${pagos}
${firma(`En ${blanco(null, 18)}, a los ${hoy.getDate()} días del mes de ${hoy.toLocaleDateString('es-AR', { month: 'long' })} de ${hoy.getFullYear()}, se firman dos ejemplares de un mismo tenor.`, ['Firma del comprador', 'Aclaración y DNI', `Por ${agencia}`])}`;

  return documento(`Boleto ${v.numero}`, [
    hoja({ titulo: 'Boleto de compraventa', subtitulo: 'Vehículo automotor', numero: v.numero, meta: fechaCorta(hoy), copia: 'Ejemplar para el comprador', cuerpo }, empresa),
  ]);
}
