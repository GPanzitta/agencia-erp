/** @deprecated Concepto heredado del rubro gastronómico. El backend todavía lo
 *  envía, pero el front del taller no lo muestra ni lo edita. */
export type CanalPreferido = 'delivery' | 'mesa' | 'mostrador' | 'online';
export type SegmentoCliente = 'vip' | 'regular' | 'nuevo';

export interface Customer {
  id: string;
  nombre: string;
  apellido?: string;
  /** b2c = particular; b2b = marca/aseguradora que deriva equipos. */
  tipo?: 'b2c' | 'b2b';
  /** DNI o CUIT. */
  documento?: string;
  condicion_iva?: string;
  /** Persona de contacto (clientes empresa). */
  contacto?: string;
  telefono?: string;
  telefono_alternativo?: string;
  email?: string;
  fecha_nacimiento?: string;
  /** @deprecated El backend lo manda; el front del taller no lo usa. */
  canal_preferido?: CanalPreferido;
  direccion_principal?: string;
  /** VIP se marca a mano desde Clientes; la OS y el tablero lo muestran. */
  segmento: SegmentoCliente;
  /** @deprecated Contador del bar: en el taller ninguna orden lo actualiza. Usar `cobrado`. */
  total_compras_historico: number;
  /** @deprecated Contador del bar. Usar `ordenes_total`. */
  cantidad_visitas: number;
  /** @deprecated Contador del bar. Usar `ultima_orden`. */
  ultima_visita?: string;
  // ── Métricas calculadas por el backend desde las órdenes (GET /customers) ──
  ordenes_total: number;
  ordenes_abiertas: number;
  /** Alta de la orden más reciente, ISO; null si nunca trajo nada. */
  ultima_orden: string | null;
  /** Seña + saldo cobrado, sumado sobre todas sus órdenes. */
  cobrado: number;
  equipos: number;
  notas?: string;
  activo: boolean;
  created_at: string;
  ciudad?: string;
  codigo_postal?: string;
  piso_depto?: string;
  notas_entrega?: string;
  is_web_user: boolean;
  onboarding_completed: boolean;
}
