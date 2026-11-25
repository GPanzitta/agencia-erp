import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { VistaMargen } from './margen.interface';

@Injectable({ providedIn: 'root' })
export class MargenService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/margen`;

  tablero(desde?: string, hasta?: string): Observable<VistaMargen> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<VistaMargen>(this.url, { params });
  }
}
