import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { catchError, switchMap } from 'rxjs/operators';
import { from, Observable, of, throwError } from 'rxjs';

import { interpretarError } from '../errores/mensajes.util';
import { AuthService } from '../../features/auth/services/auth.service';
import { AuthStatus } from '../interfaces/auth.interface';
import { SIN_AVISO_DE_ERROR } from './sin-aviso.token';

export { SIN_AVISO_DE_ERROR };

/** El login y el logout resuelven su propio 401: ahí no hay sesión que cerrar. */
function esDeLaSesion(req: HttpRequest<unknown>): boolean {
  return /\/auth\/(login|logout)$/.test(req.url.split('?')[0]);
}

/**
 * Un pedido con `responseType: 'blob'` (los PDF) recibe el cuerpo del error
 * como Blob: se lee y, si es JSON, se vuelve el objeto que `interpretarError`
 * espera (con su `code`). Si no es JSON, queda el Blob y sale el aviso genérico.
 */
function conCuerpoLegible(error: HttpErrorResponse): Observable<HttpErrorResponse> {
  if (!(error.error instanceof Blob)) return of(error);
  return from(error.error.text()).pipe(
    switchMap((texto) => {
      try {
        return of(new HttpErrorResponse({ error: JSON.parse(texto), headers: error.headers, status: error.status, statusText: error.statusText, url: error.url ?? undefined }));
      } catch {
        return of(error);
      }
    }),
    catchError(() => of(error)),
  );
}

/**
 * Convierte cualquier error del backend en un aviso que se entiende.
 *
 * Antes mostraba el `message` crudo de NestJS: el operario leía códigos
 * internos y mensajes de class-validator en inglés. Ahora la traducción la
 * decide `interpretarError` (util puro y testeado) y acá solo se dibuja.
 *
 * Cuando el error tiene una salida en otra pantalla, el toast se vuelve
 * clickeable y lleva ahí: es lo que convierte un callejón sin salida en un
 * paso más.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toastr = inject(ToastrService);
  const router = inject(Router);
  const injector = inject(Injector);

  const avisar = (error: HttpErrorResponse): Observable<never> => {
    const mensaje = interpretarError(error);

    const detalle = mensaje.accion
      ? `${mensaje.detalle}

Tocá este aviso para ${mensaje.accion.texto.toLowerCase()}.`
      : mensaje.detalle;

    const toast = toastr.error(detalle, mensaje.titulo, {
      // Un mensaje con instrucciones necesita más tiempo que el default.
      timeOut: mensaje.accion ? 12000 : 8000,
      enableHtml: false,
      // Siempre true: si el toast tiene acción, tocarlo navega Y lo cierra
      // (ngx-toastr solo remueve el toast en tapToast() cuando
      // tapToDismiss es true — con false, el aviso queda flotando encima
      // de la pantalla a la que el propio toque acaba de llevar).
      tapToDismiss: true,
    });

    if (mensaje.accion && toast) {
      toast.onTap.subscribe(() => router.navigateByUrl(mensaje.accion!.ruta));
    }

    return throwError(() => error);
  };

  /**
   * CLI-04: un 401 fuera del login es una sesión que ya no vale (vencida, rol
   * cambiado, usuario dado de baja, sesión cerrada en otro equipo). Se limpia
   * la del navegador y se va al login. Devuelve false si la sesión ya estaba
   * cerrada: los 401 de los otros pedidos en vuelo no repiten el aviso.
   * `AuthService` se pide recién acá, porque él mismo hace pedidos al crearse.
   */
  const perderSesion = (): boolean => {
    let auth: AuthService | null = null;
    try {
      auth = injector.get(AuthService, null);
    } catch {
      auth = null; // sin HttpClient (un test aislado): queda el aviso de siempre
    }
    if (!auth) return true;
    const estaba = auth.authStatus() === AuthStatus.authenticated;
    auth.cerrarSesionLocal();
    if (estaba) router.navigateByUrl('/auth/login');
    return estaba;
  };

  return next(req).pipe(
    catchError((original: HttpErrorResponse) => {
      // SEG-54: con la clave provisoria del reseteo el backend responde 403
      // DEBE_CAMBIAR_CLAVE a todo menos al cambio. Sin aviso (serían varios,
      // uno por pedido en vuelo): se va directo a la pantalla de cambio.
      if (original?.status === 403 && original?.error?.code === 'DEBE_CAMBIAR_CLAVE') {
        if (!String(router.url ?? '').startsWith('/cambiar-clave')) router.navigateByUrl('/cambiar-clave');
        return throwError(() => original);
      }
      if (original?.status === 401 && !esDeLaSesion(req)) {
        // El aviso sale una sola vez, aunque el pedido fuera «sin aviso»:
        // es lo único que le explica al operario por qué volvió al login.
        if (!perderSesion()) return throwError(() => original);
        return conCuerpoLegible(original).pipe(switchMap(avisar));
      }
      if (req.context.get(SIN_AVISO_DE_ERROR)) return throwError(() => original);
      return conCuerpoLegible(original).pipe(switchMap(avisar));
    }),
  );
};
