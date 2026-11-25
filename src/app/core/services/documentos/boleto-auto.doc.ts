/**
 * Papeles de la venta de un auto (agencia, tanda de la demo 12/11/2026): el
 * recibo de la seña o de un pago, y el boleto de compraventa.
 *
 * Son MODELOS. El texto del boleto es genérico y no reemplaza al que use la
 * agencia: conviene que lo revise su abogado o su gestor antes de firmar uno
 * con un cliente. Lo que sí resuelven es no volver a tipear los datos del
 * auto, del cliente y de los pagos, que ya están cargados.
 */
import { bloque, cards, checks, destacado, documento, esc, fechaCorta, firma, hero, hoja, hora, kv, legal, plata, qrLinea, tabla, talonRetiro, totales, unaHoja } from './plantilla.util';
import { EmpresaDoc, ExtrasDoc, urlCorta } from './comun';

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

export interface UnidadDoc {
  id: string;
  numero: string;
  titulo: string;
  marca: string;
  modelo: string;
  version: string | null;
  anio: number;
  km: number;
  dominio: string | null;
  color: string | null;
  combustible: string | null;
  transmision: string | null;
  carroceria: string | null;
  nro_motor: string | null;
  nro_chasis: string | null;
  condicion: 'usado' | '0km';
  origen: 'compra' | 'toma' | 'consignacion';
  moneda: 'ARS' | 'USD';
  precio_piso: number | null;
  precio_venta: number | null;
  total_gastos: number | null;
  gastos: { descripcion: string; monto: number; moneda: 'ARS' | 'USD'; tipo_cambio: number | null; fecha: string }[];
  papeles: { tipo: string; nombre: string; estado: string }[];
  titular_nombre: string | null;
  titular_telefono: string | null;
  titular_documento: string | null;
  descripcion: string | null;
  destacados?: string[];
  precio_financiado?: number | null;
  mostrar_toma?: boolean;
}

const COMBUSTIBLE_DOC: Record<string, string> = {
  nafta: 'Nafta', diesel: 'Diésel', gnc: 'GNC', hibrido: 'Híbrido', electrico: 'Eléctrico',
};
const CAJA_DOC: Record<string, string> = {
  manual: 'Manual', automatica: 'Automática',
};
const CARROCERIA_DOC: Record<string, string> = {
  sedan: 'Sedán', hatchback: 'Hatchback', suv: 'SUV', pickup: 'Pickup', coupe: 'Coupé',
  rural: 'Rural', monovolumen: 'Monovolumen', utilitario: 'Utilitario', moto: 'Moto', otro: 'Otro',
};

/** Cartel A4 para el parabrisas / vidriera con código QR a la publicación online. */
export function armarCartelDeVidriera(u: UnidadDoc, empresa: EmpresaDoc | null, extras: ExtrasDoc = {}): string {
  const kmTexto = u.condicion === '0km' ? '0 km' : `${u.km.toLocaleString('es-AR')} km`;
  const cajaTexto = CAJA_DOC[u.transmision ?? ''] ?? '—';
  const combTexto = COMBUSTIBLE_DOC[u.combustible ?? ''] ?? '—';
  const precioTexto = u.precio_venta !== null ? monto(u.precio_venta, u.moneda) : 'CONSULTAR';

  const encabezadoHero = hero({
    etiqueta: `${u.condicion === '0km' ? '0 KM' : 'USADO SELECCIONADO'} · ${u.numero}`,
    grande: precioTexto,
    bajada: esc(`${u.titulo} · Año ${u.anio}`),
    datos: [
      { rotulo: 'Año', valor: String(u.anio) },
      { rotulo: 'Kilómetros', valor: kmTexto },
      { rotulo: 'Transmisión', valor: cajaTexto },
      { rotulo: 'Combustible', valor: combTexto },
    ],
    qr: extras.qr ?? null,
    qrTexto: extras.qr ? 'Escaneá para ver fotos y cuotas' : undefined,
  });

  const ficha = bloque(
    'Datos de la unidad',
    kv([
      ['Marca y modelo', `${u.marca} ${u.modelo}`],
      ['Versión', u.version ?? '—'],
      ['Año', String(u.anio)],
      ['Kilometraje', kmTexto],
      ['Combustible', combTexto],
      ['Caja', cajaTexto],
      ['Carrocería', CARROCERIA_DOC[u.carroceria ?? ''] ?? '—'],
      ['Color', u.color ?? '—'],
      ['Dominio', u.dominio ?? '—'],
    ]),
  );

  const equip = u.destacados?.length
    ? bloque('Equipamiento destacado', checks(u.destacados.map((texto) => ({ texto, ok: true }))))
    : '';

  const desc = u.descripcion
    ? bloque('Observaciones', `<p style="margin:0;font-size:10.5pt;line-height:1.4">${esc(u.descripcion)}</p>`)
    : '';

  const ventajas = [
    u.precio_financiado ? `Financiación disponible (precio financiado ${monto(u.precio_financiado, u.moneda)})` : 'Consultá planes de financiación en cuotas fijas',
    u.mostrar_toma !== false ? 'Tomamos tu usado en parte de pago' : null,
  ].filter(Boolean).join(' · ');

  const pieQr = extras.qr && extras.url
    ? qrLinea(extras.qr, `<b>Mirá la galería de fotos, papeles y simulador de cuotas desde tu celular</b><br>${esc(urlCorta(extras.url))}`)
    : '';

  const cuerpo = `
${encabezadoHero}
${ficha}
${equip}
${desc}
${destacado(esc(ventajas))}
${pieQr}`;

  return unaHoja(
    {
      titulo: `${u.marca} ${u.modelo}`,
      subtitulo: u.version ?? `Modelo ${u.anio}`,
      numero: u.numero,
      leyenda: { interno: 'FICHA DE EXPOSICIÓN' },
      cuerpo,
    },
    empresa,
    `Cartel ${u.numero}`,
  );
}

/** Contrato / autorización de venta en consignación con estado de documentación entregada. */
export function armarContratoDeConsignacion(u: UnidadDoc, empresa: EmpresaDoc | null, extras: ExtrasDoc = {}): string {
  const hoy = extras.hoy ?? new Date();
  const agencia = empresa?.name || 'la agencia';
  const piso = u.precio_piso !== null ? monto(u.precio_piso, u.moneda) : blanco(null, 16);
  const lista = u.precio_venta !== null ? monto(u.precio_venta, u.moneda) : 'A convenir';
  const papelesRecibidos = u.papeles
    .filter((p) => p.tipo !== 'contrato_consignacion')
    .map((p) => ({ texto: p.nombre, ok: p.estado === 'ok' }));

  const cuerpo = `
${cards(
  bloque('Comitente (Propietario)', kv([
    ['Nombre', blanco(u.titular_nombre, 26)],
    ['DNI / CUIT', blanco(u.titular_documento)],
    ['Teléfono', blanco(u.titular_telefono)],
    ['Domicilio', blanco(null, 28)],
  ])),
  bloque('Consignatario (Agencia)', kv([
    ['Razón social', agencia],
    ['CUIT', blanco(empresa?.cuit)],
    ['Domicilio', blanco(empresa?.direccion, 28)],
    ['Teléfono', empresa?.telefono ?? '—'],
  ])),
)}
${cards(
  bloque('Vehículo en consignación', kv([
    ['Vehículo', `${u.titulo} ${u.anio}`],
    ['Dominio', blanco(u.dominio, 12)],
    ['Kilómetros', `${u.km.toLocaleString('es-AR')} km`],
    ['Color', u.color ?? '—'],
    ['Motor N°', blanco(u.nro_motor)],
    ['Chasis N°', blanco(u.nro_chasis)],
  ])),
  bloque('Condiciones comerciales', kv([
    ['Unidad N°', u.numero],
    ['Precio piso neto al dueño', piso],
    ['Precio inicial de publicación', lista],
    ['Moneda de operación', u.moneda === 'USD' ? 'Dólares estadounidenses' : 'Pesos argentinos'],
  ])),
)}
${papelesRecibidos.length ? bloque('Estado de la documentación al ingreso', checks(papelesRecibidos)) : ''}
${legal(`<p><b>1. Autorización de venta.</b> El propietario entrega a <b>${esc(agencia)}</b> el vehículo descripto en carácter de consignación, autorizándola a exhibirlo en su salón y canales digitales, realizar pruebas de manejo supervisadas y recibir señas o reservas de interesados.</p>
<p><b>2. Precio piso y retribución.</b> El propietario fija como valor neto de liquidación a su favor la suma de <b>${esc(piso)}</b>. Todo importe obtenido por encima de dicho valor piso, o la comisión acordada entre las partes, corresponderá a la agencia en concepto de gestión comercial y publicidad.</p>
<p><b>3. Situación registral y deudas.</b> El propietario declara bajo juramento que el vehículo no registra prendas, embargos ni inhibiciones, y asume a su exclusivo cargo todas las deudas de patentes, infracciones de tránsito y gravámenes devengados hasta el día de la entrega efectiva al comprador.</p>
<p><b>4. Guarda y retiro.</b> En caso de que el propietario decida retirar la unidad antes de concretarse la venta, deberá notificarlo fehacientemente y abonar los gastos de alistaje, gestoría o preparación que hubiese autorizado previamente.</p>`)}
${firma(`En ${blanco(null, 18)}, a los ${hoy.getDate()} días del mes de ${hoy.toLocaleDateString('es-AR', { month: 'long' })} de ${hoy.getFullYear()}, se firman dos ejemplares.`, ['Firma del propietario', 'Aclaración y DNI', `Recibió por ${agencia}`])}`;

  return documento(`Consignación ${u.numero}`, [
    hoja({ titulo: 'Contrato de consignación', subtitulo: 'Autorización de venta de vehículo', numero: u.numero, meta: fechaCorta(hoy), copia: 'Original para el propietario', cuerpo }, empresa),
  ]);
}

/** Liquidación final al dueño de un auto dejado en consignación. */
export function armarLiquidacionConsignacion(u: UnidadDoc, empresa: EmpresaDoc | null, extras: ExtrasDoc = {}): string {
  const hoy = extras.hoy ?? new Date();
  const agencia = empresa?.name || 'la agencia';
  const piso = Number(u.precio_piso ?? 0);
  const gastosEnMoneda = Number(u.total_gastos ?? 0);
  const neto = Math.max(0, Math.round((piso - gastosEnMoneda) * 100) / 100);

  const filasGastos = u.gastos.map((g) => {
    const imp = g.moneda === u.moneda
      ? monto(g.monto, g.moneda)
      : `${monto(g.monto, g.moneda)}${g.tipo_cambio ? ` (TC ${plata(g.tipo_cambio)})` : ''}`;
    return [esc(fechaCorta(g.fecha)), esc(g.descripcion), esc(imp)];
  });

  const tablaGastos = u.gastos.length
    ? bloque('Gastos de alistaje y preparación registrados', tabla([{ texto: 'Fecha' }, { texto: 'Concepto' }, { texto: 'Importe', alinear: 'der' }], filasGastos))
    : '';

  const resumenTotales = totales(
    [
      { rotulo: 'Valor piso acordado con el propietario', valor: monto(piso, u.moneda) },
      ...(gastosEnMoneda > 0 ? [{ rotulo: 'Menos gastos de alistaje imputados', valor: `- ${monto(gastosEnMoneda, u.moneda)}` }] : []),
      { rotulo: 'Neto a liquidar al propietario', valor: monto(neto, u.moneda), destacado: true },
    ],
    u.precio_venta !== null ? `Precio de venta de referencia: ${esc(monto(u.precio_venta, u.moneda))}.` : '',
  );

  const cuerpo = `
${cards(
  bloque('Propietario (Comitente)', kv([
    ['Nombre', blanco(u.titular_nombre, 26)],
    ['DNI / CUIT', blanco(u.titular_documento)],
    ['Teléfono', u.titular_telefono ?? '—'],
  ])),
  bloque('Vehículo liquidado', kv([
    ['Unidad', `${u.titulo} ${u.anio} (${u.numero})`],
    ['Dominio', blanco(u.dominio, 12)],
    ['Kilómetros', `${u.km.toLocaleString('es-AR')} km`],
  ])),
)}
${tablaGastos}
${resumenTotales}
${legal(`<p>Recibí de <b>${esc(agencia)}</b> la suma neta de <b>${esc(monto(neto, u.moneda))}</b> en concepto de liquidación total y definitiva por la venta del vehículo en consignación descripto en este documento, no teniendo nada más que reclamar por ningún concepto derivado de dicha operación.</p>`)}
${firma('', ['Recibí conforme (Propietario)', 'Aclaración y DNI', `Liquidó por ${agencia}`])}`;

  return documento(`Liquidación ${u.numero}`, [
    hoja({ titulo: 'Liquidación de consignación', subtitulo: 'Rendición al propietario', numero: u.numero, meta: fechaCorta(hoy), copia: 'Comprobante de liquidación', cuerpo }, empresa),
  ]);
}

export interface PropuestaAutoDoc {
  unidad: UnidadDoc;
  cliente_nombre: string;
  cliente_telefono: string | null;
  precio_unidad: number;
  usado_titulo: string | null;
  usado_valor: number;
  efectivo_anticipo: number;
  saldo_financiar: number;
  cuotas_meses: number | null;
  cuota_valor: number | null;
  tna: number | null;
  gastos_transferencia: number | null;
  validez_horas: number;
  notas: string | null;
}

/** Hoja de presupuesto / propuesta comercial llave por llave (Permuta + Efectivo + Cuotas). */
export function armarPropuestaComercial(p: PropuestaAutoDoc, empresa: EmpresaDoc | null, extras: ExtrasDoc = {}): string {
  const hoy = extras.hoy ?? new Date();
  const u = p.unidad;
  const agencia = empresa?.name || 'la agencia';
  const kmTexto = u.condicion === '0km' ? '0 km' : `${u.km.toLocaleString('es-AR')} km`;

  const encabezadoHero = hero({
    etiqueta: `PROPUESTA COMERCIAL · ${u.numero}`,
    grande: monto(p.precio_unidad, u.moneda),
    bajada: esc(`${u.titulo} · Año ${u.anio}`),
    datos: [
      { rotulo: 'Para', valor: p.cliente_nombre || 'Cliente', chico: true },
      { rotulo: 'Año / Km', valor: `${u.anio} · ${kmTexto}`, chico: true },
      { rotulo: 'Diferencia a cubrir', valor: monto(Math.max(0, p.precio_unidad - p.usado_valor), u.moneda) },
      {
        rotulo: p.cuotas_meses && p.cuota_valor ? `Plan ${p.cuotas_meses} cuotas` : 'Saldo final',
        valor: p.cuotas_meses && p.cuota_valor ? monto(p.cuota_valor, u.moneda) : monto(p.saldo_financiar, u.moneda),
      },
    ],
    qr: extras.qr ?? null,
    qrTexto: extras.qr ? 'Ver fotos y ficha online' : undefined,
  });

  const lineasOperacion = [
    { rotulo: `Precio ${u.titulo} (${u.anio})`, valor: monto(p.precio_unidad, u.moneda) },
    ...(p.usado_valor > 0
      ? [{ rotulo: `Menos toma de usado${p.usado_titulo ? ` (${p.usado_titulo})` : ''}`, valor: `- ${monto(p.usado_valor, u.moneda)}` }]
      : []),
    ...(p.efectivo_anticipo > 0
      ? [{ rotulo: 'Menos entrega en efectivo / transferencia', valor: `- ${monto(p.efectivo_anticipo, u.moneda)}` }]
      : []),
    {
      rotulo: p.saldo_financiar > 0 ? 'Saldo restante a financiar / cancelar' : 'Saldo restante',
      valor: monto(p.saldo_financiar, u.moneda),
      destacado: true,
    },
  ];

  const detalleFinanciacion = p.saldo_financiar > 0 && p.cuotas_meses && p.cuota_valor
    ? destacado(
        `Financiación estimada del saldo (${esc(monto(p.saldo_financiar, u.moneda))}): <b>${p.cuotas_meses} cuotas fijas de ${esc(monto(p.cuota_valor, u.moneda))}</b>${p.tna ? ` (TNA ${p.tna}%)` : ''}.`,
      )
    : '';

  const pieQr = extras.qr && extras.url
    ? qrLinea(extras.qr, `<b>Escaneá el código para ver todas las fotos y equipamiento del vehículo</b><br>${esc(urlCorta(extras.url))}`)
    : '';

  const cuerpo = `
${encabezadoHero}
${cards(
  bloque('Preparado para', kv([
    ['Cliente', p.cliente_nombre || '—'],
    ['Teléfono', p.cliente_telefono || '—'],
    ['Fecha', fechaCorta(hoy)],
    ['Validez de la propuesta', `${p.validez_horas} horas`],
  ])),
  bloque('Vehículo ofrecido', kv([
    ['Unidad', `${u.titulo} ${u.anio} (${u.numero})`],
    ['Kilometraje', kmTexto],
    ['Caja / Combustible', [CAJA_DOC[u.transmision ?? ''], COMBUSTIBLE_DOC[u.combustible ?? '']].filter(Boolean).join(' · ') || '—'],
    ['Dominio', u.dominio ?? '—'],
  ])),
)}
${bloque('Esquema de la operación (Llave por llave)', totales(
  lineasOperacion,
  p.gastos_transferencia ? `Gastos estimados de transferencia / gestoría: ${esc(monto(p.gastos_transferencia, u.moneda))} (no incluidos en el precio de la unidad).` : 'Gastos de transferencia a presupuestar según radicación.',
))}
${detalleFinanciacion}
${p.notas ? bloque('Observaciones', `<p style="margin:0;font-size:10pt">${esc(p.notas)}</p>`) : ''}
${legal(`<p>Presupuesto informativo emitido por <b>${esc(agencia)}</b> con validez de <b>${p.validez_horas} horas</b>, sujeto a disponibilidad de la unidad y, en caso de permuta o financiación, a la revisión física y registral del vehículo entregado y aprobación crediticia.</p>`)}
${pieQr}`;

  return unaHoja(
    {
      titulo: 'Propuesta comercial',
      subtitulo: 'Presupuesto de compra y permuta',
      numero: u.numero,
      meta: fechaCorta(hoy),
      leyenda: { interno: 'PRESUPUESTO COMERCIAL' },
      cuerpo,
    },
    empresa,
    `Propuesta ${u.numero}`,
  );
}

export interface PeritajeTomaDoc {
  cliente_nombre: string;
  cliente_telefono: string | null;
  vehiculo: string;
  dominio: string | null;
  anio: number | null;
  km: number | null;
  moneda: 'ARS' | 'USD';
  valor_referencia: number;
   rubros: { concepto: string; descuento: number }[];
  margen_agencia: number;
  margen_pct: number;
  valor_toma: number;
  observaciones: string | null;
}

/** Hoja de tasación y peritaje técnico de toma de usado para defender el valor frente al cliente. */
export function armarHojaDePeritaje(p: PeritajeTomaDoc, empresa: EmpresaDoc | null, extras: ExtrasDoc = {}): string {
  const hoy = extras.hoy ?? new Date();
  const agencia = empresa?.name || 'la agencia';
  const totalReparaciones = p.rubros.reduce((acc, r) => acc + r.descuento, 0);

  const encabezadoHero = hero({
    etiqueta: 'TASACIÓN Y PERITAJE DE TOMA',
    grande: monto(p.valor_toma, p.moneda),
    bajada: esc(p.vehiculo),
    datos: [
      { rotulo: 'Referencia mercado', valor: monto(p.valor_referencia, p.moneda) },
      { rotulo: 'Alistaje estimado', valor: `- ${monto(totalReparaciones, p.moneda)}` },
      { rotulo: `Margen y garantía (${p.margen_pct}%)`, valor: `- ${monto(p.margen_agencia, p.moneda)}` },
      { rotulo: 'Valor neto de toma', valor: monto(p.valor_toma, p.moneda) },
    ],
  });

  const filasRubros = p.rubros.map((r) => [
    esc(r.concepto),
    r.descuento > 0 ? esc(`- ${monto(r.descuento, p.moneda)}`) : 'Sin observaciones (OK)',
  ]);

  const lineasTotales = [
    { rotulo: 'Valor de mercado de referencia (unidad en óptimo estado)', valor: monto(p.valor_referencia, p.moneda) },
    ...(totalReparaciones > 0
      ? [{ rotulo: 'Menos costos estimados de reacondicionamiento y puesta a punto', valor: `- ${monto(totalReparaciones, p.moneda)}` }]
      : []),
    ...(p.margen_agencia > 0
      ? [{ rotulo: `Menos margen comercial, garantía legal e inmovilización (${p.margen_pct}%)`, valor: `- ${monto(p.margen_agencia, p.moneda)}` }]
      : []),
    { rotulo: 'Valor final ofrecido para toma de la unidad', valor: monto(p.valor_toma, p.moneda), destacado: true },
  ];

  const cuerpo = `
${encabezadoHero}
${cards(
  bloque('Titular / Interesado', kv([
    ['Nombre', p.cliente_nombre || '—'],
    ['Teléfono', p.cliente_telefono || '—'],
    ['Fecha de tasación', fechaCorta(hoy)],
  ])),
  bloque('Vehículo inspeccionado', kv([
    ['Vehículo', p.vehiculo],
    ['Dominio', p.dominio ?? '—'],
    ['Año', p.anio ? String(p.anio) : '—'],
    ['Kilometraje', p.km !== null ? `${p.km.toLocaleString('es-AR')} km` : '—'],
  ])),
)}
${bloque('Desglose técnico de inspección por rubro', tabla([{ texto: 'Rubro evaluado' }, { texto: 'Ajuste estimado', alinear: 'der' }], filasRubros))}
${totales(lineasTotales, p.observaciones ? esc(p.observaciones) : 'Cotización sujeta a verificación física final en taller y libre deuda registral.')}
${legal(`<p>La presente tasación refleja el valor de toma ofrecido por <b>${esc(agencia)}</b> contemplando los costos de reacondicionamiento necesarios para dejar la unidad en condiciones de venta con garantía al próximo comprador.</p>`)}
${firma('', ['Conformidad del titular', 'Aclaración y DNI', `Tasador por ${agencia}`])}`;

  return unaHoja(
    {
      titulo: 'Peritaje de toma',
      subtitulo: 'Tasación técnica de vehículo usado',
      numero: p.dominio || 'S/D',
      meta: fechaCorta(hoy),
      leyenda: { interno: 'TASACIÓN DE USADO' },
      cuerpo,
    },
    empresa,
    `Peritaje ${p.vehiculo}`,
  );
}

/**
 * Orden de Venta (OV) — Constancia de reserva / operación con código QR de seguimiento
 * online (estilo Orden de Servicio de Taller: hero con QR, estado de cuenta, pagos,
 * pasos de cómo sigue y talón recortable con QR).
 */
export function armarOrdenDeVenta(v: VentaAutoDoc, empresa: EmpresaDoc | null, extras: ExtrasDoc = {}): string {
  const hoy = extras.hoy ?? new Date();
  const agencia = empresa?.name || 'la agencia';
  const u = v.unidad;
  const kmTexto = u.condicion === '0km' ? '0 km' : `${u.km.toLocaleString('es-AR')} km`;

  const encabezadoHero = hero({
    etiqueta: `ORDEN DE VENTA (OV) · ${v.numero}`,
    grande: `${u.titulo} (${u.anio})`,
    grandeChico: true,
    bajada: `Titular: ${esc(v.cliente_nombre)}${v.reserva_vence ? ` · Reserva hasta el ${esc(fechaCorta(v.reserva_vence))}` : ''}`,
    datos: [
      { rotulo: 'Precio acordado', valor: monto(v.precio, v.moneda) },
      { rotulo: 'Cobrado / Seña', valor: monto(v.pagado, v.moneda) },
      { rotulo: 'Saldo restante', valor: v.saldo <= 0 ? 'Saldada' : monto(v.saldo, v.moneda) },
      { rotulo: 'Dominio', valor: u.dominio || 'A patentar' },
    ],
    qr: extras.qr ?? null,
    qrTexto: extras.qr ? 'Seguí tu OV y papeles online' : undefined,
  });

  const tablaPagos = v.pagos.length
    ? bloque(
        'Detalle de señas, pagos y usado tomado en parte de pago',
        tabla([{ texto: 'Fecha' }, { texto: 'Medio / Concepto' }, { texto: 'Importe', alinear: 'der' }], v.pagos.map((p) => filaDePago(p, v.moneda))),
      )
    : '';

  const talon = talonRetiro({
    numero: `${v.numero} · ${u.dominio || u.titulo}`,
    detalle: `${u.titulo} (${u.anio}) · Cliente: ${v.cliente_nombre} · Precio: ${monto(v.precio, v.moneda)}`,
    ayuda: extras.qr && extras.url
      ? `Escaneá el código QR para seguir el estado de gestoría, papeles y fotos de tu operación en ${esc(urlCorta(extras.url))}`
      : 'Conservá este comprobante de tu Orden de Venta.',
    qr: extras.qr ?? null,
  });

  const cuerpo = `
${encabezadoHero}
${cards(
  bloque('Comprador / Titular de la OV', kv([
    ['Nombre y apellido', v.cliente_nombre],
    ['DNI / CUIT', blanco(v.cliente_documento)],
    ['Teléfono', v.cliente_telefono ?? '—'],
    ['Fecha de emisión', fechaCorta(hoy)],
  ])),
  bloque('Vehículo de la operación', kv([
    ['Vehículo', `${u.titulo} ${u.anio}`],
    ['Dominio (Patente)', u.dominio ?? '—'],
    ['Kilometraje', kmTexto],
    ['Color', u.color ?? '—'],
    ['Motor / Chasis', `${u.nro_motor ?? '—'} / ${u.nro_chasis ?? '—'}`],
  ])),
)}
${tablaPagos}
${legal(`<p><b>Constancia de Orden de Venta (${esc(v.numero)}).</b> <b>${esc(agencia)}</b> emite la presente constancia de operación sobre el vehículo detallado. El comprador puede consultar en todo momento el avance de la documentación, el trámite de transferencia en el Registro Automotor y las fotos de la operación escaneando el código QR impreso en esta hoja.</p>`)}
${firma('', ['Firma del comprador', 'Aclaración y DNI', `Por ${agencia}`])}
${talon}`;

  return unaHoja(
    {
      titulo: 'Orden de Venta (OV)',
      subtitulo: 'Constancia de operación y seguimiento online',
      numero: v.numero,
      meta: fechaCorta(hoy),
      copia: 'Original para el cliente',
      cuerpo,
    },
    empresa,
    `Orden de Venta ${v.numero}`,
  );
}

export interface OrdenAlistajeDoc {
  numero: string;
  tipo_origen?: 'stock' | 'cliente';
  estado: string;
  prioridad: string;
  sector: string;
  responsable: string | null;
  cliente?: {
    nombre: string;
    telefono: string | null;
    documento: string | null;
    email?: string | null;
  } | null;
  unidad: {
    numero: string;
    titulo: string;
    dominio: string | null;
    anio: number;
    km: number;
    color?: string | null;
  };
  falla_motivo: string;
  diagnostico: string | null;
  trabajo_realizado: string | null;
  moneda: 'ARS' | 'USD';
  costo_mano_obra: number;
  total_repuestos: number;
  total_orden: number;
  checklist: { grupo: string; nombre: string; estado: 'pendiente' | 'ok' | 'reparar'; observacion: string | null }[];
  repuestos: { codigo: string | null; nombre: string; cantidad: number; moneda: 'ARS' | 'USD'; costo_unitario: number; subtotal: number }[];
  created_at: string;
}

/**
 * Orden de Alistaje y Taller (OA-2026-XXXX) A4 con QR, checklist de 12 puntos,
 * repuestos del pañol y talón para dejar en el parabrisas / carpeta de taller.
 */
export function armarOrdenDeAlistaje(o: OrdenAlistajeDoc, empresa: EmpresaDoc | null, extras: ExtrasDoc = {}): string {
  const hoy = extras.hoy ?? new Date();
  const agencia = empresa?.name || 'la agencia';
  const u = o.unidad;
  const kmTexto = `${u.km.toLocaleString('es-AR')} km`;

  const encabezadoHero = hero({
    etiqueta: `${o.cliente ? 'ORDEN DE SERVICIO DE TALLER' : 'ORDEN DE ALISTAJE Y TALLER'} · ${o.numero}`,
    grande: `${u.titulo} (${u.anio})`,
    grandeChico: true,
    bajada: `${o.cliente ? `Cliente: ${esc(o.cliente.nombre)} · ` : `Unidad ${esc(u.numero)} · `}Dominio: ${esc(u.dominio || 'S/D')} · Sector: ${esc(o.sector)}`,
    datos: [
      { rotulo: 'Estado', valor: o.estado.replace('_', ' ').toUpperCase() },
      { rotulo: 'Repuestos', valor: monto(o.total_repuestos, o.moneda) },
      { rotulo: 'Mano de obra', valor: monto(o.costo_mano_obra, o.moneda) },
      { rotulo: 'Total Orden', valor: monto(o.total_orden, o.moneda) },
    ],
    qr: extras.qr ?? null,
    qrTexto: extras.qr ? 'Abrir orden en el ERP' : undefined,
  });

  const filasRepuestos = o.repuestos.map((r) => [
    esc(r.codigo || '—'),
    esc(r.nombre),
    esc(String(r.cantidad)),
    esc(monto(r.costo_unitario, r.moneda)),
    esc(monto(r.subtotal, r.moneda)),
  ]);

  const tablaRep = o.repuestos.length
    ? bloque(
        'Repuestos e insumos asignados desde el pañol',
        tabla(
          [
            { texto: 'Código SKU' },
            { texto: 'Repuesto / Insumo' },
            { texto: 'Cant.', alinear: 'centro' },
            { texto: 'Unitario', alinear: 'der' },
            { texto: 'Subtotal', alinear: 'der' },
          ],
          filasRepuestos,
        ),
      )
    : '';

  const checksHtml = checks(
    o.checklist.map((c) => ({
      texto: `${c.nombre}${c.observacion ? ` (${c.observacion})` : ''}`,
      ok: c.estado === 'ok',
    })),
  );

  const talon = talonRetiro({
    numero: `${o.numero} · ${u.dominio || u.numero}`,
    detalle: `${u.titulo} (${u.anio}) · ${o.sector}${o.responsable ? ` · Resp: ${o.responsable}` : ''}`,
    ayuda: `Motivo: ${esc(o.falla_motivo.slice(0, 120))}`,
    qr: extras.qr ?? null,
  });

  const cuerpo = `
${encabezadoHero}
${cards(
  bloque(o.cliente ? 'Cliente y Vehículo recibido' : 'Vehículo en intervención', kv([
    ...(o.cliente
      ? [
          ['Cliente', o.cliente.nombre] as [string, string],
          ['Teléfono / DNI', [o.cliente.telefono, o.cliente.documento ? `DNI ${o.cliente.documento}` : null].filter(Boolean).join(' · ') || '—'] as [string, string],
        ]
      : []),
    ['Vehículo', `${u.titulo} (${u.numero})`],
    ['Dominio (Patente)', u.dominio ?? '—'],
    ['Año / Kilómetros', `${u.anio} · ${kmTexto}`],
    ['Fecha de apertura', fechaCorta(o.created_at || hoy)],
  ])),
  bloque('Asignación de taller', kv([
    ['Sector / Rubro', o.sector],
    ['Responsable / Taller', o.responsable || 'Sin asignar'],
    ['Prioridad', o.prioridad.toUpperCase()],
    ['Pedido inicial', o.falla_motivo],
  ])),
)}
${o.diagnostico || o.trabajo_realizado ? cards(
  bloque('Diagnóstico técnico', `<p style="margin:0;font-size:9.5pt">${esc(o.diagnostico || 'Pendiente de diagnóstico')}</p>`),
  bloque('Trabajo realizado', `<p style="margin:0;font-size:9.5pt">${esc(o.trabajo_realizado || 'En ejecución')}</p>`),
) : ''}
${bloque('Checklist multipunto de inspección y control de calidad (QA)', checksHtml)}
${tablaRep}
${firma('', [o.cliente ? 'Conformidad del cliente' : 'Responsable técnico / Taller', 'Control de calidad (QA)', `Autorizó por ${agencia}`])}
${talon}`;

  return unaHoja(
    {
      titulo: 'Orden de Alistaje',
      subtitulo: 'Preparación mecánica, estética y repuestos',
      numero: o.numero,
      meta: fechaCorta(hoy),
      leyenda: { interno: 'ORDEN INTERNA DE TALLER' },
      cuerpo,
    },
    empresa,
    `Orden Alistaje ${o.numero}`,
  );
}

/**
 * Acta de entrega de unidad y deslinde de responsabilidad civil, penal y de
 * infracciones de tránsito a partir del día y hora exacta de retiro.
 */
export function armarActaDeEntrega(v: VentaAutoDoc, empresa: EmpresaDoc | null, extras: ExtrasDoc = {}): string {
  const hoy = extras.hoy ?? new Date();
  const agencia = empresa?.name || 'la agencia';
  const fechaTexto = fechaCorta(hoy);
  const horaTexto = hora(hoy) || '___:___';

  const accesorios = checks([
    { texto: 'Llave principal de arranque', ok: true },
    { texto: 'Duplicado de llave', ok: true },
    { texto: 'Manual de usuario / libreta de servicios', ok: true },
    { texto: 'Rueda de auxilio', ok: true },
    { texto: 'Crique y llave saca ruedas', ok: true },
    { texto: 'Tuerca de seguridad (si aplica)', ok: true },
    { texto: 'Matafuegos y balizas reglamentarias', ok: true },
    { texto: 'Documentación para circular / constancia registral', ok: true },
  ]);

  const cuerpo = `
${destacado(`ENTREGA EFECTIVA: Fecha <b>${esc(fechaTexto)}</b> a las <b>${esc(horaTexto)} hs</b>.`)}
${cards(
  bloque('Entrega (Agencia)', kv([
    ['Razón social', agencia],
    ['CUIT', blanco(empresa?.cuit)],
    ['Domicilio', blanco(empresa?.direccion, 28)],
  ])),
  bloque('Recibe conforme (Comprador)', kv([
    ['Nombre y apellido', v.cliente_nombre],
    ['DNI / CUIT', blanco(v.cliente_documento)],
    ['Teléfono', v.cliente_telefono ?? '—'],
    ['Operación N°', v.numero],
  ])),
)}
${bloque('Vehículo entregado', kv(paresDelAuto(v)))}
${bloque('Elementos y accesorios verificados en la entrega (tachar lo que no corresponda)', accesorios)}
${legal(`<p><b>1. Recepción y conformidad.</b> En el lugar, fecha y hora exacta indicados arriba, el comprador recibe de conformidad de <b>${esc(agencia)}</b> la posesión física de la unidad descripta, habiendo verificado su funcionamiento mecánico, estado de carrocería, neumáticos, instrumental y los accesorios detallados.</p>
<p><b>2. Deslinde de responsabilidad civil, penal y administrativa.</b> A partir de la hora exacta consignada en la presente acta (<b>${esc(horaTexto)} hs del ${esc(fechaTexto)}</b>), el comprador asume en forma exclusiva toda responsabilidad civil, penal, contravencional y administrativa derivada de la tenencia, guarda, conducción y circulación del vehículo, quedando el vendedor y la agencia eximidos de cualquier siniestro, daño a terceros, peaje o infracción de tránsito posterior a dicho instante.</p>
<p><b>3. Seguro obligatorio.</b> El comprador declara contar con cobertura de seguro de responsabilidad civil vigente para retirar y circular con la unidad desde este momento (Compañía / Póliza: _____________________________________).</p>
<p><b>4. Observaciones adicionales al retiro:</b> ________________________________________________________________________</p>`)}
${firma(`Se firman dos ejemplares de un mismo tenor y a un solo efecto el ${fechaTexto} a las ${horaTexto} hs.`, ['Recibí conforme (Comprador)', 'Aclaración y DNI', `Entregó por ${agencia}`])}`;

  return documento(`Acta de entrega ${v.numero}`, [
    hoja({ titulo: 'Acta de entrega', subtitulo: 'Recepción de vehículo y deslinde de responsabilidad', numero: v.numero, meta: `${fechaTexto} · ${horaTexto} hs`, copia: 'Original para la agencia', cuerpo }, empresa),
  ]);
}

/**
 * Etiqueta recortable para el llavero del tablero de llaves de la agencia,
 * más ficha de control interno de guantera con código QR.
 */
export function armarEtiquetaDeLlave(u: UnidadDoc, empresa: EmpresaDoc | null, extras: ExtrasDoc = {}): string {
  const hoy = extras.hoy ?? new Date();
  const kmTexto = u.condicion === '0km' ? '0 km' : `${u.km.toLocaleString('es-AR')} km`;
  const domTexto = u.dominio || 'SIN DOM';

  const etiquetaLlavero1 = talonRetiro({
    numero: `${u.numero} · ${domTexto}`,
    detalle: `${u.marca} ${u.modelo} ${u.anio}${u.version ? ` (${u.version})` : ''}`,
    ayuda: `Color: ${esc(u.color ?? '—')} · ${esc(kmTexto)} · Caja: ${esc(CAJA_DOC[u.transmision ?? ''] ?? '—')} · Comb.: ${esc(COMBUSTIBLE_DOC[u.combustible ?? ''] ?? '—')}`,
    qr: extras.qr ?? null,
  });

  const etiquetaLlavero2 = talonRetiro({
    numero: `${domTexto} · ${u.numero}`,
    detalle: `${u.marca} ${u.modelo} (${u.anio}) — LLAVE DUPLICADO / CARPETA`,
    ayuda: `Origen: ${esc(u.origen.toUpperCase())} · Ingreso: ${esc(fechaCorta(hoy))}${u.titular_nombre ? ` · Titular: ${esc(u.titular_nombre)}` : ''}`,
    qr: extras.qr ?? null,
  });

  const cuerpo = `
${bloque('Control interno de unidad y llaves', kv([
  ['Código interno', u.numero],
  ['Dominio (Patente)', domTexto],
  ['Vehículo', `${u.titulo} (${u.anio})`],
  ['Kilometraje', kmTexto],
  ['Color', u.color ?? '—'],
  ['Motor / Chasis', `${u.nro_motor ?? '—'} / ${u.nro_chasis ?? '—'}`],
]))}
${etiquetaLlavero1}
${etiquetaLlavero2}`;

  return unaHoja(
    {
      titulo: 'Etiquetas de llave',
      subtitulo: 'Identificación para tablero de llaves y carpeta',
      numero: u.numero,
      meta: domTexto,
      leyenda: { interno: 'USO INTERNO AGENCIA' },
      cuerpo,
    },
    empresa,
    `Llave ${u.numero}`,
  );
}
