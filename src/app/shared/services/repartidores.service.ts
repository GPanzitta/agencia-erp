import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface RepartidorDisponible {
  id: string;
  nombre: string;
}

/**
 * Repartidores activos del local.
 *
 * La lista se cachea a propósito: el selector se renderiza una vez por tarjeta
 * de pedido, y una pantalla con veinte pedidos dispararía veinte requests
 * idénticos para llenar veinte `<select>` iguales. Los repartidores no cambian
 * durante un servicio; cuando cambian (alta o baja de un empleado) se llama a
 * `refrescar()`.
 */
@Injectable({ providedIn: 'root' })
export class RepartidoresService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  private cache$?: Observable<RepartidorDisponible[]>;
  private ultimos: RepartidorDisponible[] = [];

  listar(): Observable<RepartidorDisponible[]> {
    if (!this.cache$) {
      this.cache$ = this.http
        .get<RepartidorDisponible[]>(`${this.base}/sales/repartidores`)
        .pipe(
          tap((l) => (this.ultimos = l)),
          // Un error no debe romper la pantalla del pedido: el selector queda
          // vacío y avisa, pero el resto de la tarjeta sigue funcionando.
          catchError(() => of([])),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.cache$;
  }

  /** Última lista conocida, sin disparar request. */
  get conocidos(): RepartidorDisponible[] {
    return this.ultimos;
  }

  refrescar(): void {
    this.cache$ = undefined;
  }
}
