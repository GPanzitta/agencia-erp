import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';

export interface Company {
  id: string;
  name: string;
  domain?: string;
  created_at: string;
}

export interface SetupCompanyResponse {
  message: string;
  company: Company;
  users: any[];
  /** #36: la clave inicial del admin, en claro sólo en esta respuesta. */
  clave_inicial?: string;
}

export type PlanDeTaller = 'gratis' | 'pago' | 'interno';

export interface TallerDePlataforma {
  id: string;
  nombre: string;
  plan: PlanDeTaller;
  estado: 'al_dia' | 'vencida' | 'solo_lectura';
  vence_en: string | null;
  ultima_actividad: string;
  ordenes_mes: number;
  creado_en: string;
}

export interface ConfigPlataforma {
  precio_mensual: number;
  tope_ordenes_gratis: number;
  dias_gracia: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) { }

  getCompanies(): Observable<Company[]> {
    return this.http.get<Company[]>(`${this.apiUrl}/companies`);
  }

  talleresPlataforma(): Observable<TallerDePlataforma[]> {
    return this.http.get<TallerDePlataforma[]>(`${this.apiUrl}/plataforma/talleres`);
  }

  cambiarPlanTaller(id: string, cambios: { plan: PlanDeTaller; vence_en?: string }): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/plataforma/talleres/${id}`, cambios);
  }

  configPlataforma(): Observable<ConfigPlataforma> {
    return this.http.get<ConfigPlataforma>(`${this.apiUrl}/plataforma/config`);
  }

  guardarConfigPlataforma(valores: ConfigPlataforma): Observable<ConfigPlataforma> {
    return this.http.patch<ConfigPlataforma>(`${this.apiUrl}/plataforma/config`, valores);
  }

  setupCompany(companyName: string): Observable<SetupCompanyResponse> {
    return this.http.post<SetupCompanyResponse>(`${this.apiUrl}/setup-company`, { companyName });
  }
}
