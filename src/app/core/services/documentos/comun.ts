/**
 * Lo que comparten los documentos de la orden: los parámetros del taller con
 * sus «si está vacío» (contrato opción B §1), el armado del cliente y del
 * equipo, las fechas reales (hitos) y los números propios de cada papel.
 *
 * Se define acá y no se importa de `features/home/ordenes` para que
 * `core/services` no dependa de un componente de pantalla.
 */
import { aFecha, esc, MembreteEmpresa, pesos, razonSocial } from './plantilla.util';

export interface EmpresaDoc extends MembreteEmpresa {
  garantia_dias?: number | null;
  sena_porcentaje?: number | null;
  dias_abandono?: number | null;
  costo_revision?: number | string | null;
  revision_se_descuenta?: boolean | null;
  plazo_presupuesto_dias?: number | null;
  plazo_reparacion_dias?: number | null;
  canon_guarda_diario?: number | string | null;
  revision_garantia_dias?: number | null;
  factura_momento?: string | null;
  traslado_garantia?: string | null;
}

/**
 * Lo que el armado recibe además de la orden y la empresa: el QR del
 * seguimiento ya generado (SVG), su dirección y la fecha de referencia.
 */
export interface ExtrasDoc {
  /** SVG del QR a `${portal}/o/${portal_token}`. Sin QR, el papel sale sin él. */
  qr?: string | null;
  /** La dirección del QR, para escribirla al lado. */
  url?: string | null;
  /** «Hoy» del mostrador (los tests la fijan). */
  hoy?: Date;
  /** Sitio del taller (botón de arrepentimiento de la tienda). */
  sitio?: string | null;
}

/**
 * Los parámetros del taller como los usan los textos, con los defaults de la
 * migración cuando la API todavía no los manda. Los textos (razón social,
 * domicilio, correo…) vienen YA ESCAPADOS: sólo se usan dentro de HTML.
 */
export interface ConfigDoc {
  razon: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  /** Vacío = los textos dicen «en el local». */
  email: string;
  horario: string;
  garantiaDias: number;
  diasAbandono: number;
  senaPct: number;
  costoRevision: number;
  revisionDescuenta: boolean;
  plazoPresupuesto: number;
  plazoReparacion: number;
  canon: number;
  revisionGarantia: number;
  facturaMomento: 'al_cobrar' | 'al_senar';
  /** Vacío = el texto por defecto del certificado. */
  traslado: string;
}

const entero = (v: unknown, def: number): number => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? def : n;
};

export function configDoc(e: EmpresaDoc | null | undefined): ConfigDoc {
  return {
    razon: esc(razonSocial(e)),
    cuit: esc(e?.cuit ?? ''),
    domicilio: esc(e?.direccion ?? ''),
    telefono: esc(e?.telefono ?? ''),
    email: esc((e?.email_contacto ?? '').trim()),
    horario: esc((e?.horario_atencion ?? '').trim()),
    garantiaDias: entero(e?.garantia_dias, 90),
    diasAbandono: entero(e?.dias_abandono, 30),
    senaPct: entero(e?.sena_porcentaje, 0),
    costoRevision: entero(e?.costo_revision, 0),
    revisionDescuenta: e?.revision_se_descuenta ?? true,
    plazoPresupuesto: entero(e?.plazo_presupuesto_dias, 2),
    plazoReparacion: entero(e?.plazo_reparacion_dias, 10),
    canon: entero(e?.canon_guarda_diario, 0),
    revisionGarantia: entero(e?.revision_garantia_dias, 5),
    facturaMomento: e?.factura_momento === 'al_senar' ? 'al_senar' : 'al_cobrar',
    traslado: esc((e?.traslado_garantia ?? '').trim()),
  };
}

/** «1 día hábil», «10 días hábiles». */
export function dias(n: number, habiles = false): string {
  return `${n} ${n === 1 ? 'día' : 'días'}${habiles ? (n === 1 ? ' hábil' : ' hábiles') : ''}`;
}

export function nombreCliente(c: any): string {
  const n = `${c?.nombre ?? ''} ${c?.apellido ?? ''}`.trim();
  return c?.tipo === 'b2b' ? `${n} (empresa)` : n;
}

export function direccionCliente(c: any): string {
  const calle = c?.direccion ?? c?.direccion_principal;
  return [calle && c?.piso_depto ? `${calle} (${c.piso_depto})` : calle ?? c?.piso_depto, c?.ciudad].filter(Boolean).join(', ');
}

/** «Heladera LG»: rubro (o tipo) y marca. El modelo va aparte. */
export function tipoEquipo(eq: any): string {
  return [eq?.rubro?.nombre ?? eq?.tipo, eq?.marca].filter(Boolean).join(' ');
}

export function nombreEquipo(eq: any): string {
  return [eq?.rubro?.nombre ?? eq?.tipo, eq?.marca, eq?.modelo].filter(Boolean).join(' ');
}

export function nombreTecnico(o: any): string {
  return o?.tecnico?.nombre ?? o?.tecnico?.name ?? '';
}

/** Tarjetas de cliente y equipo: los pares que lleva cada papel. */
export function paresCliente(c: any): [string, string][] {
  return [
    ['Nombre', nombreCliente(c)],
    ['DNI / CUIT', c?.documento ?? ''],
    ['Teléfono', c?.telefono ?? ''],
    ['Correo', c?.email ?? ''],
    ['Domicilio', direccionCliente(c)],
  ];
}

export function paresEquipo(eq: any): [string, string][] {
  return [
    ['Equipo', tipoEquipo(eq)],
    ['Modelo', eq?.modelo ?? ''],
    ['N° de serie', eq?.numero_serie ?? ''],
  ];
}

/** Lo que se devuelve sin reparar: presupuesto rechazado, o entregada con motivo. */
export function seDevuelveSinReparar(o: any): boolean {
  return o?.estado === 'rechazada' || (o?.estado === 'entregada' && !!o?.motivo_rechazo);
}

/** Costo de las visitas a domicilio de la orden (T6): sobrevive al rechazo. */
export function costoVisitas(o: any): number {
  return (o?.visitas ?? []).reduce((s: number, v: any) => s + Number(v?.costo ?? 0), 0);
}

/** Descripción de un repuesto: nombre · N/P. */
export function detalleRepuesto(r: any): string {
  const sku = r?.sku ?? {};
  return [sku.name, sku.numero_parte ? `N/P ${sku.numero_parte}` : null].filter(Boolean).join(' · ');
}

/**
 * Nuevo o usado (contrato §2): `ml_condicion` del repuesto, que la orden ya
 * trae en `repuestos[].sku`. No hay «reconstituido» en el modelo. Sin dato,
 * null: el papel no inventa la condición.
 */
export function condicionRepuesto(r: any): 'nuevo' | 'usado' | null {
  const c = r?.sku?.ml_condicion ?? r?.ml_condicion ?? null;
  return c === 'usado' || c === 'nuevo' ? c : null;
}

/** La fecha del último paso de la orden a ese estado (hitos del backend). */
export function fechaHito(o: any, estado: string): Date | null {
  const hitos: any[] = Array.isArray(o?.hitos) ? o.hitos : [];
  for (let i = hitos.length - 1; i >= 0; i--) {
    if (hitos[i]?.a === estado) return aFecha(hitos[i].fecha);
  }
  return null;
}

/** Quién hizo ese paso (el empleado del hito). */
export function empleadoHito(o: any, estado: string): string {
  const hitos: any[] = Array.isArray(o?.hitos) ? o.hitos : [];
  for (let i = hitos.length - 1; i >= 0; i--) {
    if (hitos[i]?.a === estado) return String(hitos[i].empleado ?? '');
  }
  return '';
}

/** Ingreso al taller: el hito de recepción o, si no está, el alta de la orden. */
export function fechaIngreso(o: any): Date | null {
  return fechaHito(o, 'recibida') ?? aFecha(o?.created_at);
}

/**
 * La fecha real de la entrega (relevamiento A.2 #3): el hito «entregada».
 * Nunca `updated_at`, que se corre si la orden se toca después (la encuesta).
 * Sin hito (se imprime en el mostrador al entregar), es hoy.
 */
export function fechaEntrega(o: any, hoy: Date): Date {
  return fechaHito(o, 'entregada') ?? hoy;
}

/** Número propio de cada papel: OR-2026-9050 → PR-2026-9050, AE-2026-9050… */
export function numeroDoc(o: any, prefijo: string): string {
  const n = String(o?.numero_orden ?? '');
  return /^OR-/.test(n) ? n.replace(/^OR-/, `${prefijo}-`) : n ? `${prefijo}-${n}` : prefijo;
}

/**
 * El presupuesto tiene número, versión y fechas propias (relevamiento A.2
 * #2): la versión es cuántas veces se emitió (hitos a «presupuestada»), la
 * emisión es la del último, el vencimiento `presupuesto_vigente_hasta`.
 */
export function datosPresupuesto(o: any): { numero: string; version: number; emision: Date | null; vence: Date | null; vigencia: number | null } {
  const hitos: any[] = Array.isArray(o?.hitos) ? o.hitos : [];
  const version = hitos.filter((h) => h?.a === 'presupuestada').length;
  const emision = fechaHito(o, 'presupuestada') ?? (o?.estado === 'presupuestada' ? aFecha(o?.estado_desde) : null);
  const vence = aFecha(o?.presupuesto_vigente_hasta);
  const vigencia = emision && vence ? Math.max(0, Math.round((vence.getTime() - emision.getTime()) / 86400000)) : null;
  const base = numeroDoc(o, 'PR');
  return { numero: version > 0 ? `${base}/${version}` : base, version, emision, vence, vigencia };
}

const MEDIO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercadopago: 'Mercado Pago',
  mercado_pago: 'Mercado Pago',
  mp: 'Mercado Pago',
  tarjeta: 'Tarjeta',
  debito: 'Tarjeta de débito',
  credito: 'Tarjeta de crédito',
  cuenta_corriente: 'Cuenta corriente',
};

/** Los cobros reales de la orden (ingresos): total y medios, sin repetir. */
export function cobrosDeLaOrden(o: any): { total: number; medios: string[] } {
  const ingresos = (Array.isArray(o?.cobros) ? o.cobros : []).filter((c: any) => (c?.signo ?? 'ingreso') === 'ingreso');
  const medios: string[] = [];
  for (const c of ingresos) {
    const m = c?.metodo_pago ? MEDIO[c.metodo_pago] ?? String(c.metodo_pago).replace(/_/g, ' ') : '';
    const etiqueta = m ? m.charAt(0).toUpperCase() + m.slice(1) : '';
    if (etiqueta && !medios.includes(etiqueta)) medios.push(etiqueta);
  }
  return { total: ingresos.reduce((s: number, c: any) => s + (Number(c?.monto) || 0), 0), medios };
}

/** La dirección del QR sin el protocolo, para escribirla en el papel. */
export function urlCorta(url: string | null | undefined): string {
  return String(url ?? '').replace(/^https?:\/\//, '');
}

/** Monto escapado (los textos legales llevan HTML). */
export function $(n: number): string {
  return esc(pesos(n));
}
