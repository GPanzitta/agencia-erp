import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, NgZone, OnDestroy, effect, inject, untracked } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthStatus } from '../interfaces/auth.interface';
import { AuthService } from '../../features/auth/services/auth.service';
import { RecargaService } from './recarga.service';
import { CLAVE_ACTIVIDAD, guardarUltimaActividad as guardar, leerUltimaActividad as leerGuardada } from '../utils/actividad.util';

/**
 * DAT-05: cierre de sesión por inactividad.
 *
 * - La última actividad (mouse, teclado, toque, scroll) se guarda en
 *   `localStorage` y se comparte entre pestañas con el evento `storage`:
 *   trabajar en una pestaña mantiene viva la sesión en todas.
 * - Pasado el límite (`environment.inactividadHoras`, 8 h por defecto) se
 *   cierra la sesión con el logout de siempre (avisa al backend, vacía el
 *   almacenamiento y recarga en el login: DAT-04).
 * - También se controla al abrir la app: si la última actividad guardada ya
 *   venció (la compu quedó prendida el fin de semana), se cierra ahí mismo.
 * - Si otra pestaña cierra la sesión (el token desaparece del
 *   `localStorage`), esta también vuelve al login.
 *
 * Los eventos del mouse se escuchan FUERA de NgZone y la escritura va con
 * throttle: moverlo no dispara change detection ni escribe a cada píxel.
 * Sólo se vuelve a la zona para cerrar la sesión.
 */
export { CLAVE_ACTIVIDAD };

const HORA_MS = 3_600_000;

export function limiteDeEntorno(horas: unknown = (environment as { inactividadHoras?: unknown }).inactividadHoras): number {
  const h = Number(horas);
  return (Number.isFinite(h) && h > 0 ? h : 8) * HORA_MS;
}

/** El límite en ms. Los tests lo achican; la app lo toma del environment. */
export const LIMITE_INACTIVIDAD_MS = new InjectionToken<number>('LIMITE_INACTIVIDAD_MS', {
  providedIn: 'root',
  factory: () => limiteDeEntorno(),
});

/** Cada cuánto, como mucho, se anota la actividad (y se avisa a las otras pestañas). */
export const THROTTLE_ACTIVIDAD_MS = 15_000;
/** Cada cuánto se mira si ya venció. */
export const CONTROL_INACTIVIDAD_MS = 60_000;

const EVENTOS_DE_ACTIVIDAD = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

@Injectable({ providedIn: 'root' })
export class InactividadService implements OnDestroy {
  private zone = inject(NgZone);
  private doc = inject(DOCUMENT);
  private auth = inject(AuthService);
  private recarga = inject(RecargaService);
  readonly limiteMs = inject(LIMITE_INACTIVIDAD_MS);

  /** La última actividad que se conoce: la propia o la de otra pestaña. */
  private ultima = 0;
  private ultimaEscritura = 0;
  private intervalo: ReturnType<typeof setInterval> | null = null;
  private quitarEscuchas: (() => void)[] = [];
  private cerrando = false;

  constructor() {
    // Se prende con la sesión confirmada y se apaga al cerrarla.
    effect(() => {
      const conSesion = this.auth.authStatus() === AuthStatus.authenticated;
      untracked(() => (conSesion ? this.encender() : this.apagar()));
    });
  }

  ngOnDestroy(): void {
    this.apagar();
  }

  /** ¿Venció? Expuesto para los tests y para quien quiera preguntar. */
  vencida(ahora = Date.now()): boolean {
    const ultima = Math.max(this.ultima, leerGuardada());
    return ultima > 0 && ahora - ultima >= this.limiteMs;
  }

  private encender(): void {
    if (this.intervalo !== null) return;
    this.cerrando = false;
    // Al abrir la app: la guardada manda. Si ya venció, se cierra sin esperar.
    this.ultima = leerGuardada();
    if (this.vencida()) {
      this.cerrarPorInactividad();
      return;
    }
    this.anotar(Date.now(), true);

    this.zone.runOutsideAngular(() => {
      const alActuar = () => this.anotar(Date.now());
      for (const ev of EVENTOS_DE_ACTIVIDAD) {
        this.doc.addEventListener(ev, alActuar, { capture: true, passive: true });
        this.quitarEscuchas.push(() => this.doc.removeEventListener(ev, alActuar, { capture: true }));
      }
      const alVolver = () => { if (this.doc.visibilityState === 'visible') this.controlar(); };
      this.doc.addEventListener('visibilitychange', alVolver);
      this.quitarEscuchas.push(() => this.doc.removeEventListener('visibilitychange', alVolver));

      const ventana = this.doc.defaultView;
      if (ventana) {
        const alCambiarOtraPestana = (e: StorageEvent) => this.alCambiarAlmacenamiento(e);
        ventana.addEventListener('storage', alCambiarOtraPestana);
        this.quitarEscuchas.push(() => ventana.removeEventListener('storage', alCambiarOtraPestana));
      }
      this.intervalo = setInterval(() => this.controlar(), CONTROL_INACTIVIDAD_MS);
    });
  }

  private apagar(): void {
    if (this.intervalo !== null) clearInterval(this.intervalo);
    this.intervalo = null;
    this.quitarEscuchas.forEach((q) => q());
    this.quitarEscuchas = [];
  }

  /** Throttle: en memoria siempre; al almacenamiento, como mucho cada THROTTLE_ACTIVIDAD_MS. */
  private anotar(ahora: number, forzar = false): void {
    this.ultima = Math.max(this.ultima, ahora);
    if (forzar || ahora - this.ultimaEscritura >= THROTTLE_ACTIVIDAD_MS) {
      this.ultimaEscritura = ahora;
      guardar(this.ultima);
    }
  }

  private alCambiarAlmacenamiento(e: StorageEvent): void {
    if (e.key === CLAVE_ACTIVIDAD) {
      const n = Number(e.newValue);
      if (Number.isFinite(n) && n > this.ultima) this.ultima = n;
      return;
    }
    // Otra pestaña cerró la sesión (logout vacía todo, o se fue el token).
    if (e.key === null || (e.key === 'token' && e.newValue === null)) {
      this.zone.run(() => {
        this.apagar();
        this.auth.cerrarSesionLocal();
        this.recarga.irDeCero('/auth/login');
      });
    }
  }

  private controlar(): void {
    if (this.vencida()) this.cerrarPorInactividad();
  }

  private cerrarPorInactividad(): void {
    if (this.cerrando) return;
    this.cerrando = true;
    this.zone.run(() => {
      this.apagar();
      this.auth.logout();
    });
  }
}
