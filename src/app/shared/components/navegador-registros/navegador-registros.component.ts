import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';

export type DireccionRegistro = 'primera' | 'anterior' | 'siguiente' | 'ultima';

/**
 * El navegador de registros de las fichas (órdenes y clientes), con la
 * estética de los formularios de Windows que el taller ya conoce:
 * |◀ ◀ «título · n de N» ▶ ▶|. Sólo dibuja y avisa: quien lo usa decide
 * adónde lleva cada botón y qué está habilitado. En el celular lo oculta
 * quien lo usa (la barra fija de abajo tiene su ◀ ▶).
 */
@Component({
  selector: 'app-navegador-registros',
  standalone: true,
  imports: [NgIf],
  template: `
    <nav class="nr gm-card" [attr.aria-label]="rotulo">
      <button type="button" class="nr-btn" [attr.aria-label]="rotuloPrimera" title="Primera"
              [disabled]="!puedePrimera" (click)="ir.emit('primera')">|◀</button>
      <button type="button" class="nr-btn" aria-label="Anterior" title="Anterior (←)"
              [disabled]="!puedeAnterior" (click)="ir.emit('anterior')">◀</button>
      <div class="nr-centro">
        <strong class="nr-titulo">{{ titulo }}</strong>
        <span class="nr-pos">{{ posicion }}</span>
      </div>
      <button type="button" class="nr-btn" aria-label="Siguiente" title="Siguiente (→)"
              [disabled]="!puedeSiguiente" (click)="ir.emit('siguiente')">▶</button>
      <button type="button" class="nr-btn" [attr.aria-label]="rotuloUltima" title="Última"
              [disabled]="!puedeUltima" (click)="ir.emit('ultima')">▶|</button>
      <small class="nr-ayuda" *ngIf="ayuda">{{ ayuda }}</small>
    </nav>
  `,
  styles: [`
    :host { display: block; }
    .nr { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 12px; }
    .nr-btn {
      min-width: 40px; height: 34px; padding: 0 10px;
      border: 1px solid var(--gm-input-border); border-radius: var(--gm-radius);
      background: var(--gm-card); color: var(--gm-navy); font-weight: 700; cursor: pointer;
    }
    .nr-btn:hover:not(:disabled) { background: var(--gm-bg); }
    .nr-btn:disabled { opacity: .4; cursor: default; }
    .nr-btn:focus-visible { outline: 2px solid var(--gm-brand); outline-offset: 1px; }
    .nr-centro { display: flex; flex-direction: column; align-items: center; min-width: 190px; padding: 0 8px; }
    .nr-titulo { font-size: 16px; color: var(--gm-navy); font-variant-numeric: tabular-nums; text-align: center; overflow-wrap: anywhere; }
    .nr-pos { font-size: 12px; color: var(--gm-muted); }
    .nr-ayuda { margin-left: 8px; color: var(--gm-muted); font-size: 11.5px; }
  `],
})
export class NavegadorRegistrosComponent {
  /** El `aria-label` del `<nav>` («Recorrer las órdenes del filtro»). */
  @Input() rotulo = 'Recorrer los registros';
  @Input() titulo = '';
  /** «n de N», «fuera del filtro · N en el filtro»… */
  @Input() posicion = '';
  @Input() ayuda = '';
  @Input() rotuloPrimera = 'Primera';
  @Input() rotuloUltima = 'Última';
  @Input() puedePrimera = false;
  @Input() puedeAnterior = false;
  @Input() puedeSiguiente = false;
  @Input() puedeUltima = false;
  @Output() ir = new EventEmitter<DireccionRegistro>();
}
