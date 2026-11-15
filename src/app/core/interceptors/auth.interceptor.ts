import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/** Origen del backend propio (API, archivos subidos y socket viven ahí). */
const ORIGEN_BACKEND = new URL(environment.apiUrl).origin;

/**
 * SEG-ERP-03: ¿este pedido va al backend propio? Se compara el ORIGEN ya
 * parseado, no un prefijo de texto: `https://api.com.atacante.com` empieza
 * igual que `https://api.com`. Una URL relativa es del propio ERP (assets),
 * no del backend.
 */
export function vaAlBackend(url: string): boolean {
  try {
    return new URL(url, window.location.origin).origin === ORIGEN_BACKEND;
  } catch {
    return false;
  }
}

/**
 * Pone el JWT en los pedidos al backend propio y en NINGÚN otro: antes iba en
 * cualquier pedido del HttpClient, así que una URL de Cloudinary, de Mercado
 * Libre o una que viniera en un dato se llevaba la sesión del empleado.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');

  if (token && vaAlBackend(req.url)) {
    const clonedReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(clonedReq);
  }

  return next(req);
};
