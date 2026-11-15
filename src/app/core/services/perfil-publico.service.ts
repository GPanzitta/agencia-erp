import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CambiosPerfil, CampoImagen, FotosDelSitio, PerfilPublico, PruebaGoogle } from '../models/perfil-publico.model';
import { SIN_AVISO_DE_ERROR } from '../interceptors/error.interceptor';

/** Configuración → Sitio web: el perfil que ve la calle (S1a §4.2). */
@Injectable({ providedIn: 'root' })
export class PerfilPublicoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/companies/mi-empresa/perfil-publico`;

  obtener(): Observable<PerfilPublico> {
    return this.http.get<PerfilPublico>(this.base);
  }

  /**
   * El 400 de este PATCH lo reparte la pantalla campo por campo
   * (`asignarErroresBackend`): si además lo pintara el interceptor, el
   * operario vería el mismo texto dos veces, uno de ellos sin decirle a qué
   * campo pertenece. Todos los que llaman a este método avisan por su cuenta.
   */
  guardar(cambios: CambiosPerfil): Observable<PerfilPublico> {
    return this.http.patch<PerfilPublico>(this.base, cambios, {
      context: new HttpContext().set(SIN_AVISO_DE_ERROR, true),
    });
  }

  /** El backend comprime; acá sólo viaja el archivo. */
  subirImagen(campo: CampoImagen, archivo: File): Observable<PerfilPublico> {
    const form = new FormData();
    form.append('file', archivo);
    return this.http.post<PerfilPublico>(`${this.base}/imagenes/${campo}`, form);
  }

  borrarTrabajo(indice: number): Observable<PerfilPublico> {
    return this.http.delete<PerfilPublico>(`${this.base}/trabajos/${indice}`);
  }

  /**
   * Video de portada. Cloudinary lo transcodifica y saca el poster; el
   * backend contesta el perfil entero, igual que las imágenes.
   */
  subirVideo(archivo: File): Observable<PerfilPublico> {
    const form = new FormData();
    form.append('file', archivo);
    return this.http.post<PerfilPublico>(`${this.base}/video`, form);
  }

  quitarVideo(): Observable<PerfilPublico> {
    return this.http.delete<PerfilPublico>(`${this.base}/video`);
  }

  /** Fotos del sitio: cada lugar de la página con su original o la propia del taller. */
  fotosSitio(): Observable<FotosDelSitio> {
    return this.http.get<FotosDelSitio>(`${this.base}/fotos-sitio`);
  }

  /** El backend comprime; cada llamada devuelve el estado completo de todos los lugares. */
  subirFotoSitio(clave: string, posicion: number, archivo: File): Observable<FotosDelSitio> {
    const form = new FormData();
    form.append('file', archivo);
    return this.http.post<FotosDelSitio>(`${this.base}/fotos-sitio/${clave}/${posicion}`, form);
  }

  /** Vuelve a la original; el backend contesta 404 si ya lo era. */
  quitarFotoSitio(clave: string, posicion: number): Observable<FotosDelSitio> {
    return this.http.delete<FotosDelSitio>(`${this.base}/fotos-sitio/${clave}/${posicion}`);
  }

  /** Video grande de la portada del sitio (no es el de `subirVideo`, que va en el perfil). */
  subirVideoPortada(archivo: File): Observable<FotosDelSitio> {
    const form = new FormData();
    form.append('file', archivo);
    return this.http.post<FotosDelSitio>(`${this.base}/video-portada`, form);
  }

  quitarVideoPortada(): Observable<FotosDelSitio> {
    return this.http.delete<FotosDelSitio>(`${this.base}/video-portada`);
  }

  /**
   * Consulta la fuente de opiniones en el acto, sin guardar nada. El error lo
   * muestra la pantalla al lado del campo: por eso el interceptor no avisa.
   */
  probarGoogle(placeId: string): Observable<PruebaGoogle> {
    return this.http.post<PruebaGoogle>(`${this.base}/google/probar`, { place_id: placeId }, {
      context: new HttpContext().set(SIN_AVISO_DE_ERROR, true),
    });
  }
}
