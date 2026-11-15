/**
 * CLI-13: copia de `whatsappArgentino` del backend (`common/whatsapp.util.ts`),
 * con los mismos casos de test. El número de WhatsApp de Argentina en formato
 * E.164 sin el `+` (`5491133313834`), que es lo único que `wa.me` entiende.
 *
 * Antes Avisos y la ficha del cliente hacían «54 + dígitos»: «1144445555»
 * salía `wa.me/541144445555` (sin el 9 del celular) y «01133313834» salía
 * `wa.me/5401133313834`, mientras el botón de la OS (que arma el backend) andaba.
 *
 * Reglas, en orden:
 * - sólo dígitos; un `00` internacional adelante se descarta;
 * - `549…` ya está bien;
 * - `54…` sin el 9: se le agrega, si lo que queda es un número nacional;
 * - se saca el 0 del código de área;
 * - si después de un área de 2 a 4 dígitos viene el 15 del celular y sacarlo
 *   deja 10 dígitos, se saca (`011 15 3331 3834` → `11 3331 3834`);
 * - 10 dígitos nacionales → `549` adelante.
 *
 * Cualquier otra cosa sale como vino (sólo dígitos): un número de afuera o
 * uno incompleto no se adivina.
 */
export function whatsappArgentino(telefono: string | null | undefined): string | null {
  let digitos = String(telefono ?? '').replace(/\D/g, '');
  if (digitos.startsWith('00')) digitos = digitos.slice(2);
  if (!digitos) return null;
  if (digitos.startsWith('549')) return digitos;
  // Ningún código de área argentino empieza con 5: un 54 adelante es el país.
  const nacional = nacionalDeDiez(digitos.startsWith('54') ? digitos.slice(2) : digitos);
  return nacional ? `549${nacional}` : digitos;
}

/** El número nacional de 10 dígitos (área + abonado, sin 0 ni 15), o null si no se llega. */
function nacionalDeDiez(numero: string): string | null {
  const sinCero = numero.startsWith('0') ? numero.slice(1) : numero;
  if (sinCero.length === 10) return sinCero;
  if (sinCero.length === 12) {
    for (let area = 2; area <= 4; area++) {
      if (sinCero.slice(area, area + 2) === '15') return sinCero.slice(0, area) + sinCero.slice(area + 2);
    }
  }
  return null;
}

/** `https://wa.me/<número>` con el texto, o null si no hay teléfono. */
export function linkWhatsappArgentino(telefono: string | null | undefined, texto?: string): string | null {
  const numero = whatsappArgentino(telefono);
  if (!numero) return null;
  return `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}
