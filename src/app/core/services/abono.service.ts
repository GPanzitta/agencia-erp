import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SIN_AVISO_DE_ERROR } from '../interceptors/sin-aviso.token';

export interface PagoAbono { mp_pago_id: string; monto: number; pagado_en: string }

/** La forma de `GET /abono/estado`. */
export interface RespuestaAbono {
  plan: 'gratis' | 'pago' | 'interno';
  estado: 'al_dia' | 'vencida' | 'solo_lectura';
  vence_en: string | null;
  gracia_hasta: string | null;
  ordenes_mes: number;
  tope: number | null;
  precio_mensual: number;
  preapproval_estado: string | null;
  pago_simulado: boolean;
  pagos?: PagoAbono[];
}

/** Fecha corta en hora del taller: el vencimiento no tiene que cambiar de día según la PC. */
export function fechaAbono(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
}

@Injectable({ providedIn: 'root' })
export class AbonoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/abono`;

  readonly estado = signal<RespuestaAbono | null>(null);

  /** En segundo plano: si falla, no vale la pena tapar la pantalla con un aviso. */
  async refrescar(): Promise<void> {
    const context = new HttpContext().set(SIN_AVISO_DE_ERROR, true);
    this.estado.set(await firstValueFrom(this.http.get<RespuestaAbono | null>(`${this.url}/estado`, { context })));
  }

  suscribir(payerEmail: string): Promise<{ init_point?: string; simulado?: boolean }> {
    return firstValueFrom(this.http.post<{ init_point?: string; simulado?: boolean }>(`${this.url}/suscribir`, { payer_email: payerEmail }));
  }

  volverAGratis(): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.url}/volver-a-gratis`, {}));
  }

  simularPago(): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.url}/pago-simulado`, {}));
  }
}
