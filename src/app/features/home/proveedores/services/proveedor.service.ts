import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { Proveedor } from '../../../../core/interfaces/proveedor.interface';

@Injectable({
  providedIn: 'root'
})
export class ProveedorService {
  private apiUrl = `${environment.apiUrl}/proveedores`;

  constructor(private http: HttpClient) { }

  getProveedores(): Observable<Proveedor[]> {
    return this.http.get<Proveedor[]>(this.apiUrl);
  }

  getProveedor(id: string): Observable<Proveedor> {
    return this.http.get<Proveedor>(`${this.apiUrl}/${id}`);
  }

  /** Spec C §2.7: saldo, últimas OC, repuestos que provee y lead time real. */
  ficha(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}/ficha`);
  }

  createProveedor(data: any): Observable<Proveedor> {
    return this.http.post<Proveedor>(this.apiUrl, data);
  }

  updateProveedor(id: string, data: any): Observable<Proveedor> {
    return this.http.patch<Proveedor>(`${this.apiUrl}/${id}`, data);
  }

  deleteProveedor(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
