import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { DeudaProveedor, FinanceService } from '../services/finance.service';
import { ProveedorService } from '../../proveedores/services/proveedor.service';
import { NotificationService } from '../../../../core/services/notification.service';

/**
 * Deuda agrupada por proveedor. El endpoint existía en el backend desde
 * siempre (`GET /expenses/cuentas-por-pagar`) y no había ninguna pantalla
 * que lo consumiera: no se podía saber a quién se le debe sin abrir gasto
 * por gasto.
 */
@Component({
  selector: 'app-cuentas-por-pagar',
  templateUrl: './cuentas-por-pagar.component.html',
  styleUrls: ['./cuentas-por-pagar.component.scss'],
})
export class CuentasPorPagarComponent implements OnInit, OnChanges {
  /** Contador que el tablero incrementa tras cada pago o anulación. */
  @Input() version = 0;

  /** Pide al tablero abrir el pago FIFO para este proveedor. */
  @Output() pagarDeuda = new EventEmitter<DeudaProveedor>();

  /** Pide al tablero abrir el alta de anticipo para este proveedor. */
  @Output() darAnticipo = new EventEmitter<DeudaProveedor>();

  /** Pide al tablero mostrar los gastos de este proveedor, filtrados. */
  @Output() verGastos = new EventEmitter<string>();

  private finance = inject(FinanceService);
  private proveedorService = inject(ProveedorService);
  private notification = inject(NotificationService);

  deudas = signal<DeudaProveedor[]>([]);
  isLoading = signal(false);

  /** Todos los proveedores: un anticipo puede ir a uno al que no se le debe nada. */
  proveedores = signal<{ id: string; nombre: string }[]>([]);
  proveedorAnticipo = signal('');

  totalDeuda = computed(() => this.deudas().reduce((s, d) => s + Number(d.deuda), 0));
  totalVencido = computed(() => this.deudas().reduce((s, d) => s + Number(d.vencido), 0));
  /** Lo que espera una firma: se ve aparte, no se puede pagar todavía. */
  totalSinAprobar = computed(() =>
    this.deudas().reduce((s, d) => s + Number(d.sin_aprobar ?? 0), 0));

  ngOnInit(): void {
    this.cargar();
    this.proveedorService.getProveedores().subscribe({
      next: (p: any[]) => this.proveedores.set(p.map((x) => ({ id: x.id, nombre: x.nombre }))),
      error: () => this.proveedores.set([]),
    });
  }

  /** Abre el modal de anticipo para el proveedor elegido en el selector. */
  anticipoElegido(): void {
    const id = this.proveedorAnticipo();
    if (!id) return;
    const prov = this.proveedores().find((p) => p.id === id);
    const fila = this.deudas().find((d) => d.proveedor_id === id);
    this.darAnticipo.emit(fila ?? ({
      proveedor_id: id,
      proveedor: prov?.nombre ?? 'Proveedor',
      comprobantes: 0, deuda: 0, vencido: 0, a_cuenta: 0,
    } as DeudaProveedor));
  }

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['version'] && !cambios['version'].firstChange) this.cargar();
  }

  cargar() {
    this.isLoading.set(true);
    this.finance.cuentasPorPagar().subscribe({
      next: (data) => {
        this.deudas.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Un proveedor que ya pasó su límite de crédito conviene mirarlo antes.
   * Cuenta lo que espera firma: la deuda sola ya no lo incluye. Si el backend
   * no manda el dato, se calcula con la misma regla.
   */
  excedeLimite(d: DeudaProveedor): boolean {
    if (d.excede_limite !== undefined) return d.excede_limite;
    return !!d.limite_credito &&
      Number(d.deuda) + Number(d.sin_aprobar ?? 0) > Number(d.limite_credito);
  }
}
