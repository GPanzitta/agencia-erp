import { esc, legal } from './plantilla.util';

export type ClaveDocumentoAgencia =
  | 'boleto'
  | 'orden_venta'
  | 'recibo'
  | 'acta_entrega'
  | 'consignacion_contrato'
  | 'consignacion_liquidacion'
  | 'propuesta'
  | 'peritaje'
  | 'orden_alistaje'
  | 'cartel_vidriera'
  | 'etiqueta_llave';

export type CategoriaDocumentoAgencia =
  | 'Ventas y Operaciones'
  | 'Consignación y Toma'
  | 'Taller y Salón';

export interface PlantillaDocumentoAgencia {
  clave: ClaveDocumentoAgencia;
  nombre: string;
  categoria: CategoriaDocumentoAgencia;
  descripcion: string;
  titulo: string;
  subtitulo: string;
  copia: string;
  /**
   * Párrafos de cláusulas legales o condiciones del documento.
   * Cada salto de línea genera un párrafo `<p>...</p>`.
   * Si un párrafo empieza con `1. Objeto.` o `Título:`, esa primera frase sale en negrita.
   * Soporta variables entre llaves como `{agencia}`, `{cliente}`, `{vehiculo}`, `{precio}`, etc.
   */
  clausulas: string;
  /** Frase que aparece en la barra superior del cuadro de firmas. */
  texto_conformidad: string;
  /** Rótulos de las líneas de firma (separados en hasta 3 columnas). */
  firmas: [string, string, string];
  /** Observación fija o pie adicional opcional. */
  observaciones_pie: string;
  /** Color principal de la barra y acentos del documento (hexadecimal). */
  color_acento: string;
}

export const STORAGE_KEY_PLANTILLAS_DOC = 'fg_autos_plantillas_documentos_v1';

export const VARIABLES_DOCUMENTO: { clave: string; descripcion: string; ejemplo: string }[] = [
  { clave: 'agencia', descripcion: 'Nombre o razón social de la agencia', ejemplo: 'FG Autos' },
  { clave: 'cuit_agencia', descripcion: 'CUIT de la agencia', ejemplo: '30-71558899-9' },
  { clave: 'domicilio_agencia', descripcion: 'Domicilio comercial de la agencia', ejemplo: 'Av. del Libertador 14200' },
  { clave: 'cliente', descripcion: 'Nombre y apellido del cliente / titular', ejemplo: 'Martín Pereyra' },
  { clave: 'dni_cliente', descripcion: 'DNI o CUIT del cliente', ejemplo: '32.451.890' },
  { clave: 'telefono_cliente', descripcion: 'Teléfono del cliente', ejemplo: '11 5544-3322' },
  { clave: 'vehiculo', descripcion: 'Marca, modelo, versión y año del vehículo', ejemplo: 'Volkswagen Nivus 200 TSI Highline 2022' },
  { clave: 'dominio', descripcion: 'Patente / Dominio del vehículo', ejemplo: 'AF 482 KL' },
  { clave: 'anio', descripcion: 'Año del vehículo', ejemplo: '2022' },
  { clave: 'km', descripcion: 'Kilometraje del vehículo', ejemplo: '34.500 km' },
  { clave: 'motor', descripcion: 'Número de motor', ejemplo: 'DHS294810' },
  { clave: 'chasis', descripcion: 'Número de chasis / VIN', ejemplo: '9BWAA45U2NP049182' },
  { clave: 'numero', descripcion: 'Número del documento / operación / unidad', ejemplo: 'OP-2026-0014' },
  { clave: 'precio', descripcion: 'Precio total o valor principal de la operación', ejemplo: 'USD 24.500,00' },
  { clave: 'pagado', descripcion: 'Total abonado / señado hasta la fecha', ejemplo: 'USD 5.000,00' },
  { clave: 'saldo', descripcion: 'Saldo pendiente de cancelar', ejemplo: 'USD 19.500,00' },
  { clave: 'piso', descripcion: 'Precio piso neto en consignación', ejemplo: 'USD 21.000,00' },
  { clave: 'neto_liquidar', descripcion: 'Monto neto a liquidar al comitente', ejemplo: 'USD 20.650,00' },
  { clave: 'validez_horas', descripcion: 'Horas de validez del presupuesto', ejemplo: '48' },
  { clave: 'fecha', descripcion: 'Fecha de emisión (dd/mm/aaaa)', ejemplo: '25/11/2026' },
  { clave: 'hora', descripcion: 'Hora de emisión (hh:mm)', ejemplo: '10:30' },
];

export const PLANTILLAS_DOCUMENTO_BASE: Record<ClaveDocumentoAgencia, PlantillaDocumentoAgencia> = {
  boleto: {
    clave: 'boleto',
    nombre: 'Boleto de compraventa',
    categoria: 'Ventas y Operaciones',
    descripcion: 'Contrato de compraventa automotor con detalle del vendedor, comprador, vehículo, pagos y cláusulas legales.',
    titulo: 'Boleto de compraventa',
    subtitulo: 'Vehículo automotor',
    copia: 'Ejemplar para el comprador',
    clausulas: [
      '1. Objeto. El vendedor ({agencia}) vende al comprador ({cliente}), y este compra, el vehículo descripto ({vehiculo}, dominio {dominio}), en el estado en que se encuentra, que el comprador declara haber revisado y probado a su entera conformidad.',
      '2. Precio y forma de pago. El precio total convenido es de {precio}. A la fecha se abonaron {pagado}, restando un saldo de {saldo} que el comprador abonará antes de la entrega efectiva de la unidad.',
      '3. Entrega. El vehículo se entrega una vez cancelado el precio convenido, junto con la documentación necesaria para su transferencia.',
      '4. Transferencia registral. Las partes se obligan a firmar la documentación registral (Formulario 08 y demás recaudos) para inscribir la transferencia en el Registro de la Propiedad del Automotor. Los gastos de transferencia quedan a cargo del comprador.',
      '5. Deudas e infracciones. Las deudas de patentes e infracciones anteriores a la entrega son a cargo del vendedor; las posteriores quedan a exclusivo cargo del comprador desde la recepción de la unidad.',
      '6. Observaciones especiales: ______________________________________________________________________________',
    ].join('\n'),
    texto_conformidad: 'En conformidad, a los {fecha}, se firman dos ejemplares de un mismo tenor y a un solo efecto.',
    firmas: ['Firma del comprador', 'Aclaración y DNI', 'Por {agencia}'],
    observaciones_pie: '',
    color_acento: '#FF7F00',
  },
  orden_venta: {
    clave: 'orden_venta',
    nombre: 'Orden de Venta (OV) con QR',
    categoria: 'Ventas y Operaciones',
    descripcion: 'Constancia de reserva u operación de venta con estado de cuenta, talón recortable y código QR de seguimiento online.',
    titulo: 'Orden de Venta (OV)',
    subtitulo: 'Constancia de operación y seguimiento online',
    copia: 'Original para el cliente',
    clausulas: [
      '1. Constancia de Orden de Venta ({numero}). {agencia} emite la presente constancia de operación a favor de {cliente} sobre el vehículo {vehiculo} (dominio {dominio}) por un precio total acordado de {precio}.',
      '2. Seguimiento en vivo. El comprador puede consultar en todo momento el avance de la documentación, el trámite de transferencia en el Registro Automotor y las fotos de la operación escaneando el código QR impreso en esta hoja.',
    ].join('\n'),
    texto_conformidad: 'Emitido el {fecha} para seguimiento y control de la operación {numero}.',
    firmas: ['Firma del comprador', 'Aclaración y DNI', 'Por {agencia}'],
    observaciones_pie: '',
    color_acento: '#FF7F00',
  },
  recibo: {
    clave: 'recibo',
    nombre: 'Recibo de seña / pago',
    categoria: 'Ventas y Operaciones',
    descripcion: 'Comprobante de cobro de seña, anticipo o pago parcial/total de una operación.',
    titulo: 'Recibo de pago',
    subtitulo: 'Compra de un vehículo',
    copia: 'Original para el cliente',
    clausulas: [
      '1. Recepción de pago. {agencia} recibe de {cliente} (DNI/CUIT {dni_cliente}) el importe detallado arriba en concepto de pago a cuenta / seña de la operación {numero} sobre el vehículo {vehiculo}, cuyo precio total acordado es de {precio}.',
      '2. Estado de cuenta. Con este pago el comprador lleva abonado un total acumulado de {pagado}, quedando un saldo pendiente de {saldo}.',
    ].join('\n'),
    texto_conformidad: 'Comprobante emitido el {fecha}.',
    firmas: ['Firma del cliente', 'Aclaración y DNI', 'Recibió por {agencia}'],
    observaciones_pie: '',
    color_acento: '#FF7F00',
  },
  acta_entrega: {
    clave: 'acta_entrega',
    nombre: 'Acta de entrega de unidad',
    categoria: 'Ventas y Operaciones',
    descripcion: 'Constancia con fecha y hora exacta de retiro del vehículo, checklist de elementos entregados y deslinde de responsabilidad civil y penal.',
    titulo: 'Acta de entrega',
    subtitulo: 'Recepción de vehículo y deslinde de responsabilidad',
    copia: 'Original para la agencia',
    clausulas: [
      '1. Recepción y conformidad. En el día {fecha} a las {hora} hs, {cliente} recibe de conformidad de {agencia} la posesión física de la unidad {vehiculo} (dominio {dominio}), habiendo verificado su funcionamiento mecánico, carrocería, neumáticos, instrumental y los accesorios detallados.',
      '2. Deslinde de responsabilidad civil, penal y administrativa. A partir de las {hora} hs del {fecha}, el comprador asume en forma exclusiva toda responsabilidad civil, penal, contravencional y administrativa derivada de la tenencia, guarda, conducción y circulación del vehículo, eximiendo al vendedor y a {agencia} de cualquier siniestro, daño a terceros, peaje o infracción posterior a dicho instante.',
      '3. Seguro obligatorio. El comprador declara contar con cobertura de seguro de responsabilidad civil vigente para retirar y circular con la unidad desde este momento (Compañía / Póliza: _____________________________________).',
      '4. Observaciones adicionales al retiro: ________________________________________________________________________',
    ].join('\n'),
    texto_conformidad: 'Se firman dos ejemplares de un mismo tenor y a un solo efecto el {fecha} a las {hora} hs.',
    firmas: ['Recibí conforme (Comprador)', 'Aclaración y DNI', 'Entregó por {agencia}'],
    observaciones_pie: '',
    color_acento: '#FF7F00',
  },
  consignacion_contrato: {
    clave: 'consignacion_contrato',
    nombre: 'Contrato de consignación',
    categoria: 'Consignación y Toma',
    descripcion: 'Autorización de venta de vehículo dejado en consignación con precio piso neto al propietario y checklist de papeles.',
    titulo: 'Contrato de consignación',
    subtitulo: 'Autorización de venta de vehículo',
    copia: 'Original para el propietario',
    clausulas: [
      '1. Autorización de venta. El propietario ({cliente}) entrega a {agencia} el vehículo {vehiculo} (dominio {dominio}) en carácter de consignación, autorizándola a exhibirlo en su salón y canales digitales, realizar pruebas de manejo supervisadas y recibir señas o reservas de interesados.',
      '2. Precio piso y retribución. El propietario fija como valor neto de liquidación a su favor la suma de {piso}. Todo importe obtenido por encima de dicho valor piso, o la comisión acordada entre las partes, corresponderá a {agencia} en concepto de gestión comercial y publicidad.',
      '3. Situación registral y deudas. El propietario declara bajo juramento que el vehículo no registra prendas, embargos ni inhibiciones, y asume a su exclusivo cargo todas las deudas de patentes, infracciones de tránsito y gravámenes devengados hasta el día de la entrega efectiva al comprador.',
      '4. Guarda y retiro. En caso de que el propietario decida retirar la unidad antes de concretarse la venta, deberá notificarlo fehacientemente y abonar los gastos de alistaje, gestoría o preparación que hubiese autorizado previamente.',
    ].join('\n'),
    texto_conformidad: 'A los {fecha}, se firman dos ejemplares de conformidad.',
    firmas: ['Firma del propietario', 'Aclaración y DNI', 'Recibió por {agencia}'],
    observaciones_pie: '',
    color_acento: '#FF7F00',
  },
  consignacion_liquidacion: {
    clave: 'consignacion_liquidacion',
    nombre: 'Liquidación de consignación',
    categoria: 'Consignación y Toma',
    descripcion: 'Rendición final al propietario de un vehículo vendido en consignación con deducción de gastos de alistaje.',
    titulo: 'Liquidación de consignación',
    subtitulo: 'Rendición al propietario',
    copia: 'Comprobante de liquidación',
    clausulas: [
      '1. Liquidación definitiva. Recibí de {agencia} la suma neta de {neto_liquidar} en concepto de liquidación total y definitiva por la venta del vehículo en consignación {vehiculo} (dominio {dominio}, unidad {numero}), no teniendo nada más que reclamar por ningún concepto derivado de dicha operación.',
    ].join('\n'),
    texto_conformidad: 'Liquidación emitida y conformada el {fecha}.',
    firmas: ['Recibí conforme (Propietario)', 'Aclaración y DNI', 'Liquidó por {agencia}'],
    observaciones_pie: '',
    color_acento: '#FF7F00',
  },
  propuesta: {
    clave: 'propuesta',
    nombre: 'Propuesta comercial («Llave por llave»)',
    categoria: 'Ventas y Operaciones',
    descripcion: 'Hoja de presupuesto combinando precio del auto, toma de usado en parte de pago, efectivo y plan de cuotas.',
    titulo: 'Propuesta comercial',
    subtitulo: 'Presupuesto de compra y permuta',
    copia: 'Original para el interesado',
    clausulas: [
      '1. Validez y condiciones. Presupuesto informativo emitido por {agencia} para {cliente} el {fecha} con validez de {validez_horas} horas, sujeto a disponibilidad de la unidad {vehiculo} y, en caso de permuta o financiación, a la revisión física y registral del vehículo entregado y aprobación crediticia.',
    ].join('\n'),
    texto_conformidad: 'Propuesta preparada por {agencia} el {fecha}.',
    firmas: ['Interesado / Cliente', 'Asesor comercial', 'Por {agencia}'],
    observaciones_pie: '',
    color_acento: '#FF7F00',
  },
  peritaje: {
    clave: 'peritaje',
    nombre: 'Hoja de peritaje y tasación de toma',
    categoria: 'Consignación y Toma',
    descripcion: 'Informe técnico de inspección por rubros para respaldar la cotización de toma de un vehículo usado.',
    titulo: 'Peritaje de toma',
    subtitulo: 'Tasación técnica de vehículo usado',
    copia: 'Copia para el titular',
    clausulas: [
      '1. Alcance de la tasación. La presente tasación refleja el valor de toma ({precio}) ofrecido por {agencia} para el vehículo {vehiculo} (dominio {dominio}), contemplando los costos de reacondicionamiento necesarios para dejar la unidad en condiciones de venta con garantía al próximo comprador y libre de deuda registral.',
    ].join('\n'),
    texto_conformidad: 'Inspección realizada el {fecha}.',
    firmas: ['Conformidad del titular', 'Aclaración y DNI', 'Tasador por {agencia}'],
    observaciones_pie: '',
    color_acento: '#FF7F00',
  },
  orden_alistaje: {
    clave: 'orden_alistaje',
    nombre: 'Orden de Servicio / Alistaje de Taller (OA)',
    categoria: 'Taller y Salón',
    descripcion: 'Orden de trabajo mecánico o estético (para autos del stock o de clientes externos) con checklist de 12 puntos, repuestos y QR.',
    titulo: 'Orden de Servicio / Alistaje',
    subtitulo: 'Preparación mecánica, estética y repuestos',
    copia: 'Orden de taller y constancia',
    clausulas: [
      '1. Intervención y control de calidad. Todo repuesto o insumo asignado a la orden {numero} sobre el vehículo {vehiculo} (dominio {dominio}) debe quedar registrado en el pañol de {agencia} y superar la verificación de los 12 puntos de control de calidad (QA) antes de su entrega o pase al salón de ventas.',
    ].join('\n'),
    texto_conformidad: 'Orden {numero} emitida el {fecha}.',
    firmas: ['Conformidad cliente / Taller', 'Control de calidad (QA)', 'Autorizó por {agencia}'],
    observaciones_pie: '',
    color_acento: '#FF7F00',
  },
  cartel_vidriera: {
    clave: 'cartel_vidriera',
    nombre: 'Cartel A4 de exposición / vidriera',
    categoria: 'Taller y Salón',
    descripcion: 'Hoja A4 para apoyar en el parabrisas del auto en el salón, con ficha técnica, precio y código QR grande.',
    titulo: 'Ficha de exposición',
    subtitulo: 'Unidad seleccionada en salón',
    copia: 'Exposición en salón',
    clausulas: [
      'Consultá planes de financiación en cuotas fijas y entrega de tu usado en parte de pago en {agencia}. Escaneá el código QR para ver la galería de fotos completa y simular tus cuotas desde el celular.',
    ].join('\n'),
    texto_conformidad: '',
    firmas: ['', '', ''],
    observaciones_pie: '',
    color_acento: '#FF7F00',
  },
  etiqueta_llave: {
    clave: 'etiqueta_llave',
    nombre: 'Etiquetas de llavero y carpeta',
    categoria: 'Taller y Salón',
    descripcion: 'Ficha de control interno de guantera más dos etiquetas recortables con QR para la llave principal y el duplicado.',
    titulo: 'Etiquetas de llave',
    subtitulo: 'Identificación para tablero de llaves y carpeta',
    copia: 'Control interno',
    clausulas: [
      'Recortá los talones inferiores por la línea punteada para identificar la llave principal en el tablero de {agencia} y el duplicado dentro de la carpeta física de la unidad {numero} ({dominio}).',
    ].join('\n'),
    texto_conformidad: '',
    firmas: ['', '', ''],
    observaciones_pie: '',
    color_acento: '#FF7F00',
  },
};

export function listarPlantillasDocumento(): PlantillaDocumentoAgencia[] {
  const guardadas = leerMapaGuardado();
  return (Object.keys(PLANTILLAS_DOCUMENTO_BASE) as ClaveDocumentoAgencia[]).map((clave) => ({
    ...PLANTILLAS_DOCUMENTO_BASE[clave],
    ...(guardadas[clave] ?? {}),
    clave,
  }));
}

export function obtenerPlantillaDoc(clave: ClaveDocumentoAgencia): PlantillaDocumentoAgencia {
  const base = PLANTILLAS_DOCUMENTO_BASE[clave];
  const guardadas = leerMapaGuardado();
  const custom = guardadas[clave];
  if (!custom) return { ...base, firmas: [...base.firmas] as [string, string, string] };
  return {
    ...base,
    ...custom,
    clave,
    firmas: (Array.isArray(custom.firmas) && custom.firmas.length === 3
      ? [...custom.firmas]
      : [...base.firmas]) as [string, string, string],
  };
}

export function guardarPlantillaDoc(plantilla: PlantillaDocumentoAgencia): void {
  if (typeof window === 'undefined') return;
  const mapa = leerMapaGuardado();
  mapa[plantilla.clave] = {
    ...plantilla,
    firmas: [...plantilla.firmas] as [string, string, string],
  };
  try {
    window.localStorage.setItem(STORAGE_KEY_PLANTILLAS_DOC, JSON.stringify(mapa));
  } catch {
    /* localStorage lleno o bloqueado */
  }
}

export function restaurarPlantillaDoc(clave: ClaveDocumentoAgencia): PlantillaDocumentoAgencia {
  if (typeof window !== 'undefined') {
    const mapa = leerMapaGuardado();
    delete mapa[clave];
    try {
      window.localStorage.setItem(STORAGE_KEY_PLANTILLAS_DOC, JSON.stringify(mapa));
    } catch {
      /* ignore */
    }
  }
  const base = PLANTILLAS_DOCUMENTO_BASE[clave];
  return { ...base, firmas: [...base.firmas] as [string, string, string] };
}

export function tieneCambiosPlantillaDoc(clave: ClaveDocumentoAgencia): boolean {
  const mapa = leerMapaGuardado();
  return !!mapa[clave];
}

function leerMapaGuardado(): Partial<Record<ClaveDocumentoAgencia, PlantillaDocumentoAgencia>> {
  if (typeof window === 'undefined') return {};
  try {
    const crudo = window.localStorage.getItem(STORAGE_KEY_PLANTILLAS_DOC);
    if (!crudo) return {};
    const parsed = JSON.parse(crudo);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Reemplaza `{variable}` en un texto plano con los valores de la operación/unidad.
 */
export function interpolarVariablesDoc(plantillaTexto: string, vars: Record<string, string | number | null | undefined>): string {
  return (plantillaTexto ?? '').replace(/\{([a-z0-9_]+)\}/gi, (coincidencia, clave: string) => {
    const k = clave.toLowerCase();
    if (k in vars) {
      const val = vars[k];
      return val !== null && val !== undefined && String(val).trim() !== '' ? String(val) : '—';
    }
    return coincidencia;
  });
}

/**
 * Convierte el texto multilínea de `clausulas` de una plantilla en un bloque HTML
 * `.legal.box` seguro (escapado) con encabezados numerados (`1. Objeto.`) en negrita.
 */
export function renderizarClausulasHtml(
  clausulasTexto: string,
  vars: Record<string, string | number | null | undefined>,
  observacionesPie?: string,
): string {
  const lineas = (clausulasTexto ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lineas.length && !observacionesPie?.trim()) return '';

  const parrafos = lineas.map((linea) => {
    const interpolada = interpolarVariablesDoc(linea, vars);
    // Si empieza con "1. Título." o "Cláusula:" ponemos ese encabezado en <b>
    const matchEncabezado = /^(\d+\.\s+[^.:]+[.:]|[^.:]{2,38}:)\s*(.*)$/.exec(interpolada);
    if (matchEncabezado) {
      return `<p><b>${esc(matchEncabezado[1])}</b> ${esc(matchEncabezado[2])}</p>`;
    }
    return `<p>${esc(interpolada)}</p>`;
  });

  if (observacionesPie?.trim()) {
    const obs = interpolarVariablesDoc(observacionesPie.trim(), vars);
    parrafos.push(`<p><b>Nota:</b> ${esc(obs)}</p>`);
  }

  return legal(parrafos.join('\n'));
}

export function renderizarFirmasDoc(
  plantilla: PlantillaDocumentoAgencia,
  vars: Record<string, string | number | null | undefined>,
): { acepto: string; rotulos: string[] } {
  const acepto = interpolarVariablesDoc(plantilla.texto_conformidad, vars);
  const rotulos = plantilla.firmas
    .map((f) => interpolarVariablesDoc(f, vars).trim())
    .filter(Boolean);
  return { acepto, rotulos };
}
