import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * DAT-04: cargar una URL de cero, no con el router. Al cerrar sesión, lo que
 * quedaba en memoria (signals de los servicios, listas de clientes y órdenes
 * ya bajadas, el rol del usuario anterior) se va con la página. Está aparte
 * para que los tests puedan reemplazarlo: una recarga de verdad tira Karma.
 */
@Injectable({ providedIn: 'root' })
export class RecargaService {
  private doc = inject(DOCUMENT);

  irDeCero(url: string): void {
    this.doc.location.assign(url);
  }
}

/**
 * DAT-04: vacía `localStorage` y `sessionStorage` del ERP (el token, el
 * borrador del armador de OC, la última actividad). Son de este origen: no
 * toca nada de otros sitios. En un navegador que no deja usarlos no se cae.
 */
export function vaciarAlmacenamiento(): void {
  try { localStorage.clear(); } catch { /* sin almacenamiento: nada que vaciar */ }
  try { sessionStorage.clear(); } catch { /* idem */ }
}
