import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { NotificationService } from '../../../core/services/notification.service';
import { plata } from '../autos/autos.util';
import { PorMoneda, PorMonedaPct, RentabilidadService, TableroMargen } from './rentabilidad.service';
import {
  AtajoPeriodo, ROTULO_MOTIVO, ROTULO_ORIGEN, detalleDeRiesgo, monedaPrincipal, monedaSecundaria, pctTexto, periodoDe, textoPeriodo,
} from './rentabilidad.util';

const ATAJOS: { valor: AtajoPeriodo; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Este mes' },
  { valor: 'mes_pasado', rotulo: 'Mes pasado' },
  { valor: 'trimestre', rotulo: 'Últimos 90 días' },
  { valor: 'anio', rotulo: 'Este año' },
];

const suma = (v: PorMoneda[], m: 'ARS' | 'USD') => Math.round(v.reduce((s, x) => s + (x[m] ?? 0), 0) * 100) / 100;

/**
 * Rentabilidad (23/11/2026): el tablero del dueño. Qué deja cada auto, cuánto
 * se bajó del precio para cerrar, qué vendedor descuenta más y qué capital no
 * rota. No gestiona: controla. Es la pantalla de la segunda reunión.
 */
@Component({
  selector: 'app-rentabilidad',
  standalone: false,
  templateUrl: './rentabilidad.component.html',
  styleUrls: ['./rentabilidad.component.scss'],
})
export class RentabilidadComponent implements OnInit {
  private api = inject(RentabilidadService);
  private notification = inject(NotificationService);

  readonly plata = plata;
  readonly pct = pctTexto;
  readonly detalle = detalleDeRiesgo;
  readonly rotuloMotivo = ROTULO_MOTIVO;
  readonly rotuloOrigen = ROTULO_ORIGEN;
  readonly atajos = ATAJOS;

  datos = signal<TableroMargen | null>(null);
  cargando = signal(true);
  fallo = signal(false);
  atajo = signal<AtajoPeriodo | 'personalizado'>('mes');
  desde = signal('');
  hasta = signal('');

  /** Sin autos ni ventas no hay tablero: hay que cargar el primero. */
  vacio = computed(() => {
    const d = this.datos();
    return !!d && d.stock.unidades === 0 && d.ventas.operaciones === 0;
  });
  periodo = computed(() => (this.desde() && this.hasta() ? textoPeriodo(this.desde(), this.hasta()) : ''));

  ngOnInit(): void {
    const p = periodoDe('mes');
    this.desde.set(p.desde);
    this.hasta.set(p.hasta);
    this.cargar();
  }

  elegirAtajo(a: AtajoPeriodo): void {
    const p = periodoDe(a);
    this.atajo.set(a);
    this.desde.set(p.desde);
    this.hasta.set(p.hasta);
    this.cargar();
  }

  /** Escribir una fecha a mano deja de ser un atajo, pero no dispara una consulta por tecla. */
  cambiarFecha(cual: 'desde' | 'hasta', valor: string): void {
    (cual === 'desde' ? this.desde : this.hasta).set(valor);
    this.atajo.set('personalizado');
  }

  aplicar(): void {
    if (!this.desde() || !this.hasta()) {
      this.notification.error('Elegí las dos fechas del período.');
      return;
    }
    if (this.desde() > this.hasta()) {
      this.notification.error('El período termina antes de empezar.');
      return;
    }
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.fallo.set(false);
    this.api.tablero(this.desde(), this.hasta()).subscribe({
      next: (d) => { this.datos.set(d); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.fallo.set(true); },
    });
  }

  /** El número grande de una tarjeta, en la moneda que mueve la agencia. */
  monto(...v: PorMoneda[]): string {
    const m = monedaPrincipal(...v);
    return plata(suma(v, m), m);
  }

  /** «más $ 1.200.000», o vacío si la agencia no usa la otra moneda. */
  otra(...v: PorMoneda[]): string {
    const m = monedaPrincipal(...v);
    const o = monedaSecundaria(m, ...v);
    return o ? `más ${plata(suma(v, o), o)}` : '';
  }

  /** El porcentaje de la moneda que mueve la agencia. */
  pctDe(pcts: PorMonedaPct, ...montos: PorMoneda[]): string {
    const m = monedaPrincipal(...montos);
    return pctTexto(pcts[m]);
  }

  /** El ancho de la barra de cada tramo, contra el tramo más poblado. */
  ancho(cuantos: number): number {
    const mas = Math.max(1, ...(this.datos()?.antiguedad ?? []).map((t) => t.cuantos));
    return Math.round((cuantos / mas) * 100);
  }

  trackPorId(_: number, x: { id: string }): string { return x.id; }
  trackPorOrigen(_: number, x: { origen: string }): string { return x.origen; }
  trackPorNombre(_: number, x: { nombre: string; id: string | null }): string { return x.id ?? x.nombre; }
  trackPorRotulo(_: number, x: { rotulo: string }): string { return x.rotulo; }
}
