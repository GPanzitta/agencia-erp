/**
 * DAT-01: defensas de las exportaciones (pedido del dueño, 14/10/2026:
 * «proteger la integridad de los datos, tanto de la compañía como sobre todo
 * los de los CLIENTES»).
 */

/**
 * Una celda de texto que empieza con `=`, `@`, tab o retorno, o con `+`/`-`
 * seguido de algo que no es un número o un teléfono, se toma como fórmula si
 * alguien pasa la planilla por CSV o la reabre en otro programa (CSV/formula
 * injection: `=HYPERLINK(...)`, `=cmd|...`). Se le antepone un apóstrofo,
 * que es lo que recomienda OWASP. Los números siguen siendo números y
 * «+54 9 11 5555-1234» o «-15» no se tocan.
 */
export function celdaSegura<T>(valor: T): T | string {
  if (typeof valor !== 'string' || !valor) return valor;
  const primero = valor.charAt(0);
  if (primero === '=' || primero === '@' || primero === '\t' || primero === '\r') return `'${valor}`;
  if ((primero === '+' || primero === '-') && !/^[+-][\d\s().,-]*$/.test(valor)) return `'${valor}`;
  return valor;
}

/**
 * Antes de bajar datos a un archivo, que se vea cuántos registros salen de
 * la pantalla. Devuelve si el usuario aceptó. `preguntar` se reemplaza en los
 * tests.
 */
export function confirmarExportacion(
  cantidad: number,
  que: string,
  preguntar: (texto: string) => boolean = (t) => window.confirm(t),
): boolean {
  if (!cantidad) return false;
  return preguntar(
    `Vas a descargar ${cantidad} ${cantidad === 1 ? 'registro' : 'registros'} de ${que} a un archivo en esta computadora.\n\n` +
      'Guardalo en un lugar seguro y no lo compartas: tiene datos del taller y de sus clientes. ¿Seguimos?',
  );
}
