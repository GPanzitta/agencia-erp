import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Canal, Catalogo, Contexto, MensajeEnviado, MensajesPara, Plantilla } from './mensajes.util';

/** Mensajes al cliente por WhatsApp y correo: las plantillas de la agencia y los envíos. */
@Injectable({ providedIn: 'root' })
export class MensajesService {
  private http = inject(HttpClient);
  private p = `${environment.apiUrl}/mensajes-plantillas`;
  private m = `${environment.apiUrl}/mensajes`;

  catalogo(): Observable<Catalogo> { return this.http.get<Catalogo>(this.p); }
  crear(datos: { nombre: string; texto: string; contexto: Contexto; canal: Canal; asunto?: string }): Observable<Plantilla> { return this.http.post<Plantilla>(this.p, datos); }
  editar(id: string, datos: Partial<Pick<Plantilla, 'nombre' | 'texto' | 'activa'>> & { asunto?: string }): Observable<Plantilla> { return this.http.patch<Plantilla>(`${this.p}/${id}`, datos); }
  restaurar(id: string): Observable<Plantilla> { return this.http.post<Plantilla>(`${this.p}/${id}/restaurar`, {}); }
  borrar(id: string): Observable<{ ok: true }> { return this.http.delete<{ ok: true }>(`${this.p}/${id}`); }

  para(contexto: Contexto, id: string): Observable<MensajesPara> { return this.http.get<MensajesPara>(`${this.m}/para`, { params: { contexto, id } }); }
  historial(contexto: Contexto, id: string): Observable<MensajeEnviado[]> { return this.http.get<MensajeEnviado[]>(`${this.m}/historial`, { params: { contexto, id } }); }
  registrarWhatsapp(contexto: Contexto, id: string, texto: string, plantillaId: string | null): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(`${this.m}/whatsapp`, { contexto, id, texto, ...(plantillaId ? { plantilla_id: plantillaId } : {}) });
  }
  enviarCorreo(contexto: Contexto, id: string, datos: { para: string; asunto: string; cuerpo: string; plantilla_id?: string }): Observable<MensajeEnviado> {
    return this.http.post<MensajeEnviado>(`${this.m}/correo`, { contexto, id, ...datos });
  }
}
