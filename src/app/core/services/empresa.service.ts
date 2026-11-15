import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/** Un plan de cuotas de la tienda (spec 2026-10-07 tienda §3.2). */
export interface PlanCuotas {
  cuotas: number;
  sin_interes: boolean;
}

/** Datos del taller: membrete de la documentación física y parámetros del pañol. */
export interface Empresa {
  id: string;
  name: string;
  direccion: string | null;
  telefono: string | null;
  cuit: string | null;
  requiere_presupuesto: boolean;
  /**
   * Access token de Mercado Pago ('SIMULADO' = modo demo). CLI-02: sólo viaja
   * en el PATCH. Lo que llega del backend se descarta al leerlo (`sinSecretos`)
   * y la tanda 2 del backend deja de mandarlo: la pantalla usa `mp_configurado`.
   */
  mp_access_token?: string | null;
  /** Si hay un token de MP cargado. Lo calcula `sinSecretos` si el backend no lo manda. */
  mp_configurado?: boolean;
  /** Cómo está conectado Mercado Pago (spec 2026-10-28 §13.1). */
  mp_conexion?: 'oauth' | 'manual' | 'demo' | 'vencida' | null;
  mp_user_id?: string | null;
  mp_cuenta?: string | null;
  /** Si este entorno permite el modo demo: en producción dejaría al taller sin cobrar. */
  mp_demo_permitida?: boolean;
  mp_token_vence?: string | null;
  /** Porcentaje del presupuesto que se cobra como seña en el portal. */
  sena_porcentaje: number;
  /**
   * Billetera de Mercado Pago: las señas del portal, las ventas de la tienda
   * por MP y lo que el chofer cobra por MP en la puerta (D2).
   */
  mp_wallet_id: string | null;
  /**
   * D2 — Billetera donde entran las transferencias que el chofer cobra en la
   * puerta. Nula = el chofer no cobra por transferencia. Puede ser la misma
   * que la de Mercado Pago.
   */
  transferencia_wallet_id: string | null;
  /** Garantía por defecto de las reparaciones, en días. */
  garantia_dias: number;
  /** Días en listo/rechazada sin retirar para considerar abandono. */
  dias_abandono: number;

  // ─── Identificación y catálogo (spec C5 §2.10) ─────────────────────────
  /**
   * Margen sobre el costo con el que se calcula el precio sugerido del
   * repuesto. La columna existía desde C1 pero el `whitelist` del backend
   * descartaba la clave: C5a la puso en el DTO y en `miEmpresa`.
   */
  margen_repuestos_porcentaje: number;
  /** Umbral de la alerta "este renglón vino más caro" al recibir una OC. */
  alerta_suba_costo_porcentaje: number;

  // ─── Ventas de la tienda (T4 + hueco T2) ───────────────────────────────
  /**
   * La columna existe desde T4 y `GET /tienda/config` ya la mostraba, pero
   * el `whitelist` del backend la descartaba en el PATCH — mismo hueco que
   * tuvo `margen_repuestos_porcentaje` con C5a.
   */
  envio_habilitado: boolean;
  /** Monto fijo del envío de la tienda. */
  costo_envio_tienda: number;
  /** Cuánto dura una reserva sin pagar antes de liberar el stock. */
  reserva_horas: number;
  /** Spec 2026-10-02 §3.6: tope de descuento del mostrador, en %. */
  descuento_maximo_mostrador: number;

  // ─── Tienda: capa comercial (spec 2026-10-07 tienda §3.2) ──────────────
  // Opcionales: los fixtures de otros specs no los traen; el backend siempre los manda.
  /** IVA para el «precio sin impuestos nacionales»: 21 o 10,5. */
  alicuota_iva_defecto?: number;
  cuotas_tienda?: PlanCuotas[];
  /** Habilitarla exige CBU o alias, titular y `transferencia_wallet_id`. */
  transferencia_tienda_habilitada?: boolean;
  transferencia_descuento_porcentaje?: number;
  transferencia_cbu?: string | null;
  transferencia_alias?: string | null;
  transferencia_titular?: string | null;
  /** Envío gratis desde este subtotal. Null = nunca. */
  envio_gratis_desde?: number | null;

  // ─── Datos legales y de los documentos (opción B, 13/10/2026) ──────────
  // Migración 1789800000019 del backend. Opcionales: hasta que corra, la API
  // no los manda y los papeles salen con los «si está vacío» del contrato.
  /** Pie, datos personales y garantía. Vacía = se usa `name`. */
  razon_social?: string | null;
  condicion_iva?: CondicionIva | null;
  iibb?: string | null;
  /** `YYYY-MM-DD`. */
  inicio_actividades?: string | null;
  /** Dónde se piden los datos personales y la garantía. Vacío = «en el local». */
  email_contacto?: string | null;
  horario_atencion?: string | null;
  /** 0 = la revisión no tiene cargo. Decimal: llega como string y se normaliza. */
  costo_revision?: number;
  revision_se_descuenta?: boolean;
  plazo_presupuesto_dias?: number;
  plazo_reparacion_dias?: number;
  /** 0 = se intima por escrito, sin cargo por guarda. Decimal normalizado. */
  canon_guarda_diario?: number;
  revision_garantia_dias?: number;
  factura_momento?: FacturaMomento;
  /** Vacío = el texto de traslado por defecto del certificado. */
  traslado_garantia?: string | null;
}

export type CondicionIva = 'responsable_inscripto' | 'monotributo' | 'exento';
export type FacturaMomento = 'al_cobrar' | 'al_senar';

/** Los decimales de Postgres que viajan como string en la empresa. */
const DECIMALES_EMPRESA = ['costo_revision', 'canon_guarda_diario'] as const;

/**
 * Los montos `decimal` llegan como string desde TypeORM ("15000.00"): se
 * pasan a número una sola vez acá, así los documentos y el form comparan
 * contra 0 sin sorpresas. Lo que no vino, no se inventa.
 */
export function normalizarEmpresa(e: Empresa): Empresa {
  if (!e || typeof e !== 'object') return e;
  const out: any = { ...e };
  for (const k of DECIMALES_EMPRESA) {
    if (out[k] !== null && out[k] !== undefined) out[k] = Number(out[k]) || 0;
  }
  return out;
}

/** El respaldo del margen: el mismo default que usa el backend. */
export const MARGEN_DE_RESPALDO = 40;

/**
 * CLI-02: ¿hay token de MP? Primero lo que diga el backend (`mp_configurado`,
 * o `mp_token_configurado`); si todavía manda el token, se mira que no esté vacío.
 */
export function mpConfigurado(e: unknown): boolean {
  const x = (e ?? {}) as Record<string, unknown>;
  if (typeof x['mp_configurado'] === 'boolean') return x['mp_configurado'] as boolean;
  if (typeof x['mp_token_configurado'] === 'boolean') return x['mp_token_configurado'] as boolean;
  return typeof x['mp_access_token'] === 'string' && x['mp_access_token'].trim() !== '';
}

/**
 * CLI-02: la empresa como la guarda el ERP, sin el token de Mercado Pago. El
 * caché lo leen todas las pantallas y todos los puestos (el membrete de los
 * documentos), así que el secreto no se queda en la memoria de la sesión.
 */
export function sinSecretos(e: Empresa): Empresa {
  if (!e || typeof e !== 'object') return e;
  const { mp_access_token: _token, ...resto } = e;
  return { ...resto, mp_configurado: mpConfigurado(e) };
}

@Injectable({ providedIn: 'root' })
export class EmpresaService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/companies/mi-empresa`;

  /** Cache de sesión: los documentos se imprimen seguido, el membrete no cambia. */
  empresa = signal<Empresa | null>(null);

  /** La URL de autorización de Mercado Pago para este taller. */
  iniciarConexionMp() {
    return this.http.post<{ url: string }>(`${environment.apiUrl}/mp/oauth/iniciar`, {});
  }

  confirmarConexionMp(pendiente: string) {
    return this.http.post<{ conectada: boolean }>(`${environment.apiUrl}/mp/oauth/confirmar`, { pendiente });
  }

  desconectarMp() {
    return this.http.delete<{ conectada: boolean }>(`${environment.apiUrl}/mp/conexion`);
  }

  cargar() {
    return this.http.get<Empresa>(this.base).pipe(
      map(sinSecretos),
      map(normalizarEmpresa),
      tap((e) => this.empresa.set(e)),
    );
  }

  actualizar(
    cambios: Partial<
      Pick<
        Empresa,
        | 'name' | 'direccion' | 'telefono' | 'cuit' | 'mp_access_token' | 'sena_porcentaje'
        | 'mp_wallet_id' | 'transferencia_wallet_id' | 'garantia_dias' | 'dias_abandono'
        | 'margen_repuestos_porcentaje' | 'alerta_suba_costo_porcentaje'
        | 'envio_habilitado' | 'costo_envio_tienda' | 'reserva_horas' | 'descuento_maximo_mostrador'
        | 'alicuota_iva_defecto' | 'cuotas_tienda' | 'transferencia_tienda_habilitada' | 'transferencia_descuento_porcentaje'
        | 'transferencia_cbu' | 'transferencia_alias' | 'transferencia_titular' | 'envio_gratis_desde'
        | 'razon_social' | 'condicion_iva' | 'iibb' | 'inicio_actividades' | 'email_contacto' | 'horario_atencion'
        | 'costo_revision' | 'revision_se_descuenta' | 'plazo_presupuesto_dias' | 'plazo_reparacion_dias'
        | 'canon_guarda_diario' | 'revision_garantia_dias' | 'factura_momento' | 'traslado_garantia'
      >
    >,
  ) {
    return this.http.patch<Empresa>(this.base, cambios).pipe(
      map(sinSecretos),
      map(normalizarEmpresa),
      tap((e) => this.empresa.set(e)),
    );
  }

  /**
   * El margen del taller, cacheado (desvío 7).
   *
   * El formulario del repuesto lo necesita para calcular el sugerido, y lo
   * abre una vez por alta: sin la caché, cada apertura sería un pedido más a
   * `/companies/mi-empresa` por un número que no cambia en toda la sesión.
   * Si el pedido falla se devuelve 40, que es el default del backend: el
   * formulario tiene que poder abrirse aunque Configuración no conteste.
   */
  margenRepuestos(): Observable<number> {
    const cacheada = this.empresa();
    if (cacheada) return of(Number(cacheada.margen_repuestos_porcentaje ?? MARGEN_DE_RESPALDO));
    return this.cargar().pipe(
      map((e) => Number(e?.margen_repuestos_porcentaje ?? MARGEN_DE_RESPALDO)),
      // La promesa del comentario se cumple acá, no en el que llama: un 500 de
      // Configuración no puede dejar el alta del repuesto sin margen.
      catchError(() => of(MARGEN_DE_RESPALDO)),
    );
  }
}
