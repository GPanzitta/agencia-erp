/**
 * SEG-ERP-05: la única puerta para abrir en otra pestaña una URL que no arma
 * Angular (WhatsApp que manda el backend, el PDF de un adjunto, una foto).
 *
 * - Sólo http(s) absoluto. `window.open('javascript:…')` corre el código en
 *   una pestaña con el origen del ERP (y el token en localStorage); `data:` o
 *   `blob:` ajenos tampoco tienen nada que hacer acá.
 * - `noopener`: la pestaña nueva no recibe `window.opener` y no puede
 *   redirigir al ERP a una copia falsa del login (tabnabbing).
 *
 * Devuelve si la abrió. Con `noopener`, `window.open` devuelve null aunque
 * la abra: no sirve para saber si el bloqueador la frenó.
 */
export function urlExterna(url: string | null | undefined): string | null {
  const texto = String(url ?? '').trim();
  if (!/^https?:\/\//i.test(texto)) return null;
  try {
    const u = new URL(texto);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

export function abrirExterna(url: string | null | undefined): boolean {
  const segura = urlExterna(url);
  if (!segura) return false;
  window.open(segura, '_blank', 'noopener');
  return true;
}
