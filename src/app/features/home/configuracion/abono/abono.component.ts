import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AbonoService, fechaAbono } from '../../../../core/services/abono.service';
import { AuthService } from '../../../auth/services/auth.service';

const NOMBRES_DE_PLAN = { gratis: 'Plan gratis', pago: 'Plan pago', interno: 'Sin cargo' } as const;

/** Lo que paga el taller, cuánto usó y cómo suscribirse (spec 2026-10-28 §7). */
@Component({
  selector: 'app-abono',
  standalone: false,
  templateUrl: './abono.component.html',
  styleUrl: './abono.component.scss',
})
export class AbonoComponent implements OnInit {
  private abono = inject(AbonoService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  readonly fecha = fechaAbono;
  readonly estado = this.abono.estado;
  readonly nombres = NOMBRES_DE_PLAN;

  correo = signal('');
  ocupado = signal(false);
  confirmando = signal(false);
  private volvioDeMp = signal(false);

  precio = computed(() => `$${(this.estado()?.precio_mensual ?? 0).toLocaleString('es-AR')}`);

  esperandoMp = computed(() => this.volvioDeMp() && this.estado()?.plan === 'gratis');

  puedeSuscribirse = computed(() => {
    const e = this.estado();
    if (!e || e.plan === 'interno' || e.pago_simulado || this.esperandoMp()) return false;
    if (e.preapproval_estado !== 'authorized') return true;
    // Autorizada: sólo con el cobro trabado se puede pagar de nuevo.
    return e.plan === 'pago' && e.estado !== 'al_dia';
  });

  /** También sin plan pago: si el primer cobro no sale, tiene que poder cancelar. */
  puedeVolver = computed(() => {
    const e = this.estado();
    return !!e && (e.plan === 'pago' || (e.plan === 'gratis' && e.preapproval_estado === 'authorized'));
  });

  ngOnInit(): void {
    this.correo.set(this.auth.currentUser()?.email ?? '');
    this.volvioDeMp.set(this.route.snapshot.queryParamMap.has('volver'));
    this.actualizar();
  }

  actualizar(): void {
    this.abono.refrescar().catch(() => undefined);
  }

  /** Aparte para poder probarlo: en un test, cambiar `location` recargaría la página. */
  irA(url: string): void {
    window.location.href = url;
  }

  private async conEspera(accion: () => Promise<void>): Promise<void> {
    this.ocupado.set(true);
    try {
      await accion();
    } catch {
      // El aviso de error lo da el interceptor.
    } finally {
      this.ocupado.set(false);
    }
  }

  suscribir(): Promise<void> {
    const correo = this.correo().trim();
    if (!correo) return Promise.resolve();
    return this.conEspera(async () => {
      const r = await this.abono.suscribir(correo);
      if (r.init_point) this.irA(r.init_point);
    });
  }

  simular(): Promise<void> {
    return this.conEspera(async () => {
      await this.abono.simularPago();
      await this.abono.refrescar();
    });
  }

  volverAGratis(): Promise<void> {
    return this.conEspera(async () => {
      await this.abono.volverAGratis();
      this.confirmando.set(false);
      await this.abono.refrescar();
    });
  }
}
