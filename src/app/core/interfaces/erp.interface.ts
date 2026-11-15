// ═══════════════════════════════════════════════════════
// BRUMM ERP — Interfaces del Modelo FUDO
// Mapeo 1:1 con las entidades del backend NestJS/TypeORM
// Todos los IDs son UUID (string)
// ═══════════════════════════════════════════════════════

import type { TipoPieza } from '../utils/tipo-pieza.util';

// ─── CATÁLOGO ────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  products?: Product[];
}

export interface Product {
  id: string;
  code?: string;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  preparationTime?: number;
  estacion?: 'cocina' | 'barra' | null;
  isActive: boolean;
  imageUrl?: string;
  category?: Category;
  recipeItems?: RecipeItem[];
  modifierGroups?: ModifierGroup[];
  calculatedStock?: number | null;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  modifiers?: Modifier[];
  products?: Product[];
}

export interface Modifier {
  id: string;
  name: string;
  extraPrice: number;
  modifierGroup?: ModifierGroup;
  recipeItems?: RecipeItem[];
}

// ─── INVENTARIO ──────────────────────────────────────

export interface Ingredient {
  id: string;
  name: string;
  /** Código de repuesto (SKU), buscable en diagnóstico, catálogo y escáner. */
  codigo?: string | null;
  unit: string;
  cost: number;
  stock: number;
  minStock: number;
  controlarStock?: boolean;
  recipeItems?: RecipeItem[];
  proveedores?: any[];

  // ─── Pañol y compras (spec C §4.1) ─────────────────────────────────────
  /** Precio al cliente. Nulo = se calcula con el margen del taller. */
  precio_venta?: number | null;
  /** Tienda: precio tachado de la oferta (Postgres lo devuelve como texto). */
  precio_anterior?: number | string | null;
  /** Tienda: 21 o 10,5; nulo = la alícuota del taller. */
  alicuota_iva?: number | string | null;
  /** Estante del pañol ("A-1"). Texto libre. */
  ubicacion?: string | null;
  /** Marca del repuesto (Epcos, Embraco), no del equipo al que sirve. */
  marca?: string | null;
  categoria?: string | null;
  /** De la lista cerrada (core/utils/tipo-pieza.util.ts): enciende su zona en el despiece de la tienda. */
  tipo_pieza?: TipoPieza | null;
  proveedorPrincipalId?: string | null;
  proveedor_principal?: { id: string; nombre: string } | null;
  /** Baja lógica: `false` = archivado, se puede reactivar. */
  activo?: boolean;
  /** T1 — está publicado en la tienda de repuestos. */
  publicado?: boolean;
  /** S1c-b — posición 1..12 en la vidriera de la home. Null = no está destacado. */
  destacado_orden?: number | null;
  /** Último precio pagado en una recepción (spec C §2.6) y cuándo. */
  ultimo_costo?: number | null;
  fecha_ultimo_costo?: string | null;
  /** Derivados que trae el listado paginado, no columnas de la tabla. */
  reservado?: number;
  disponible?: number;
  /**
   * Precio al cliente ya calculado por el backend (el precio de venta cargado,
   * o costo + margen de la empresa). Lo trae el resolver del escáner, que no
   * manda `cost`; ausente o `null` = calcularlo acá con `precioSugerido()`.
   */
  precio_sugerido?: number | null;

  // ─── Identificación y catálogo (spec C5 §4.1) ──────────────────────────
  /** El del fabricante, el que viene impreso en la caja. */
  numero_parte?: string | null;
  /** Modelo de la PIEZA ("B32332-A4306"), no del equipo al que sirve. */
  modelo?: string | null;
  /**
   * No nulo = este repuesto se fusionó en otro y lo que se ve es el
   * perdedor: la ficha lo muestra con la barra "Se fusionó en «X»" y sin
   * acciones de edición.
   */
  fusionado_en_id?: string | null;
}

export interface RecipeItem {
  id: string;
  quantity: number;
  product?: Product;
  ingredient?: Ingredient;
  modifier?: Modifier;
}

// ─── SALÓN Y OPERACIÓN ──────────────────────────────

export interface Sector {
  id: string;
  name: string;
  tables?: Table[];
}

/**
 * Estados de mesa, con los mismos valores que usa el backend.
 *
 * Antes esto era `'available' | 'occupied' | 'reserved' | 'cleaning'`: un
 * vocabulario en ingles que no coincidia con el que guarda y devuelve el
 * backend ('ocupada', 'cuenta_pedida'), asi que ninguna comparacion contra
 * estos valores podia dar verdadera.
 */
export type TableStatus =
  | 'available'
  | 'ocupada'
  | 'cuenta_pedida'
  | 'reservada'
  | 'a_limpiar';

export interface Table {
  id: string;
  number: number;
  capacity: number;
  status: TableStatus;
  sector?: Sector;
  orders?: Order[];
}

export type OrderStatus = 'open' | 'closed' | 'cancelled';

export interface Order {
  id: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  updatedAt: string;
  table?: Table;
  orderItems?: OrderItem[];
  payments?: Payment[];
}

export type OrderItemStatus = 'PENDING' | 'COOKING' | 'READY';

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
  status: OrderItemStatus;
  order?: Order;
  product?: Product;
  orderItemModifiers?: OrderItemModifier[];
}

export interface OrderItemModifier {
  id: string;
  price: number;
  orderItem?: OrderItem;
  modifier?: Modifier;
}

// ─── FINANZAS ────────────────────────────────────────

export type PaymentMethod =
  | 'efectivo'
  | 'tarjeta_debito'
  | 'tarjeta_credito'
  | 'transferencia'
  | 'mercadopago';

export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  mpPreferenceId?: string;
  mpPaymentId?: string;
  createdAt: string;
  order?: Order;
}

// ─── DTOs (Payloads para POST/PATCH) ─────────────────

export interface CreateOrderDto {
  status?: OrderStatus;
  table_id?: string;
}

export interface CreateOrderItemDto {
  quantity: number;
  unitPrice: number;
  notes?: string;
  status?: OrderItemStatus;
  order_id: string;
  product_id: string;
}

export interface CreateOrderItemModifierDto {
  price?: number;
  order_item_id: string;
  modifier_id: string;
}

export interface CreatePaymentDto {
  amount: number;
  method: PaymentMethod;
  status?: PaymentStatus;
  mpPreferenceId?: string;
  mpPaymentId?: string;
  order_id: string;
}
