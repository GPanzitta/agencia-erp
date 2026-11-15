import { CanDeactivateFn } from '@angular/router';

/** Lo que el guard necesita: una pantalla que sabe si se puede ir (preguntando si hace falta). */
export interface ConCambiosSinGuardar {
  puedeSalir(): boolean | Promise<boolean>;
}

/**
 * Salir de una ficha con cambios sin guardar pregunta «Guardar / Descartar /
 * Seguir editando»; sin cambios deja salir en el acto. Genérico: lo usa la
 * ficha de clientes (la de órdenes tiene el suyo, `salirDeFichaGuard`).
 */
export const salirConCambiosGuard: CanDeactivateFn<ConCambiosSinGuardar> = (pantalla) => pantalla.puedeSalir();
