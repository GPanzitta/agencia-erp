import {
  Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges,
  inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { IconComponent } from '../icon/icon.component';
import { RepartidorDisponible, RepartidoresService } from '../../services/repartidores.service';

/**
 * Selector de repartidor para un pedido de delivery.
 *
 * Cubre los dos momentos en que hace falta, porque son el mismo gesto para
 * quien despacha:
 *
 * - Pedido **pendiente**: se elige quién sale y se lo despacha en una sola
 *   acción (`POST /sales/:id/en-camino` con el `repartidor_id`).
 * - Pedido **en camino**: se puede cambiar el repartidor asignado
 *   (`PATCH /sales/:id/repartidor`). Pasa de verdad — se rompe una moto y sale
 *   otro. Al cambiarlo, el backend borra la última posición conocida, así que
 *   se avisa en pantalla antes de confirmar.
 *
 * Se puede despachar sin elegir a nadie: el pedido sale igual, pero sin
 * repartidor asignado no hay seguimiento en el mapa. Eso también se dice, en
 * vez de dejar que el cliente descubra un mapa vacío.
 */
@Component({
  selector: 'app-repartidor-selector',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './repartidor-selector.component.html',
  styleUrls: ['./repartidor-selector.component.scss'],
})
export class RepartidorSelectorComponent implements OnInit, OnChanges {
  private http = inject(HttpClient);
  private api = inject(RepartidoresService);
  private base = environment.apiUrl;

  @Input({ required: true }) saleId!: string;
  @Input({ required: true }) estado!: string;
  /** Id del repartidor ya asignado, si lo hay. */
  @Input() repartidorId?: string | null;
  @Input() repartidorNombre?: string | null;
  /** `true` en pantallas angostas (tarjetas), `false` en tablas. */
  @Input() compacto = false;

  /** El pedido cambió: la pantalla que lo contiene debería recargar. */
  @Output() cambiado = new EventEmitter<void>();

  repartidores = signal<RepartidorDisponible[]>([]);
  elegido = signal<string>('');
  guardando = signal(false);
  error = signal<string | null>(null);
  confirmandoCambio = signal(false);

  ngOnInit(): void {
    this.elegido.set(this.repartidorId ?? '');
    this.api.listar().subscribe((l) => this.repartidores.set(l));
  }

  /**
   * La pantalla que contiene al selector recarga la lista de pedidos y Angular
   * reusa la misma instancia del componente con otro `@Input`. Sin esto, el
   * `<select>` seguía mostrando el valor viejo después de guardar: el backend
   * había asignado bien y la pantalla decía "Sin asignar".
   */
  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['repartidorId'] && !cambios['repartidorId'].firstChange) {
      this.elegido.set(this.repartidorId ?? '');
      this.confirmandoCambio.set(false);
    }
  }

  get esPendiente(): boolean {
    return this.estado === 'pendiente';
  }

  get esEnCamino(): boolean {
    return this.estado === 'en_camino';
  }

  /** En "en camino", cambiar el select no aplica nada hasta confirmar. */
  alElegir(valor: string): void {
    this.elegido.set(valor);
    this.error.set(null);
    this.confirmandoCambio.set(this.esEnCamino && valor !== (this.repartidorId ?? ''));
  }

  despachar(): void {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.error.set(null);

    const cuerpo = this.elegido() ? { repartidor_id: this.elegido() } : {};
    this.http.post(`${this.base}/sales/${this.saleId}/en-camino`, cuerpo).subscribe({
      next: () => { this.guardando.set(false); this.cambiado.emit(); },
      error: (e) => {
        this.guardando.set(false);
        this.error.set(e?.error?.message ?? 'No se pudo despachar el pedido');
      },
    });
  }

  confirmarCambio(): void {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.error.set(null);

    // `null` explícito para desasignar: el backend distingue "sacale el
    // repartidor" de "no me mandaron el campo".
    const cuerpo = { repartidor_id: this.elegido() || null };
    this.http.patch(`${this.base}/sales/${this.saleId}/repartidor`, cuerpo).subscribe({
      next: () => {
        this.guardando.set(false);
        this.confirmandoCambio.set(false);
        this.cambiado.emit();
      },
      error: (e) => {
        this.guardando.set(false);
        this.error.set(e?.error?.message ?? 'No se pudo cambiar el repartidor');
      },
    });
  }

  cancelarCambio(): void {
    this.elegido.set(this.repartidorId ?? '');
    this.confirmandoCambio.set(false);
    this.error.set(null);
  }

  nombreDe(id: string): string {
    return this.repartidores().find((r) => r.id === id)?.nombre ?? '';
  }
}
