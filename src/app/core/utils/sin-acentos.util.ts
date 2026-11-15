/**
 * COPIA del criterio del backend (`taller-backend/src/repair-orders/
 * busqueda-ordenes.util.ts`, `sinAcentos`): minúsculas, el mismo mapa fijo de
 * acentos (no NFD: lo que el mapa no cubre tampoco lo cubre el `translate`
 * de Postgres, y así los dos lados encuentran exactamente lo mismo) y los
 * espacios repetidos colapsados. No se toca de un lado sin tocar el otro.
 *
 * La puntuación se conserva (un correo o un teléfono con guiones se comparan
 * tal cual): para códigos de repuesto está `normalizarTexto`, que es otra cosa.
 */
const CON_ACENTO = 'áéíóúàèìòùäëïöüâêîôûñçãõ';
const SIN_ACENTO = 'aeiouaeiouaeiouaeiouncao';

export function sinAcentos(valor: string | null | undefined): string {
  let r = '';
  for (const ch of String(valor ?? '').toLowerCase()) {
    const i = CON_ACENTO.indexOf(ch);
    r += i >= 0 ? SIN_ACENTO[i] : ch;
  }
  return r.replace(/\s+/g, ' ');
}

/**
 * «Juan Perez», «Perez Juan», «perez» y «pérez» pegan todos con Juan Pérez.
 * Misma concatenación que el SQL (`nombre || ' ' || apellido` y al revés).
 */
export function coincideNombre(
  nombre: string | null | undefined,
  apellido: string | null | undefined,
  termino: string,
): boolean {
  const q = sinAcentos(termino).trim();
  if (!q) return true;
  const completo = sinAcentos(`${nombre ?? ''} ${apellido ?? ''}`).trim();
  const invertido = sinAcentos(`${apellido ?? ''} ${nombre ?? ''}`).trim();
  return completo.includes(q) || invertido.includes(q);
}
