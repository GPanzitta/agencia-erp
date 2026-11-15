import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FinanceService } from '../services/finance.service';
import { NotificationService } from '../../../../core/services/notification.service';

interface Tramo {
  clave: string;
  titulo: string;
  descripcion: string;
  color: string;
  fondo: string;
}

/**
 * Qué hay que pagar y cuándo, agrupado por urgencia. El backend ya devolvía
 * esto agrupado en cuatro tramos (`GET /expenses/vencimientos`); no existía
 * pantalla que lo mostrara.
 */
@Component({
  selector: 'app-vencimientos',
  templateUrl: './vencimientos.component.html',
  styleUrls: ['./vencimientos.component.scss'],
})
export class VencimientosComponent implements OnInit, OnChanges {
  /**
   * Contador que el tablero incrementa tras cada pago o anulación. Sin esto,
   * pagar desde acá dejaba la lista mostrando el estado anterior.
   */
  @Input() version = 0;

  /** Pide al tablero abrir su modal de pago para este gasto. */
  @Output() pagar = new EventEmitter<any>();

  private finance = inject(FinanceService);
  private notification = inject(NotificationService);

  datos = signal<Record<string, { total: number; gastos: any[] }>>({});
  isLoading = signal(false);
  dias = signal(30);

  /** El orden importa: lo más urgente primero. */
  tramos: Tramo[] = [
    { clave: 'vencido', titulo: 'Vencido', descripcion: 'Ya pasó la fecha y sigue impago', color: 'var(--gm-error)', fondo: 'var(--gm-error-bg)' },
    { clave: 'hoy', titulo: 'Vence hoy', descripcion: 'Hay que pagarlo hoy', color: 'var(--alerta)', fondo: 'rgba(245, 158, 11, 0.14)' },
    { clave: 'proximo', titulo: 'Próximos', descripcion: 'Dentro del período elegido', color: 'var(--gm-brand)', fondo: 'rgba(59, 130, 246, 0.12)' },
    { clave: 'futuro', titulo: 'Más adelante', descripcion: 'Fuera del período elegido', color: 'var(--gm-text-2)', fondo: 'var(--gm-bg)' },
  ];

  ngOnInit(): void {
    this.cargar();
  }

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['version'] && !cambios['version'].firstChange) this.cargar();
  }

  /**
   * Solo se puede pagar lo que tiene saldo y está aprobado: un pendiente de
   * firma aparece en la lista (para ver lo que viene) pero el backend
   * rechaza pagarlo.
   */
  puedePagar(g: any): boolean {
    return Number(g?.pendiente ?? 0) > 0 && !g?.requiere_firma;
  }

  /**
   * El endpoint devuelve una proyección ({total, pendiente}); el modal de
   * pago del tablero espera la forma de un Gasto. Se traduce acá para no
   * acoplar el tablero a esta proyección.
   */
  emitirPago(g: any): void {
    this.pagar.emit({
      id: g.id,
      numero_gasto: g.numero_gasto,
      descripcion: g.descripcion,
      monto: Number(g.total),
      monto_pagado: Number(g.total) - Number(g.pendiente),
    });
  }

  cargar() {
    this.isLoading.set(true);
    this.finance.vencimientos(this.dias()).subscribe({
      next: (data) => {
        this.datos.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  cambiarDias(valor: string) {
    const n = Number(valor);
    if (Number.isFinite(n) && n > 0) {
      this.dias.set(n);
      this.cargar();
    }
  }

  tramoDatos(clave: string) {
    return this.datos()[clave] ?? { total: 0, gastos: [] };
  }
}
