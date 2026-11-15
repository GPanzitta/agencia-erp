import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { Gasto } from '../../../../core/interfaces/gastos.interface';

export interface RegistrarPagoDto {
  monto: number;
  wallet_id: string;
  metodo_pago: string;
  referencia?: string;
  notas?: string;
}

/** KPIs del módulo: lo que se mira antes que la lista. */
export interface Anticipo {
  id: string;
  proveedor: { id: string; nombre: string };
  monto: number;
  /** Lo que queda sin imputar a facturas. */
  saldo: number;
  wallet: { id: string; name: string } | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
}

export interface ResumenGastos {
  mes_actual: { total: number; cantidad: number };
  por_categoria: { categoria: string; total: number; participacion: number }[];
  a_pagar: { total: number; cantidad: number };
  vencido: { total: number; cantidad: number };
  esperando_aprobacion: { total: number; cantidad: number };
  por_mes: { mes: string; total: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private apiUrl = `${environment.apiUrl}/expenses`;

  constructor(private http: HttpClient) {}

  /**
   * Lista de gastos. Los filtros los soporta el backend desde siempre
   * (`FiltrarGastosDto`) pero el ERP nunca los mandaba: traía todo y no
   * ofrecía forma de acotar por categoría, período o estado de pago.
   */
  getExpenses(filtros?: {
    categoria?: string;
    estado_pago?: string;
    proveedor_id?: string;
    desde?: string;
    hasta?: string;
    vencidos?: boolean;
    solo_activos?: boolean;
  }): Observable<Gasto[]> {
    let params = new HttpParams();
    if (filtros) {
      Object.entries(filtros).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
      });
    }
    return this.http.get<Gasto[]>(this.apiUrl, { params });
  }

  createExpense(expenseData: any): Observable<Gasto> {
    return this.http.post<Gasto>(this.apiUrl, expenseData);
  }

  anularExpense(id: string): Observable<Gasto> {
    return this.http.patch<Gasto>(`${this.apiUrl}/${id}/anular`, {});
  }

  // ─── Circuito de pago y aprobación ─────────────────────────────────────
  //
  // Los endpoints ya existían en el backend (expenses.controller.ts); acá
  // solo faltaba el cliente HTTP para llamarlos. Sin esto un gasto se creaba
  // y quedaba sin forma de marcarse pagado ni de aprobarse desde el ERP.

  pendientesDeAprobacion(): Observable<Gasto[]> {
    return this.http.get<Gasto[]>(`${this.apiUrl}/pendientes-aprobacion`);
  }

  aprobar(id: string): Observable<Gasto> {
    return this.http.patch<Gasto>(`${this.apiUrl}/${id}/aprobar`, {});
  }

  rechazar(id: string, motivo: string): Observable<Gasto> {
    return this.http.patch<Gasto>(`${this.apiUrl}/${id}/rechazar`, { motivo });
  }

  registrarPago(id: string, dto: RegistrarPagoDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/pagos`, dto);
  }

  resumen(): Observable<ResumenGastos> {
    return this.http.get<ResumenGastos>(`${this.apiUrl}/resumen`);
  }

  /** El gasto con sus pagos, para el detalle. */
  getExpense(id: string): Observable<Gasto> {
    return this.http.get<Gasto>(`${this.apiUrl}/${id}`);
  }

  /**
   * Revierte un pago: el backend escribe el asiento contrario en el ledger y
   * la plata vuelve a la billetera. El endpoint existía; el ERP nunca lo
   * llamaba, así que un pago mal cargado quedaba sin salida.
   */
  /** Pago global a un proveedor: el backend lo imputa FIFO por vencimiento. */
  pagarProveedor(dto: {
    proveedor_id: string; monto: number; wallet_id: string;
    metodo_pago: string; referencia?: string; usar_anticipos?: boolean;
  }): Observable<{
    total_aplicado: number; comprobantes_tocados: number;
    comprobantes_saldados: number; deuda_restante: number;
    desde_anticipos: number; desde_caja: number;
    imputaciones: { numero_gasto: string; aplicado: number; saldado: boolean }[];
  }> {
    return this.http.post<any>(`${this.apiUrl}/pagar-proveedor`, dto);
  }

  // ─── Anticipos a proveedor ────────────────────────────────────────────

  /** Plata entregada a cuenta: sale de la caja hoy, se imputa cuando llegue la factura. */
  crearAnticipo(dto: { proveedor_id: string; monto: number; wallet_id: string; notas?: string })
    : Observable<Anticipo> {
    return this.http.post<Anticipo>(`${this.apiUrl}/anticipos`, dto);
  }

  anticiposDe(proveedorId: string): Observable<{ disponible: number; anticipos: Anticipo[] }> {
    return this.http.get<any>(`${this.apiUrl}/anticipos/${proveedorId}`);
  }

  /** Solo si no se consumió nada: la plata vuelve a la caja de origen. */
  anularAnticipo(id: string, motivo?: string): Observable<Anticipo> {
    return this.http.patch<Anticipo>(`${this.apiUrl}/anticipos/${id}/anular`, { motivo });
  }

  /** Foto o PDF del comprobante. Devuelve la URL para guardar en el gasto. */
  uploadComprobante(archivo: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', archivo);
    return this.http.post<{ url: string }>(`${this.apiUrl}/upload-comprobante`, form);
  }

  updateExpense(id: string, cambios: any): Observable<Gasto> {
    return this.http.patch<Gasto>(`${this.apiUrl}/${id}`, cambios);
  }

  anularExpenseConMotivo(id: string, motivo: string, destino?: 'turno_actual' | 'sin_arqueo'): Observable<Gasto> {
    return this.http.patch<Gasto>(`${this.apiUrl}/${id}/anular`, { motivo, destino });
  }

  anularPago(pagoId: string, motivo?: string, destino?: 'turno_actual' | 'sin_arqueo'): Observable<any> {
    return this.http.patch(`${this.apiUrl}/pagos/${pagoId}/anular`, { motivo, destino });
  }
}
