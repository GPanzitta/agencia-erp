import { Ingredient } from './erp.interface';

/**
 * Las partes de la orden que C3 tipa (Ruling 8).
 *
 * La orden entera sigue viajando como `any` por todo el módulo: tipar el
 * objeto completo —con cliente, equipo, técnico, eventos, notas, turnos y
 * compras— es deuda de otro plan, y hacerlo a medias acá dejaría una interfaz
 * que miente por omisión. Lo que sí se tipa es lo que estas tres pantallas
 * leen campo por campo, que es donde un nombre mal escrito se ve recién en
 * producción.
 */

/** Un renglón de `repair_order_repuestos` tal como lo serializa `GET /repair-orders/:id`. */
export interface RepuestoDeOrden {
  /** Id del RENGLÓN, no del sku: es lo que `presupuestar` valoriza. */
  id: string;
  sku: Ingredient;
  cantidad: number;
  /** `null` = renglón sin valorizar (orden anterior a C3). La OS dice "sin valorizar". */
  precio_unitario: number | null;
  /** Pañol registró que el paquete llegó. */
  ingresado: boolean;
  /** `reparada()` ya asentó su salida de stock. */
  consumido: boolean;
}

/** Un renglón de una OC, tal como lo arma `comprasDeOrden()`. */
export interface ItemDeCompra {
  /** C3 — Ruling 7: la OS cuelga la compra debajo del repuesto por ESTE id. */
  ingredient_id: string | null;
  nombre: string;
  codigo: string | null;
  cantidad_pedida: number;
  cantidad_recibida: number;
  /** Precio real si ya se recibió, si no el estimado (tanda 5). */
  precio_unitario?: number | null;
}

/** Una OC asociada a la orden (`orden.compras`), que hasta C3 el front descartaba. */
export interface CompraDeOrden {
  id: string;
  numero_orden: string;
  numero_pedido: string | null;
  /** `pendiente` | `parcial` | `recibida` | `cancelada`. */
  estado: string;
  /** `contra_entrega` | `cuenta_corriente`. */
  condicion_pago: string;
  proveedor: string | null;
  pagada: boolean;
  tiene_entrega: boolean;
  items: ItemDeCompra[];
  /** Tanda 5: fechas y recepciones para explicar la compra desde la OS. */
  moneda?: string | null;
  cerrada_con_faltante?: boolean;
  fecha_creacion?: string;
  fecha_entrega_estimada?: string | null;
  fecha_recepcion?: string | null;
  recepciones?: { id: string; fecha: string; numero_remito: string | null; monto: number; recibido_por: string | null }[];
}

/** Por qué un repuesto no se puede dar por ingresado (`orden.respaldo`, findOne). */
export interface RespaldoDeOrden {
  ok: boolean;
  bloqueos: { skuId: string; nombre: string; motivo: string }[];
}

/**
 * El desglose derivado del presupuesto (`orden.presupuesto_desglose`).
 * Invariante del backend: con `total` no nulo, `repuestos + mano_obra === total`.
 */
export interface PresupuestoDesglose {
  repuestos: number;
  /** Puede ser negativo: es un descuento sobre las piezas. */
  mano_obra: number;
  /** `null` = todavía no se emitió presupuesto. `0` = se cotizó sin cargo. */
  total: number | null;
}
