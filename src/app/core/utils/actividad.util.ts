/**
 * DAT-05: dónde se guarda la última actividad del usuario (compartida entre
 * pestañas). Aparte del servicio para que AuthService la borre al limpiar la
 * sesión sin importar el servicio (que a su vez usa AuthService).
 */
export const CLAVE_ACTIVIDAD = 'gm-ultima-actividad';

export function leerUltimaActividad(): number {
  try {
    const n = Number(localStorage.getItem(CLAVE_ACTIVIDAD));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function guardarUltimaActividad(ms: number): void {
  try { localStorage.setItem(CLAVE_ACTIVIDAD, String(ms)); } catch { /* sin almacenamiento: vale la de memoria */ }
}

/**
 * Al limpiar la sesión: la actividad vieja no tiene que cerrar la próxima.
 * Si no, un token vencido al abrir la app dejaba guardada la de hace días y
 * el login siguiente se cerraba en el acto.
 */
export function olvidarUltimaActividad(): void {
  try { localStorage.removeItem(CLAVE_ACTIVIDAD); } catch { /* idem */ }
}
