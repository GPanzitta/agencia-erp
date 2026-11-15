import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

/** Lo de una billetera dentro de un turno (`wallet_balances`). Los montos llegan como string. */
export interface SaldoDeTurno {
  id: string;
  walletId: string;
  wallet?: { id: string; name: string; type?: string };
  opening_amount: string | number;
  expected_amount: string | number;
  declared_amount?: string | number | null;
  difference?: string | number | null;
}

export interface MovimientoDeTurno {
  id: string;
  tipo: 'ingreso' | 'retiro';
  monto: string | number;
  motivo: string;
  fecha: string;
  walletId?: string;
  wallet?: { id: string; name: string };
  empleado?: { nombre?: string };
}

export interface TurnoCaja {
  id: string;
  turno_numero: string;
  fecha_apertura: string;
  fecha_cierre?: string | null;
  estado: 'abierta' | 'cerrada';
  monto_esperado: string | number;
  monto_declarado?: string | number | null;
  diferencia?: string | number | null;
  notas_cierre?: string | null;
  empleado?: { nombre?: string };
  cerrado_por?: { nombre?: string } | null;
  walletBalances?: SaldoDeTurno[];
  movimientos?: MovimientoDeTurno[];
  /** Solo en la respuesta de abrir: lo contado que no coincidía con el sistema. */
  diferencias_apertura?: {
    wallet_id: string;
    billetera: string;
    contado: number;
    segun_sistema: number;
    diferencia: number;
  }[];
}

/** Turno de caja: abrir, mover plata, cerrar. Los errores los pinta el interceptor. */
@Injectable({ providedIn: 'root' })
export class TurnoCajaService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/cash-register`;

  /** El turno abierto, o `null` (el backend responde vacío si no hay). */
  activo(): Observable<TurnoCaja | null> {
    return this.http.get<TurnoCaja | null>(`${this.apiUrl}/active`);
  }

  abrir(wallet_amounts: { wallet_id: string; amount: number }[]): Observable<TurnoCaja> {
    return this.http.post<TurnoCaja>(`${this.apiUrl}/open`, { wallet_amounts });
  }

  cerrar(
    id: string,
    wallet_declared_amounts: { wallet_id: string; declared_amount: number }[],
    notas?: string,
  ): Observable<TurnoCaja> {
    return this.http.post<TurnoCaja>(`${this.apiUrl}/${id}/close`, { wallet_declared_amounts, notas });
  }

  movimiento(
    id: string,
    dto: { tipo: 'ingreso' | 'retiro'; monto: number; motivo: string; wallet_id: string },
  ): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/${id}/movement`, dto);
  }

  historial(limit = 10): Observable<TurnoCaja[]> {
    return this.http.get<TurnoCaja[]>(`${this.apiUrl}/history?limit=${limit}`);
  }
}
