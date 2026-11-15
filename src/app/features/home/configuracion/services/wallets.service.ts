import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { Observable } from 'rxjs';

export interface Wallet {
  id?: string;
  name: string;
  type: 'cash' | 'bank' | 'digital';
  /** Agencia: una caja es de pesos o de dólares. */
  moneda?: 'ARS' | 'USD';
  current_balance?: number;
  is_active?: boolean;
}

/** Asiento del libro de una billetera: entrada o salida con saldo posterior. */
export interface MovimientoBilletera {
  id: string;
  signo: 'ingreso' | 'egreso';
  monto: string | number;
  saldo_posterior: string | number;
  origen: string;
  concepto?: string;
  fecha: string;
}

@Injectable({
  providedIn: 'root'
})
export class WalletsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/wallets`;

  getWallets(): Observable<Wallet[]> {
    return this.http.get<Wallet[]>(this.apiUrl);
  }

  getActiveWallets(): Observable<Wallet[]> {
    return this.http.get<Wallet[]>(`${this.apiUrl}/active`);
  }

  createWallet(data: Partial<Wallet>): Observable<Wallet> {
    return this.http.post<Wallet>(this.apiUrl, data);
  }

  updateWallet(id: string, data: Partial<Wallet>): Observable<Wallet> {
    return this.http.patch<Wallet>(`${this.apiUrl}/${id}`, data);
  }

  deleteWallet(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /** Mueve plata entre dos cajas: dos asientos atómicos con chequeo de fondos. */
  transferir(dto: { origen_id: string; destino_id: string; monto: number; motivo: string }) {
    return this.http.post(`${this.apiUrl}/transferencia`, dto);
  }

  /** Declara el saldo contado y el backend asienta la diferencia, con motivo. */
  ajustar(id: string, saldo_real: number, motivo: string) {
    return this.http.post<{ anterior: number; ajuste: number; actual: number }>(
      `${this.apiUrl}/${id}/ajuste`, { saldo_real, motivo },
    );
  }

  /** El libro de la billetera: por qué el saldo es el que es. */
  movimientos(id: string, limite = 50): Observable<MovimientoBilletera[]> {
    return this.http.get<MovimientoBilletera[]>(
      `${this.apiUrl}/${id}/movimientos?limite=${limite}`,
    );
  }
}
