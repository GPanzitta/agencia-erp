/**
 * Teclado y gestos de las fichas (órdenes y clientes): cuándo ← → pasan de
 * registro y cuándo no. Sin Angular: se prueban solos.
 */

/**
 * ¿El evento viene de un lugar donde las flechas mueven el cursor? Ahí ← y →
 * no pasan de orden: el que tipea una dirección no quiere cambiar de ficha.
 */
export function esCampoDeTexto(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  const editable = el.getAttribute('contenteditable');
  return editable === '' || editable === 'true' || el.isContentEditable === true;
}

/**
 * ¿El evento viene de un menú desplegado (Imprimir)? Ahí las flechas recorren
 * sus opciones: ni ← → ni Alt+↑ ↓ cambian la orden de atrás.
 */
export function esMenu(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  return !!el.closest('[role="menu"], [role="menuitem"], [aria-haspopup="menu"][aria-expanded="true"]');
}

/**
 * ¿Hay un modal o diálogo abierto en la pantalla? Con uno encima, ← y → no
 * deben cambiar la orden que está detrás.
 */
export function hayModalAbierto(doc: Document = document): boolean {
  return !!doc.querySelector('.modal-overlay, [role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]');
}

/**
 * Deslizar sobre el encabezado de la ficha pasa de orden (spec §6): al menos
 * `umbral` px y más horizontal que vertical, para no pelear con el scroll.
 * Hacia la izquierda es la siguiente (como pasar una página).
 */
export function gestoHorizontal(dx: number, dy: number, umbral = 60): 'anterior' | 'siguiente' | null {
  if (Math.abs(dx) < umbral || Math.abs(dx) <= Math.abs(dy)) return null;
  return dx < 0 ? 'siguiente' : 'anterior';
}
