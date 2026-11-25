import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

import { Billetera, FotoOperacion, MedioPago, Moneda, Operacion, Unidad } from './autos.service';
import { ROTULO_MEDIO, fecha, plata } from './autos.util';
import { urlFoto } from '../../../core/utils/foto-url.util';

export interface PagoEnCarga {
  medio: MedioPago; monto: string; moneda: Moneda; tipo_cambio: string; wallet_id: string; detalle: string;
  toma: { dominio: string; marca: string; modelo: string; anio: string; km: string };
}

/**
 * La venta de la unidad dentro de su ficha (diseño del 12/11/2026): la cuenta
 * (precio, cobrado, saldo), los pagos, y cobrar, cerrar o anular. No habla con
 * la API: la ficha es la que pide y le pasa el resultado.
 */
@Component({
  selector: 'app-unidad-venta',
  standalone: false,
  // Vive adentro de la ficha, que ya trae su margen.
  host: { style: 'padding: 0' },
  templateUrl: './unidad-venta.component.html',
  styleUrls: ['./unidad-ficha.component.scss'],
})
export class UnidadVentaComponent {
  @Input({ required: true }) o!: Operacion;
  @Input({ required: true }) u!: Unidad;
  @Input() billeteras: Billetera[] = [];
  @Input() ocupado = false;
  @Input() esDuenio = false;
  @Input() panel = '';
  @Input({ required: true }) pago!: PagoEnCarga;
  @Input({ required: true }) cierre!: { comision: string };
  @Input({ required: true }) anulacion!: { motivo: string };

  @Output() abrirPanel = new EventEmitter<'pago' | 'cerrar' | 'anular'>();
  @Output() pagar = new EventEmitter<void>();
  @Output() quitarPago = new EventEmitter<string>();
  @Output() cerrar = new EventEmitter<void>();
  @Output() anular = new EventEmitter<void>();
  /** Imprimir el recibo de un pago (lleva su id), el boleto de compraventa, el acta de entrega o la Orden de Venta (OV) con QR. */
  @Output() recibo = new EventEmitter<string>();
  @Output() boleto = new EventEmitter<void>();
  @Output() actaEntrega = new EventEmitter<void>();
  @Output() ordenVenta = new EventEmitter<void>();
  @Output() verQrOv = new EventEmitter<void>();
  @Output() subirFotosOv = new EventEmitter<{ archivos: File[]; nota: string; etapa: string }>();
  @Output() borrarFotoOv = new EventEmitter<string>();

  readonly rotuloMedio = ROTULO_MEDIO;
  readonly medios = Object.entries(ROTULO_MEDIO) as [MedioPago, string][];
  readonly plata = plata;
  readonly fecha = fecha;
  readonly foto = urlFoto;

  notaFotoOv = '';
  etapaFotoOv = 'reserva';
  fotoOvAmpliada = signal<FotoOperacion | null>(null);

  alElegirFotosOv(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []).filter((a) => a.type.startsWith('image/'));
    input.value = '';
    if (!archivos.length) return;
    this.subirFotosOv.emit({ archivos, nota: this.notaFotoOv.trim(), etapa: this.etapaFotoOv });
    this.notaFotoOv = '';
  }

  /** Cuánto de la cuenta está cubierto, de 0 a 100, para la barra. */
  get cubierto(): number {
    if (!this.o.precio) return 0;
    return Math.max(0, Math.min(100, Math.round((this.o.pagado / this.o.precio) * 100)));
  }

  /** Por qué no se puede cerrar todavía, o null si se puede. */
  get freno(): string | null {
    if (!this.o.saldada) return `Faltan cobrar ${plata(this.o.saldo, this.o.moneda)}.`;
    if (this.o.bloqueantes.length) return `Falta ${this.o.bloqueantes.join(', ')}.`;
    return null;
  }

  /** Una caja no mezcla monedas: sólo se ofrecen las de la moneda del pago. */
  get cajasDelPago(): Billetera[] {
    return this.billeteras.filter((b) => (b.moneda ?? 'ARS') === this.pago.moneda);
  }

  trackPorId(_: number, x: { id: string }): string { return x.id; }
}
