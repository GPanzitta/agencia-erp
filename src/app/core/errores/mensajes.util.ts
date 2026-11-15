import { tamanoLegible } from '../utils/tamano.util';

/**
 * Traduce el error del backend a algo que una persona entiende, y cuando hay
 * una salida obvia la ofrece como botón.
 *
 * Es un util puro para poder testear la traducción sin levantar Angular: el
 * interceptor solo dibuja lo que esta función decide.
 *
 * Regla: el `code` es el contrato. El `message` del backend es respaldo — se
 * muestra cuando el código no está mapeado, y en los códigos genéricos
 * (DATOS_INVALIDOS, SOLICITUD_RECHAZADA, CONFLICTO, NO_ENCONTRADO,
 * SIN_PERMISO), donde el backend ya mandó el texto listo.
 *
 * Regla de las rutas: `accion.ruta` solo puede apuntar a una pantalla que
 * existe de verdad en el router del ERP. Un botón a una ruta inexistente es
 * peor que ningún botón, así que un código sin pantalla de destino queda sin
 * `accion` aunque tenga una salida "lógica" — la salida real, en esos casos,
 * la resuelve un administrador desde otro lado.
 */

export interface MensajeOperativo {
  titulo: string;
  detalle: string;
  /** Adónde ir para resolverlo. Solo cuando la salida está en otra pantalla que existe. */
  accion?: { texto: string; ruta: string };
}

/** Los documentos de la orden en PDF, como los nombra un aviso (spec 2026-10-07 §4.1). */
const DOCUMENTO_DE_LA_ORDEN: Record<string, string> = {
  presupuesto: 'El presupuesto',
  remito_recepcion: 'El remito de recepción',
  acta_entrega: 'El acta de entrega',
  certificado_garantia: 'El certificado de garantía',
};

interface Traduccion {
  titulo: string;
  detalle: string | ((datos: Record<string, any>) => string);
  accion?: { texto: string; ruta: string };
}

/**
 * Fecha del backend a dd/mm/aaaa, sin pasar por `new Date()`.
 *
 * Las fechas llegan como 'aaaa-mm-dd' o como ISO con hora en UTC; parsearlas
 * con Date y formatearlas en es-AR (UTC-3) corre el día para atrás y el aviso
 * termina diciendo una fecha que no es. Se corta el prefijo y se da vuelta.
 */
function fechaCorta(valor: unknown): string {
  const texto = String(valor ?? '');
  const iso = texto.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return texto;
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

/** Importe con dos decimales y separadores de acá: 12345.6 → 12.345,60. */
function pesos(valor: unknown): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) return String(valor ?? '');
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Un medio de cobro de la puerta adentro de una oración: «por transferencia», «por Mercado Pago». */
function medioEnOracion(valor: unknown): string {
  if (valor === 'mercado_pago') return 'Mercado Pago';
  if (valor === 'transferencia' || valor === 'efectivo') return valor;
  return 'ese medio';
}

const TRADUCCIONES: Record<string, Traduccion> = {
  // El turno se abre y se cierra desde la pantalla Cajas (/home/cajas).
  CAJA_CERRADA: {
    titulo: 'No hay una caja abierta',
    detalle:
      'Para mover plata tiene que haber un turno de caja abierto. Abrilo desde Cajas ' +
      '(lo puede abrir el mostrador o un administrador).',
    accion: { texto: 'Ir a Cajas', ruta: '/home/cajas' },
  },
  CAJA_YA_ABIERTA: {
    titulo: 'Ya hay una caja abierta',
    detalle:
      'Ya hay un turno de caja en curso. Si hace falta cerrarlo, lo hace un administrador ' +
      'desde Cajas.',
  },
  MONTOS_APERTURA_FALTANTES: {
    titulo: 'Falta declarar los montos',
    detalle: 'Cargá cuánta plata hay en al menos una billetera para abrir el turno.',
  },
  FONDOS_INSUFICIENTES: {
    titulo: 'No alcanza la plata de esa caja',
    detalle: (d) =>
      `En "${d['billetera']}" hay $${d['disponible']} y el movimiento es de $${d['solicitado']}. ` +
      'Elegí otra billetera o registrá primero el ingreso que falta.',
  },
  DESTINO_REQUERIDO: {
    titulo: 'Ese pago es de un turno ya cerrado',
    detalle: 'Decinos qué pasó: si el proveedor devolvió la plata, o si fue un error de carga.',
  },
  ACCION_INVALIDA_PARA_ESTADO: {
    titulo: 'Esa acción ya no corresponde',
    detalle:
      'La orden cambió de etapa desde que abriste la pantalla. Puede que la haya movido otra ' +
      'persona: actualizá la pantalla y fijate qué corresponde ahora.',
  },
  DIAGNOSTICO_REQUERIDO: {
    titulo: 'Falta escribir el diagnóstico',
    detalle: 'Contá qué tiene el equipo antes de pasarlo a la etapa siguiente.',
  },
  MONTO_PRESUPUESTO_REQUERIDO: {
    titulo: 'Falta el monto del presupuesto',
    detalle: 'Cargá cuánto sale la reparación. Solo las órdenes en garantía pueden ir en $0.',
  },
  EXCESO_NO_CONFIRMADO: {
    titulo: 'Llegó más de lo pedido',
    detalle: 'Tildá la confirmación del exceso en ese renglón antes de registrar la entrega.',
  },
  OC_NO_EDITABLE: {
    titulo: 'Esa orden ya no se edita',
    detalle: 'Tiene entregas registradas o no está pendiente. Para corregir, registrá una devolución o cancelala.',
  },
  OC_SIN_FALTANTE: {
    titulo: 'No hay faltante que cerrar',
    detalle: 'Solo se cierra con faltante una orden parcial.',
  },
  DEVOLUCION_EXCEDE_RECIBIDO: {
    titulo: 'No se recibió tanto',
    detalle: 'La cantidad a devolver supera lo que entró de esa orden.',
  },
  // El pago contra entrega sale de la factura, así que un neto que no
  // coincide con lo recibido se frena antes de mover plata. Sin `accion`: se
  // resuelve en la misma pantalla, con el aviso de la factura. `renglones`
  // viene en pesos; en una orden en dólares se aclara el cambio, porque el
  // operario compara contra un remito que dice USD.
  FACTURA_DIFIERE: {
    titulo: 'La factura no coincide con lo recibido',
    detalle: (d) => {
      const cola =
        'Si la diferencia es real (una bonificación, por ejemplo), confirmala en el aviso de la ' +
        'factura; si no, corregí el neto.';
      if (d['neto'] == null || d['renglones'] == null) {
        return `El neto de la factura no coincide con lo que suman los renglones. ${cola}`;
      }
      const enDolares = d['moneda'] != null && d['moneda'] !== 'ARS';
      const alCambio =
        enDolares && d['tipo_cambio'] != null
          ? ` al cambio de la entrega ($${pesos(d['tipo_cambio'])} por ${d['moneda']})`
          : '';
      const enPesos = enDolares ? ' La factura va en pesos.' : '';
      return (
        `El neto de la factura ($${pesos(d['neto'])}) no coincide con lo recibido: los renglones ` +
        `suman $${pesos(d['renglones'])}${alCambio}.${enPesos} ${cola}`
      );
    },
  },
  DESGUACE_ORIGEN_INVALIDO: {
    titulo: 'Falta decir de dónde sale el equipo',
    detalle: 'Elegí una orden, un repuesto del catálogo, o escribí el tipo de equipo.',
  },
  DESGUACE_CERRADO: {
    titulo: 'Ese desguace ya está cerrado',
    detalle: 'No se le agregan más piezas. Si sobró algo, abrí otro desguace.',
  },
  DESGUACE_SIN_PIEZAS: {
    titulo: 'No tiene piezas',
    detalle: 'Un desguace sin piezas se borra, no se cierra.',
  },
  PIEZA_YA_USADA: {
    titulo: 'Esa pieza ya se usó',
    detalle: 'Salió del stock en una orden: no se puede quitar del desguace.',
  },
  PRESUPUESTO_VENCIDO: {
    titulo: 'El presupuesto venció',
    detalle: (d) =>
      d['vigente_hasta'] == null
        ? 'Pasó la fecha de validez. Hay que recotizar antes de que el cliente apruebe.'
        : `Venció el ${fechaCorta(d['vigente_hasta'])}. Hay que recotizar antes de que el ` +
          'cliente apruebe.',
  },
  COBRO_SIN_BILLETERA: {
    titulo: 'Falta elegir dónde entra la plata',
    detalle: (d) =>
      d['saldo'] == null
        ? 'Marcá en qué billetera se cobra antes de entregar el equipo.'
        : `Falta cobrar $${pesos(d['saldo'])}. Marcá en qué billetera entra antes de ` +
          'entregar el equipo.',
  },
  // Ruta real verificada contra gastos-routing.module.ts: 'purchase-orders',
  // no 'ordenes-compra' (esa no existe).
  SIN_RESPALDO_DE_COMPRA: {
    titulo: 'Ese repuesto no tiene compra respaldatoria',
    // Con `bloqueos` el aviso dice QUÉ repuesto y por qué: sin eso, quien
    // recibe el paquete no sabe cuál de los cinco renglones lo está frenando.
    detalle: (d) => {
      const bloqueos = d['bloqueos'];
      if (!Array.isArray(bloqueos) || !bloqueos.length) {
        return (
          'No se puede dar por recibido un repuesto sin una orden de compra paga. ' +
          'Cargá la compra, o pedile al encargado que revise la regla.'
        );
      }
      const detalles = bloqueos.map((b: any) => `"${b?.nombre}" ${b?.motivo}`).join('; ');
      return (
        `No se puede dar por recibido: ${detalles}. ` +
        'Cargá la compra, o pedile al encargado que revise la regla.'
      );
    },
    accion: { texto: 'Ir a compras', ruta: '/home/gastos/purchase-orders' },
  },
  CUPO_COMPLETO: {
    titulo: 'Ese horario ya está completo',
    detalle: (d) =>
      d['ocupados'] == null || d['cupo'] == null
        ? 'Elegí otro horario. Si es urgente, un encargado puede forzar el turno.'
        : `Ya hay ${d['ocupados']} de ${d['cupo']} turnos en ese horario. Elegí otro; ` +
          'si es urgente, un encargado puede forzar el turno.',
  },
  DIA_NO_LABORABLE: {
    titulo: 'Ese día el taller no atiende',
    detalle: (d) =>
      d['fecha'] == null
        ? 'Elegí un día habilitado en la configuración de la agenda.'
        : `El ${fechaCorta(d['fecha'])} el taller no atiende. Elegí un día habilitado.`,
  },
  // D2 (tanda 3b): la caja de la ruta es sólo para el efectivo. Sin caja el
  // chofer igual puede cobrar por transferencia o Mercado Pago.
  RUTA_SIN_BILLETERA: {
    titulo: 'La ruta no tiene caja para efectivo',
    detalle:
      'Cobrá por transferencia o Mercado Pago, o pedile al mostrador que le asigne una caja a la ruta.',
  },
  // D2: el medio que eligió el chofer no tiene dónde entrar (la billetera no
  // está configurada o está desactivada). El backend corta antes de tocar
  // nada y la pantalla de la ruta se recarga sola. Sin `accion`: el chofer no
  // entra a Configuración; la salida es cobrar por otro medio o avisar.
  MEDIO_SIN_BILLETERA: {
    titulo: 'No se puede cobrar por ese medio',
    detalle: (d) => {
      if (d['motivo'] === 'inactiva') {
        const cual = d['billetera'] == null ? 'de ese medio' : `«${d['billetera']}»`;
        return (
          `La billetera ${cual} está desactivada. Cobrá por otro medio o avisale al mostrador ` +
          'antes de dejar el equipo.'
        );
      }
      return (
        `El taller todavía no configuró dónde entran los cobros por ${medioEnOracion(d['medio'])}. ` +
        'Cobrá por otro medio o pedile al administrador que lo cargue en Configuración › Empresa.'
      );
    },
  },
  // D2: la billetera de MP o la de transferencias no puede ser la caja de una
  // ruta: el cierre rendiría como efectivo plata que está en el banco. Salta al
  // crear la ruta o al configurar la empresa; se resuelve en la misma pantalla.
  RUTA_BILLETERA_RESERVADA: {
    titulo: 'Esa billetera ya tiene otro uso',
    detalle: (d) => {
      const billetera = d['billetera'] == null ? 'Esa billetera' : `«${d['billetera']}»`;
      const ruta = d['ruta_abierta'];
      if (ruta) {
        const cuando = ruta?.fecha ? ` (${fechaCorta(ruta.fecha)})` : '';
        return (
          `${billetera} es la caja de una ruta que todavía no se cerró${cuando}. Cerrala primero ` +
          'o elegí otra billetera.'
        );
      }
      const cual =
        d['reservada_para'] === 'mercado_pago'
          ? 'la billetera de Mercado Pago'
          : d['reservada_para'] === 'transferencia'
            ? 'la billetera de las transferencias'
            : 'una billetera de cobros (Mercado Pago o transferencias)';
      return `${billetera} es ${cual}: el efectivo del chofer va a una caja propia, de tipo efectivo.`;
    },
  },
  // #41: la billetera de cobros de MP o la de transferencias no se desactiva
  // ni se borra. La salida es elegir otra: la de MP se cambia en Tienda
  // (`interpretarError` pisa la `accion`), la de transferencias en Empresa,
  // que tiene las dos y por eso es también la salida sin `uso`.
  BILLETERA_EN_USO: {
    titulo: 'Esa billetera recibe cobros',
    detalle: (d) => {
      const billetera = d['billetera'] == null ? 'Esa billetera' : `«${d['billetera']}»`;
      if (d['uso'] === 'mercado_pago') {
        return (
          `${billetera} es donde entran los cobros de Mercado Pago. Elegí otra en Configuración › ` +
          'Tienda y después dala de baja.'
        );
      }
      const cual =
        d['uso'] === 'transferencia'
          ? 'las transferencias que cobra el chofer'
          : 'los cobros de Mercado Pago o las transferencias';
      return `${billetera} es donde entran ${cual}. Elegí otra en Configuración › Empresa y después dala de baja.`;
    },
    accion: { texto: 'Ir a Empresa', ruta: '/home/configuracion/empresa' },
  },
  // El chofer mandó un monto que no es el que el backend va a asentar: su
  // pantalla quedó vieja (cambió la seña, el presupuesto o una visita). La
  // pantalla de la ruta se recarga sola; el aviso dice el monto de ahora.
  // Con `a_cobrar: 0` es el caso "nada que cobrar y algo declarado".
  COBRO_NO_COINCIDE: {
    titulo: 'Cambió lo que hay que cobrar',
    detalle: (d) => {
      const aCobrar = Number(d['a_cobrar']);
      if (d['a_cobrar'] == null || !Number.isFinite(aCobrar)) {
        return (
          'Lo cobrado no es lo que se asienta. Cobrá el monto que figura ahora en la parada; ' +
          'si el cliente no paga eso, no dejes el equipo: marcá "No se pudo".'
        );
      }
      if (aCobrar <= 0) return 'Esta entrega no tiene nada que cobrar: no le cobres al cliente.';
      const visitas = Number(d['costo_visitas']);
      const deVisitas =
        Number.isFinite(visitas) && visitas > 0 ? ` (incluye $${pesos(visitas)} de visitas)` : '';
      return `Esta entrega cobra $${pesos(aCobrar)}${deVisitas}. Si el cliente no paga eso, no dejes el equipo: marcá "No se pudo".`;
    },
  },
  PARADAS_SIN_MARCAR: {
    titulo: 'Quedan paradas sin marcar',
    detalle: (d) => {
      const n = Number(d['sin_marcar']);
      if (d['sin_marcar'] == null || !Number.isFinite(n)) {
        return 'Cerrá cada parada —entregada, retirada o fallida— antes de cerrar la ruta.';
      }
      const cuantas = n === 1 ? 'Queda 1 parada sin marcar' : `Quedan ${n} paradas sin marcar`;
      return `${cuantas}. Cerrá cada una —entregada, retirada o fallida— antes de cerrar la ruta.`;
    },
  },
  // ─── Pañol y compras (spec C §5.4) ──────────────────────────────────────
  // Sin `accion`: la salida de los cuatro está en la pantalla donde ya está
  // parado el operario (la ficha del repuesto o el formulario), no en otra.
  STOCK_NO_EDITABLE: {
    titulo: 'El stock no se edita a mano',
    detalle:
      'El stock se corrige con un asiento, no editando el repuesto. Abrí la ficha del ' +
      'repuesto y usá "Ajustar stock": ahí queda registrado el motivo.',
  },
  MOTIVO_REQUERIDO: {
    titulo: 'Falta el motivo',
    detalle:
      'Escribí por qué se ajusta. Sin motivo, el movimiento queda en el kardex sin ' +
      'explicación y dentro de un mes nadie sabe de dónde salió la diferencia.',
  },
  REPUESTO_EN_USO: {
    titulo: 'Ese repuesto todavía se usa',
    // El backend manda `stock` y `ordenes` como datos extra: sin eso el aviso
    // dice "no se puede" y no dice qué destrabar.
    detalle: (d) => {
      const partes: string[] = [];
      const stock = Number(d['stock']);
      if (Number.isFinite(stock) && stock > 0) partes.push(`tiene ${stock} en stock`);
      const ordenes = d['ordenes'];
      if (Array.isArray(ordenes) && ordenes.length) {
        partes.push(`lo esperan ${ordenes.map((o: any) => o?.numero_orden).join(', ')}`);
      }
      const cola = 'Ajustá el stock o resolvé esas órdenes, y después archivalo.';
      return partes.length ? `No se puede archivar: ${partes.join(' y ')}. ${cola}` : `No se puede archivar mientras tenga stock o haya órdenes esperándolo. ${cola}`;
    },
  },
  REPUESTO_DUPLICADO: {
    titulo: 'Ya hay un repuesto con ese nombre',
    detalle: (d) =>
      d['nombre'] == null
        ? 'Ya hay un repuesto activo con ese nombre. Cambiale el nombre, o buscá el que ya ' +
          'existe en vez de crear uno nuevo.'
        : `Ya hay un repuesto activo llamado "${d['nombre']}". Cambiale el nombre, o buscá el ` +
          'que ya existe en vez de crear uno nuevo.',
  },
  // ─── Identificación y catálogo (spec C5 §5.4) ───────────────────────────
  // Los dos primeros viajan con 409 y no con 400: no es un dato mal cargado,
  // es un dato que ya está en otro lado. Por eso son los únicos dos del pañol
  // que sí ofrecen `accion`: la salida está en OTRA pantalla, la del repuesto
  // que ya lo tiene.
  CODIGO_EN_USO: {
    titulo: 'Ese código ya está usado',
    detalle: (d) => {
      const codigo = d['codigo'] == null ? 'Ese código' : `El código "${d['codigo']}"`;
      const duenio = d['repuesto_nombre'] == null ? 'otro repuesto' : `"${d['repuesto_nombre']}"`;
      return (
        `${codigo} ya lo tiene ${duenio}. Un código identifica a una sola pieza: si son ` +
        'la misma, cargalo como código alternativo de ese repuesto o fusionalos.'
      );
    },
    // La ruta se arma abajo, en `interpretarError`, porque depende del id que
    // viene en el cuerpo.
  },
  SINONIMO_EN_USO: {
    titulo: 'Ese término ya está en otro grupo',
    detalle: (d) =>
      d['termino'] == null
        ? 'Ese término ya pertenece a otro grupo de sinónimos. Un término está en un solo ' +
          'grupo: sacalo de donde está antes de agregarlo acá.'
        : `El término "${d['termino']}" ya pertenece a otro grupo de sinónimos. Un término ` +
          'está en un solo grupo: sacalo de donde está antes de agregarlo acá.',
  },
  FUSION_INVALIDA: {
    titulo: 'No se pueden fusionar esos dos',
    // El backend manda el motivo concreto (el mismo id, uno inexistente, uno
    // ya fusionado): repetirlo acá en genérico sería tapar lo único útil.
    detalle: (d) =>
      String(d['message'] ?? 'Elegí dos repuestos distintos, los dos activos y sin fusionar.'),
  },
  REPUESTO_FUSIONADO: {
    titulo: 'Ese repuesto se fusionó en otro',
    detalle: (d) =>
      d['ganador_nombre'] == null
        ? 'Ese repuesto se unió a otro y ya no se puede editar por su cuenta. Todo lo suyo ' +
          '—stock, códigos e historial— quedó en el que se conservó.'
        : `Ese repuesto se unió a "${d['ganador_nombre']}" y ya no se puede editar por su ` +
          'cuenta. Todo lo suyo —stock, códigos e historial— quedó allá.',
  },
  // ─── Reserva y precio en el ciclo de la orden (spec C §7, C3) ───────────
  REPUESTO_YA_INGRESADO: {
    titulo: 'Ese repuesto ya está en el taller',
    // Sin `accion`: la salida es devolver la pieza al pañol, y eso todavía no
    // tiene pantalla propia (es el circuito de sobrantes, plan C9). Mandar al
    // operador a una ruta inventada sería peor que no ofrecer botón.
    detalle: (d) => {
      const cola =
        'Si de verdad no va, primero hay que devolverlo al pañol; después se puede sacar de la orden.';
      const repuestos = d['repuestos'];
      if (!Array.isArray(repuestos) || !repuestos.length) {
        return `No se puede sacar de la orden un repuesto que ya está en el pañol o que ya se usó. ${cola}`;
      }
      const detalles = repuestos
        .map((r: any) => `"${r?.nombre}" (${r?.motivo === 'consumido' ? 'ya se usó en la reparación' : 'ya llegó al pañol'})`)
        .join('; ');
      return `No se puede sacar de la orden: ${detalles}. ${cola}`;
    },
  },
  STOCK_INSUFICIENTE: {
    titulo: 'No hay stock suficiente',
    detalle: (d) => {
      const cola =
        'Si el estante dice otra cosa, ajustá el stock con su motivo desde la ficha del repuesto y volvé a intentar.';
      if (d['nombre'] == null || d['stock'] == null || d['cantidad'] == null) {
        return `No hay stock suficiente para ese movimiento. ${cola}`;
      }
      return `De "${d['nombre']}" hay ${d['stock']} y se quieren sacar ${d['cantidad']}. ${cola}`;
    },
    // La ruta se arma abajo, en `interpretarError`: depende del `sku_id`.
  },
  // ─── Venta de mostrador (spec 2026-10-02 §8): el backend ya trae el texto. ──
  VENTA_SIN_RENGLONES: { titulo: 'La venta no tiene renglones', detalle: (d) => String(d['message'] ?? 'Agregá un repuesto o un renglón libre.') },
  VENTA_SIN_COBRO: { titulo: 'Falta el cobro', detalle: (d) => String(d['message'] ?? 'El mostrador no vende a cuenta: cargá al menos un cobro.') },
  DESCUENTO_EXCEDIDO: { titulo: 'El descuento pasa el tope', detalle: (d) => String(d['message'] ?? 'Pedile a un encargado que cargue el precio.') },
  COBRO_EXCEDE_SALDO: { titulo: 'Lo cobrado pasa el saldo', detalle: (d) => String(d['message'] ?? 'Revisá los montos.') },
  DEVOLUCION_EXCEDE: { titulo: 'La devolución pasa lo que se puede devolver', detalle: (d) => String(d['message'] ?? 'Revisá cantidades y monto.') },
  // Segunda vida (09/11/2026): equipos usados del taller.
  ALTA_SEGUNDA_VIDA_INVALIDA: { titulo: 'Revisá el equipo', detalle: (d) => String(d['message'] ?? 'Faltan datos del equipo.') },
  ORDEN_NO_CEDIBLE: { titulo: 'Esa orden no se puede ceder', detalle: (d) => String(d['message'] ?? 'Sólo un equipo listo o rechazado y sin retirar.') },
  ORDEN_YA_CEDIDA: { titulo: 'Ya se registró la cesión', detalle: (d) => String(d['message'] ?? 'El equipo ya está en Segunda vida.') },
  SEGUNDA_VIDA_CERRADO: { titulo: 'El equipo ya no está en el taller', detalle: (d) => String(d['message'] ?? 'Está a la venta, desguazado o descartado.') },
  // Herramientas e instrumental (11/11/2026).
  HERRAMIENTA_NO_DISPONIBLE: { titulo: 'La herramienta no está para eso', detalle: (d) => String(d['message'] ?? 'Está prestada, en service o de baja.') },
  HERRAMIENTA_VENCIDA: { titulo: 'El control está vencido', detalle: (d) => String(d['message'] ?? 'Registrá el service o la calibración antes de prestarla.') },
  TECNICO_INVALIDO: { titulo: 'Sólo a técnicos', detalle: (d) => String(d['message'] ?? 'Las herramientas se prestan sólo a técnicos activos.') },
  // Agencia: unidades y operaciones (12/11/2026).
  ALTA_UNIDAD_INVALIDA: { titulo: 'Revisá los datos de la unidad', detalle: (d) => String(d['message'] ?? 'Faltan datos o no cierran entre sí.') },
  DOMINIO_EN_STOCK: { titulo: 'Ese dominio ya está en stock', detalle: (d) => String(d['message'] ?? 'Hay otra unidad cargada con esa patente.') },
  UNIDAD_CERRADA: { titulo: 'La unidad ya salió del stock', detalle: (d) => String(d['message'] ?? 'Vendida, devuelta o de baja: no se cambia.') },
  UNIDAD_RESERVADA: { titulo: 'La unidad está reservada', detalle: (d) => String(d['message'] ?? 'El precio acordado está en la operación.') },
  ESTADO_UNIDAD_INVALIDO: { titulo: 'No puede pasar a ese estado', detalle: (d) => String(d['message'] ?? 'Revisá en qué estado está la unidad.') },
  UNIDAD_NO_PUBLICABLE: { titulo: 'Todavía no se puede publicar', detalle: (d) => String(d['message'] ?? 'Tiene que estar disponible y con precio.') },
  UNIDAD_NO_RESERVABLE: { titulo: 'No se puede reservar', detalle: (d) => String(d['message'] ?? 'Ya está reservada o no tiene precio.') },
  IMPORTE_INVALIDO: { titulo: 'Revisá el monto', detalle: (d) => String(d['message'] ?? 'Si está en otra moneda, hace falta el tipo de cambio.') },
  OPERACION_CERRADA: { titulo: 'La operación ya está cerrada', detalle: (d) => String(d['message'] ?? 'Vendida o anulada: no admite cambios.') },
  PAGO_INVALIDO: { titulo: 'Ese pago no entra', detalle: (d) => String(d['message'] ?? 'Revisá el monto, la moneda y la caja.') },
  SALDO_PENDIENTE: { titulo: 'Falta cobrar', detalle: (d) => String(d['message'] ?? 'La venta no se cierra con saldo pendiente.') },
  PAPELES_BLOQUEANTES: { titulo: 'Faltan papeles', detalle: (d) => String(d['message'] ?? 'Hay papeles que frenan la transferencia.') },
  TOMA_NO_REVERSIBLE: { titulo: 'El usado que se tomó ya no está', detalle: (d) => String(d['message'] ?? 'Ya se reservó o se vendió: no se puede devolver al cliente.') },
  // Equipos vendidos (09/11/2026): el número de serie de cada unidad.
  VENTA_SIN_ENTREGAR: { titulo: 'La venta todavía no salió', detalle: (d) => String(d['message'] ?? 'Los números de serie se anotan al entregar o despachar.') },
  SERIE_VACIA: { titulo: 'Falta un número de serie', detalle: (d) => String(d['message'] ?? 'Completalo o dejá la caja vacía.') },
  UNIDAD_DE_OTRA_VENTA: { titulo: 'La unidad no es de esta venta', detalle: (d) => String(d['message'] ?? 'Recargá la venta y probá de nuevo.') },
  UNIDADES_DE_MAS: { titulo: 'Hay más unidades que las vendidas', detalle: (d) => String(d['message'] ?? 'Revisá las cantidades.') },
  SERIE_REPETIDA: { titulo: 'Número de serie repetido', detalle: (d) => String(d['message'] ?? 'Cada unidad tiene el suyo.') },
  SERIE_YA_VENDIDA: { titulo: 'Ese número de serie ya se vendió', detalle: (d) => String(d['message'] ?? 'Figura en otra venta del taller.') },
  DEVOLUCION_SIN_BILLETERA: { titulo: 'Falta la billetera del reintegro', detalle: (d) => String(d['message'] ?? 'Elegí de qué billetera sale el reintegro.') },
  // ─── Códigos nuevos del backend (tanda 1 de arreglos, 13/10/2026) ─────────
  MOVIMIENTO_YA_REVERTIDO: {
    titulo: 'Ese movimiento ya estaba revertido',
    detalle: 'Otra persona lo anuló recién: no se volvió a mover plata. Actualizá la pantalla.',
  },
  PARADA_YA_MARCADA: {
    titulo: 'Esa parada ya no se puede sacar',
    // El backend dice por qué (marcada, cobrada, turno cerrado o ruta cerrada).
    detalle: (d) => String(d['message'] || 'Ya se marcó, se cobró o su turno se cerró.'),
  },
  TURNO_NO_VIGENTE: {
    titulo: 'Ese turno ya no está vigente',
    detalle: (d) => String(d['message'] || 'Ya se cumplió, falló o se canceló. Recargá la Agenda.'),
  },
  // CLI-03 (tanda 2 del backend): el alta muestra los candidatos en la misma pantalla.
  CLIENTE_POSIBLE_DUPLICADO: {
    titulo: 'Puede que ese cliente ya exista',
    detalle: 'Fijate en los parecidos que aparecen en el alta: si es otro, crealo igual.',
  },
  PUBLICACION_INCOMPLETA: {
    titulo: 'Falta completar la publicación',
    detalle: (d) => String(d['message'] || 'Al repuesto le falta algo para estar en la tienda.'),
  },
  PAGO_YA_RESUELTO: { titulo: 'Ese pago ya se resolvió', detalle: (d) => String(d['message'] ?? 'Actualizá la lista.') },
  DATOS_INVALIDOS: {
    titulo: 'Faltan datos o hay algo mal cargado',
    detalle: (d) => String(d['message'] ?? 'Revisá los datos cargados.'),
  },
  NO_ENCONTRADO: {
    titulo: 'No se encontró',
    detalle: (d) => String(d['message'] ?? 'Puede que otra persona lo haya borrado.'),
  },
  // Sin acción a propósito (CLI-04): ante un 401 el `errorInterceptor` ya
  // limpia la sesión del navegador y lleva al login. Antes el toast ofrecía
  // «Volver a entrar», pero el `unauthGuard` veía la sesión todavía marcada
  // como abierta y lo rebotaba a /home: un bucle del que sólo se salía con F5.
  SESION_VENCIDA: {
    titulo: 'Tu sesión venció',
    detalle: 'Entrá de nuevo con tu usuario y contraseña para seguir trabajando.',
  },
  USUARIO_DADO_DE_BAJA: {
    titulo: 'Tu usuario está dado de baja',
    detalle: 'Hablá con el encargado.',
  },
  CUENTA_SIN_CONFIRMAR: {
    titulo: 'Todavía no confirmaste tu correo',
    detalle: 'Revisá tu casilla, o pedí que te lo mandemos de nuevo.',
  },
  RECUPERACION_INVALIDA: {
    titulo: 'El link no es válido o venció',
    detalle: 'Pedí otro desde «Me olvidé la clave».',
  },
  CORREO_YA_REGISTRADO: {
    titulo: 'Ya hay una cuenta con ese correo',
    detalle: 'Probá entrar, o pedí recuperar la clave.',
  },
  TALLER_YA_EXISTE: {
    titulo: 'Ya hay un taller con ese nombre',
    detalle: 'Agregale la ciudad o el barrio.',
  },
  CREDENCIALES_INVALIDAS: {
    titulo: 'Usuario o contraseña incorrectos',
    detalle: 'Revisá los datos y probá de nuevo.',
  },
  // SEG-54: cambio y reseteo de clave.
  CLAVE_ACTUAL_INCORRECTA: {
    titulo: 'La clave actual no es esa',
    detalle: 'Revisala y probá de nuevo. Después de 5 intentos en un minuto hay que esperar.',
  },
  CLAVE_REPETIDA: {
    titulo: 'La clave nueva es igual a la actual',
    detalle: 'Elegí una distinta.',
  },
  TALLER_SOLO_LECTURA: {
    titulo: 'El abono del taller venció',
    detalle: 'Se puede ver y exportar todo, pero no cargar nada nuevo hasta que quien administra el taller pague el abono.',
    accion: { texto: 'Ver el abono', ruta: '/home/configuracion/abono' },
  },
  TOPE_PLAN_GRATIS: {
    titulo: 'Llegaste al tope del plan gratis',
    detalle: (d) => `El plan gratis permite hasta ${d['tope'] ?? 'pocas'} unidades en stock. Quien administra la agencia puede pasarse al plan pago para seguir cargando.`,
    accion: { texto: 'Ver el abono', ruta: '/home/configuracion/abono' },
  },
  ABONO_NO_DISPONIBLE: {
    titulo: 'No se pudo iniciar el pago',
    detalle: 'Mercado Pago no está disponible en este momento. Probá de nuevo en unos minutos.',
  },
  DEBE_CAMBIAR_CLAVE: {
    titulo: 'Tenés que cambiar la clave',
    detalle: 'Entraste con una clave provisoria: elegí una nueva para seguir.',
    accion: { texto: 'Cambiar la clave', ruta: '/cambiar-clave' },
  },
  // Texto fijo a propósito: el `message` de un 403 nombra roles internos y sale
  // en inglés desde los guards. Lo único accionable es a quién pedírselo.
  SIN_PERMISO: {
    titulo: 'Tu puesto no puede hacer esto',
    detalle:
      'Esta acción la hace otro puesto. Si te corresponde, pedile al administrador que ' +
      'revise tu rol.',
  },
  // ─── Mercado Libre (M1) ──────────────────────────────────────────────────
  CORREO_NO_CONFIGURADO: {
    titulo: 'El correo del taller no está configurado',
    detalle: 'Faltan MAIL_HOST, MAIL_USER y MAIL_PASS en el servidor. Con Gmail va una contraseña de aplicación.',
  },
  CORREO_FALLIDO: {
    titulo: 'El servidor de correo rechazó el envío',
    detalle: (d) => String(d['detalle'] ?? d['message'] ?? 'Revisá la casilla y la contraseña de aplicación.') + ' El intento quedó registrado en la ficha del cliente.',
  },
  // ─── Correos con adjuntos (spec 2026-10-07 §7) ────────────────────────────
  ARCHIVO_NO_PDF: {
    titulo: 'Sólo se aceptan archivos PDF',
    detalle: 'Elegí un archivo .pdf (una factura, un informe del fabricante). Las fotos se suben desde la pestaña Fotos.',
  },
  ARCHIVO_DEMASIADO_GRANDE: {
    titulo: 'El archivo es demasiado grande',
    detalle: 'El archivo pasa el tamaño permitido (10 MB para PDF).',
  },
  DOCUMENTO_NO_DISPONIBLE: {
    titulo: 'Ese documento no corresponde al estado de la orden',
    detalle: (d) => `${DOCUMENTO_DE_LA_ORDEN[String(d['tipo'])] ?? 'El documento'} todavía no se puede generar para esta orden. Destildalo y probá de nuevo.`,
  },
  ADJUNTO_INVALIDO: {
    titulo: 'Uno de los adjuntos no es de esta orden',
    detalle: (d) =>
      d['nombre']
        ? `No se pudo bajar «${d['nombre']}» del almacén. Destildalo o volvé a subirlo.`
        : 'Cerrá el correo y volvé a abrirlo desde la orden.',
  },
  ADJUNTOS_EXCEDIDOS: {
    titulo: 'Los adjuntos pasan el límite',
    detalle: (d) =>
      d['motivo'] === 'cantidad'
        ? `Son ${d['total']} archivos y entran hasta ${d['tope']}. Sacá alguno.`
        : `Suman ${tamanoLegible(Number(d['total']))} y entran hasta ${tamanoLegible(Number(d['tope']))}. Sacá alguno.`,
  },

  // ─── Pericia técnica (Legales, 16/10/2026) ────────────────────────────────
  PERICIA_INCOMPLETA: {
    titulo: 'Faltan datos para finalizar la pericia',
    detalle: (d) => {
      const nombres: Record<string, string> = { objeto: 'el objeto', operaciones: 'las operaciones realizadas', causa: 'la causa', conclusion: 'la conclusión' };
      const faltan = Array.isArray(d['faltan']) ? (d['faltan'] as string[]).map((f) => nombres[f] ?? f) : [];
      return faltan.length ? `Completá ${faltan.join(', ')} y guardá antes de finalizar.` : 'Guardá la pericia y probá de nuevo.';
    },
  },
  PERICIA_NO_FINALIZADA: {
    titulo: 'La pericia todavía no está finalizada',
    detalle: 'Tocá «Finalizar pericia» y después descargá el PDF.',
  },
  FOTO_AJENA: {
    titulo: 'Una de las fotos no es de esta orden',
    detalle: 'Cerrá la pericia y volvé a abrirla desde la orden.',
  },

  // ─── Tienda: capa comercial (spec 2026-10-07 tienda §8) ───────────────────
  TRANSFERENCIA_INCOMPLETA: {
    titulo: 'Faltan datos para cobrar por transferencia',
    detalle: (d) => {
      const nombres: Record<string, string> = {
        cbu_o_alias: 'el CBU o el alias',
        titular: 'el titular',
        caja: 'la caja de transferencias (Configuración → Empresa)',
      };
      const faltan = (Array.isArray(d['faltan']) ? d['faltan'] : []).map((f: string) => nombres[f] ?? f);
      if (!faltan.length) return 'Cargá el CBU o el alias, el titular y la caja de transferencias, y volvé a guardar.';
      const lista = faltan.length === 1 ? faltan[0] : `${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}`;
      return `Cargá ${lista}, y volvé a guardar.`;
    },
  },
  ZONA_RANGO_INVALIDO: {
    titulo: 'Revisá los rangos de código postal',
    detalle: 'Cada rango va de 1000 a 9999 y de menor a mayor, separados por coma: 1000-1499, 1600-1899.',
  },
  // ─── Banners de la portada de la tienda (spec 2026-10-08 tienda-portada §4) ───
  BANNER_LINK_INVALIDO: {
    titulo: 'El link del banner no sirve',
    detalle: 'Tiene que ser una ruta del sitio, como /c/lavarropas, o una dirección que empiece con https://. Si no querés link, dejalo vacío.',
  },
  BANNER_IMAGEN_FORMATO: {
    titulo: 'Esa imagen no se puede usar',
    detalle: 'Elegí una imagen JPG, PNG o WebP que se pueda abrir.',
  },
  BANNER_IMAGEN_PESO: {
    titulo: 'La imagen pesa demasiado',
    detalle: (d) => `Cada imagen puede pesar hasta ${tamanoLegible(Number(d['tope']) || 5 * 1024 * 1024)}. Achicala o comprimila y probá de nuevo.`,
  },
  BANNER_MAXIMO: {
    titulo: 'Ya hay 8 banners',
    detalle: (d) => `La portada admite hasta ${Number(d['tope']) || 8}. Borrá uno para poder crear otro.`,
  },
  BANNER_PRODUCTO_INVALIDO: {
    titulo: 'Ese repuesto no se puede usar en el banner',
    detalle: 'El repuesto del banner tiene que estar publicado en la tienda. Publicalo o elegí otro.',
  },
  BANNER_VIDEO_SOLO_ARMADO: {
    titulo: 'Ese banner no lleva video',
    detalle: 'El video va en los banners armados. La imagen terminada se muestra sola: cambiá el tipo a «Armado» si querés sumarle uno.',
  },
  BANNER_TITULO_REQUERIDO: {
    titulo: 'Falta el título del banner',
    detalle: 'Un banner armado necesita título: es lo que escribe la tienda. Si tu imagen ya trae el texto, elegí «Imagen terminada».',
  },
  ML_NO_CONECTADO: {
    titulo: 'Mercado Libre no está conectado',
    detalle: 'Conectá la cuenta del taller para mapear categorías y ver el catálogo.',
    accion: { texto: 'Conectar', ruta: '/home/configuracion/mercado-libre' },
  },
  ML_REAUTORIZAR: {
    titulo: 'La conexión con Mercado Libre se cayó',
    detalle: (d) => String(d['message'] ?? 'Mercado Libre rechazó la renovación del acceso.') + ' Hay que volver a autorizar la cuenta.',
    accion: { texto: 'Volver a conectar', ruta: '/home/configuracion/mercado-libre' },
  },
  ML_NO_DISPONIBLE: {
    titulo: 'Mercado Libre no responde',
    detalle: (d) => String(d['message'] ?? 'Reintentá en unos minutos. No se cambió ningún dato.'),
  },
  ML_CATEGORIA_INVALIDA: {
    titulo: 'Esa categoría de Mercado Libre no sirve',
    detalle: 'Tiene que ser una categoría final (sin subcategorías) que permita publicar. Elegí otra.',
  },
  // ─── Mercado Libre (M2) ──────────────────────────────────────────────────
  ML_NO_LISTO: {
    titulo: 'Todavía no se puede publicar en Mercado Libre',
    detalle: (d) => Array.isArray(d['motivos']) && (d['motivos'] as string[]).length ? `Le falta: ${(d['motivos'] as string[]).join('; ')}.` : String(d['message'] ?? 'Al repuesto le falta algo.'),
  },
  ML_YA_PUBLICADA: { titulo: 'Ya está publicado', detalle: 'Este repuesto ya tiene una publicación viva en Mercado Libre. Miralo en su ficha.' },
  ML_PUBLICACION_CERRADA: { titulo: 'Esa publicación está cerrada', detalle: 'En Mercado Libre una publicación cerrada no se reabre. Publicá de nuevo desde la ficha.' },
  ML_RECHAZO: { titulo: 'Mercado Libre rechazó la publicación', detalle: (d) => String(d['message'] ?? 'Revisá el motivo en la ficha del repuesto y reintentá.') },
  // Genérico de los rechazos de negocio (400) que todavía no tienen código
  // propio: el mensaje del backend es lo único que explica qué pasó.
  SOLICITUD_RECHAZADA: {
    titulo: 'No se pudo completar la solicitud',
    detalle: (d) => String(d['message'] ?? 'Revisá los datos e intentá de nuevo.'),
  },
  // Genérico de los 409 (conflicto de estado o de datos) sin código propio.
  CONFLICTO: {
    titulo: 'Hay un conflicto con el estado actual',
    detalle: (d) => String(d['message'] ?? 'Actualizá la pantalla y probá de nuevo.'),
  },
  ERROR_INTERNO: {
    titulo: 'Hubo un problema del sistema',
    detalle: 'Probá de nuevo. Si sigue pasando, avisale al encargado.',
  },
  PLANTILLA_DEL_SISTEMA: {
    titulo: 'Ese mensaje lo manda el sistema',
    detalle:
      'Los mensajes del sistema no se borran ni cambian de situación, porque los avisos ' +
      'automáticos los buscan por su clave. Podés cambiarles el nombre y el texto, y si no ' +
      'querés que aparezcan en el selector, desactivalos.',
  },
  PLANTILLA_NO_ENCONTRADA: {
    titulo: 'Ese mensaje ya no existe',
    detalle: 'Alguien lo borró desde otra pantalla. Recargá la lista de mensajes.',
  },
};

/** Un cuerpo JSON parseado, y no un string de HTML ni un Blob ni un ArrayBuffer. */
function esObjetoPlano(valor: unknown): boolean {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return false;
  const prototipo = Object.getPrototypeOf(valor);
  return prototipo === Object.prototype || prototipo === null;
}

/** Resuelve una entrada del catálogo sin datos extra, para los casos ciegos. */
function textoDe(codigo: string): MensajeOperativo {
  const t = TRADUCCIONES[codigo];
  return {
    titulo: t.titulo,
    detalle: typeof t.detalle === 'function' ? t.detalle({}) : t.detalle,
    accion: t.accion,
  };
}

export function interpretarError(err: unknown): MensajeOperativo {
  const e = (err ?? {}) as { status?: number; error?: any; message?: string };

  if (e.status === 0) {
    return {
      titulo: 'No hay conexión con el servidor',
      detalle: 'Fijate si la computadora tiene internet y probá de nuevo.',
    };
  }

  // Cuerpo que no es JSON: el HTML de un 502 de proxy, o un Blob cuando el
  // pedido salió con `responseType: 'blob'`. Ahí no hay `code` ni `message` que
  // leer, y el default terminaba mostrando el "Http failure response for..." de
  // Angular, que no le dice nada a nadie.
  if (e.error != null && !esObjetoPlano(e.error)) return textoDe('ERROR_INTERNO');

  const cuerpo: Record<string, any> = (e.error ?? {}) as Record<string, any>;
  const codigo: string | undefined = cuerpo['code'];
  const mensajeBackend = String(cuerpo['message'] ?? e.message ?? '');

  // Un 5xx sin código es una falla del servidor, no algo que el operario haya
  // cargado mal: nunca su mensaje crudo, que puede traer detalle de la base.
  if (!codigo && Number(e.status ?? 0) >= 500) return textoDe('ERROR_INTERNO');

  const traduccion = codigo ? TRADUCCIONES[codigo] : undefined;

  if (!traduccion) {
    // Default honesto: nunca un texto técnico solo, siempre con qué hacer y
    // con el código, que es lo que le sirve al encargado para preguntar.
    const cola = codigo ? ` (código: ${codigo})` : '';
    return {
      titulo: 'No se pudo completar',
      detalle: `${mensajeBackend || 'Probá de nuevo.'}${cola}`,
    };
  }

  // Dos códigos de C5 tienen salida en OTRA pantalla, y cuál es depende del
  // id que viene en el cuerpo: la tabla estática no puede declararla.
  //
  // `textoDe` no sirve acá porque arma el detalle con un cuerpo vacío ({}):
  // estos dos casos necesitan el `codigo`/`repuesto_nombre`/`ganador_nombre`
  // real que vino en la respuesta, así que se arma el texto igual que el
  // `return` final, y se le pisa la `accion`.
  if (codigo === 'CODIGO_EN_USO' && cuerpo['repuesto_id']) {
    return {
      titulo: traduccion.titulo,
      detalle:
        typeof traduccion.detalle === 'function'
          ? traduccion.detalle({ ...cuerpo, message: mensajeBackend })
          : traduccion.detalle,
      accion: { texto: 'Ver ese repuesto', ruta: `/home/inventario/${cuerpo['repuesto_id']}` },
    };
  }
  if (codigo === 'REPUESTO_FUSIONADO' && cuerpo['ganador_id']) {
    return {
      titulo: traduccion.titulo,
      detalle:
        typeof traduccion.detalle === 'function'
          ? traduccion.detalle({ ...cuerpo, message: mensajeBackend })
          : traduccion.detalle,
      accion: {
        texto: 'Ir al repuesto que quedó',
        ruta: `/home/inventario/${cuerpo['ganador_id']}`,
      },
    };
  }
  if (codigo === 'BILLETERA_EN_USO' && cuerpo['uso'] === 'mercado_pago') {
    return {
      titulo: traduccion.titulo,
      detalle:
        typeof traduccion.detalle === 'function'
          ? traduccion.detalle({ ...cuerpo, message: mensajeBackend })
          : traduccion.detalle,
      accion: { texto: 'Ir a Tienda', ruta: '/home/configuracion/tienda' },
    };
  }
  if (codigo === 'STOCK_INSUFICIENTE' && cuerpo['sku_id']) {
    return {
      titulo: traduccion.titulo,
      detalle:
        typeof traduccion.detalle === 'function'
          ? traduccion.detalle({ ...cuerpo, message: mensajeBackend })
          : traduccion.detalle,
      accion: { texto: 'Ver ese repuesto', ruta: `/home/inventario/${cuerpo['sku_id']}` },
    };
  }

  return {
    titulo: traduccion.titulo,
    detalle:
      typeof traduccion.detalle === 'function'
        ? traduccion.detalle({ ...cuerpo, message: mensajeBackend })
        : traduccion.detalle,
    accion: traduccion.accion,
  };
}
