import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { CategoriaGasto, MetodoPagoGasto } from '../../../../core/interfaces/gastos.interface';

export enum Frecuencia {
  SEMANAL = 'semanal',
  QUINCENAL = 'quincenal',
  MENSUAL = 'mensual',
  BIMESTRAL = 'bimestral',
  TRIMESTRAL = 'trimestral',
  ANUAL = 'anual',
}

export interface GastoRecurrente {
  id: string;
  descripcion: string;
  categoria: CategoriaGasto;
  monto: string | number;
  metodo_pago: MetodoPagoGasto;
  frecuencia: Frecuencia;
  dia_vencimiento: number;
  fecha_inicio: string;
  fecha_fin?: string | null;
  proveedor?: { id: string; nombre: string } | null;
  /** Próximo vencimiento a generar. Pasado el «Hasta», la plantilla terminó. */
  proxima_generacion?: string;
  activo: boolean;
  notas?: string | null;
}

export interface LineaPresupuesto {
  categoria: CategoriaGasto;
  asignado: number;
  gastado: number;
  disponible: number;
  consumo_porcentual: number;
  comprobantes: number;
  umbral_alerta: number;
  estado: 'ok' | 'en_alerta' | 'excedido';
}

export interface DeudaProveedor {
  proveedor_id: string | null;
  proveedor: string;
  comprobantes: number;
  /** Lo aprobado y sin pagar: lo que se puede pagar hoy. */
  deuda: number;
  vencido: number;
  /**
   * Lo que espera una firma. No se puede pagar hasta que lo aprueben, pero
   * es crédito que el proveedor ya dio. Un backend viejo no lo manda.
   */
  sin_aprobar?: number;
  sin_aprobar_vencido?: number;
  proximo_vencimiento?: string | null;
  limite_credito?: number | null;
  /** Saldo a favor por anticipos: la deuda real es deuda − a_cuenta. */
  a_cuenta?: number;
  /** El backend lo calcula sobre deuda + sin_aprobar. */
  excede_limite?: boolean;
}

export interface FinanceSettings {
  umbral_aprobacion: string | number;
  alerta_saldo_minimo: string | number;
  dias_aviso_vencimiento: number;
}

/**
 * Cliente de las funcionalidades financieras que el backend ya tenía
 * implementadas y el ERP no exponía: gastos recurrentes, presupuestos por
 * categoría, cuentas por pagar, vencimientos y parámetros del local.
 */
@Injectable({ providedIn: 'root' })
export class FinanceService {
  private http = inject(HttpClient);
  // El controller del backend está montado en 'finanzas', no en 'finance'.
  private financeUrl = `${environment.apiUrl}/finanzas`;
  private expensesUrl = `${environment.apiUrl}/expenses`;

  // ─── Gastos recurrentes ──────────────────────────────────────────────

  listarRecurrentes(): Observable<GastoRecurrente[]> {
    return this.http.get<GastoRecurrente[]>(`${this.financeUrl}/recurrentes`);
  }

  crearRecurrente(dto: Record<string, unknown>): Observable<GastoRecurrente> {
    return this.http.post<GastoRecurrente>(`${this.financeUrl}/recurrentes`, dto);
  }

  actualizarRecurrente(id: string, cambios: Record<string, unknown>): Observable<GastoRecurrente> {
    return this.http.patch<GastoRecurrente>(`${this.financeUrl}/recurrentes/${id}`, cambios);
  }

  desactivarRecurrente(id: string): Observable<unknown> {
    return this.http.delete(`${this.financeUrl}/recurrentes/${id}`);
  }

  /**
   * Vuelve a poner en marcha una plantilla dada de baja (#42). 'pendiente'
   * genera desde donde quedó, hueco incluido; 'hoy' saltea lo vencido.
   */
  reactivarRecurrente(id: string, desde: 'pendiente' | 'hoy'): Observable<GastoRecurrente> {
    return this.http.patch<GastoRecurrente>(`${this.financeUrl}/recurrentes/${id}/reactivar`, { desde });
  }

  /** Genera los gastos del período a partir de las plantillas recurrentes. */
  generarRecurrentes(): Observable<{ generados: number } | unknown> {
    return this.http.post(`${this.financeUrl}/recurrentes/generar`, {});
  }

  // ─── Presupuestos ────────────────────────────────────────────────────

  ejecucionPresupuesto(periodo?: string): Observable<{ periodo: string; lineas: LineaPresupuesto[]; totales?: unknown }> {
    const q = periodo ? `?periodo=${periodo}` : '';
    return this.http.get<{ periodo: string; lineas: LineaPresupuesto[] }>(
      `${this.financeUrl}/presupuestos/ejecucion${q}`,
    );
  }

  crearPresupuesto(dto: Record<string, unknown>): Observable<unknown> {
    return this.http.post(`${this.financeUrl}/presupuestos`, dto);
  }

  /** Copia los montos de un período a otro, para no recargar todo a mano. */
  copiarPresupuesto(desde: string, hasta: string): Observable<unknown> {
    return this.http.post(`${this.financeUrl}/presupuestos/copiar`, { desde, hasta });
  }

  eliminarPresupuesto(id: string): Observable<unknown> {
    return this.http.delete(`${this.financeUrl}/presupuestos/${id}`);
  }

  // ─── Parámetros del local ────────────────────────────────────────────

  verSettings(): Observable<FinanceSettings> {
    return this.http.get<FinanceSettings>(`${this.financeUrl}/settings`);
  }

  actualizarSettings(cambios: Partial<FinanceSettings>): Observable<FinanceSettings> {
    return this.http.patch<FinanceSettings>(`${this.financeUrl}/settings`, cambios);
  }

  // ─── Cuentas por pagar y vencimientos ────────────────────────────────

  cuentasPorPagar(): Observable<DeudaProveedor[]> {
    return this.http.get<DeudaProveedor[]>(`${this.expensesUrl}/cuentas-por-pagar`);
  }

  vencimientos(dias = 30): Observable<Record<string, { total: number; gastos: any[] }>> {
    return this.http.get<Record<string, { total: number; gastos: any[] }>>(
      `${this.expensesUrl}/vencimientos?dias=${dias}`,
    );
  }
}
