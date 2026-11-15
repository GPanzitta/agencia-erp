import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * SEG-54: el mismo largo que el backend (`LARGO_MINIMO_CLAVE` y
 * `LARGO_MAXIMO_CLAVE` de `auth/clave.util.ts`). 10 como mínimo para las
 * altas y los cambios; las claves que ya existen siguen andando.
 */
export const LARGO_MINIMO_CLAVE = 10;
export const LARGO_MAXIMO_CLAVE = 72;

/** La clave nueva, escrita dos veces igual (`nueva` y `repetida` del grupo). */
export function clavesIguales(grupo: AbstractControl): ValidationErrors | null {
  const nueva = grupo.get('nueva')?.value ?? '';
  const repetida = grupo.get('repetida')?.value ?? '';
  return repetida && nueva !== repetida ? { distintas: true } : null;
}
