import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ClienteParecido } from '../../utils/clientes-duplicados.util';

/**
 * CLI-03: «¿Es alguno de estos?» antes de crear un cliente que parece repetido.
 * Un cliente cargado dos veces parte su historia y, peor, no ve la garantía
 * del equipo que trajo antes. El padre decide qué hace «Es este» (abrir la
 * ficha, elegirlo) y «Es otro» (crearlo igual).
 */
@Component({
  selector: 'app-aviso-duplicado',
  standalone: false,
  template: `
    <div class="ad" role="alert" *ngIf="parecidos.length || mostrar">
      <p class="ad-titulo" *ngIf="parecidos.length"><strong>¿Es alguno de estos?</strong> Ya hay clientes con el mismo teléfono, documento o correo.</p>
      <p class="ad-titulo" *ngIf="!parecidos.length"><strong>Puede que este cliente ya exista.</strong> Buscalo en la lista antes de crearlo de nuevo.</p>
      <ul class="ad-lista" *ngIf="parecidos.length">
        <li *ngFor="let p of parecidos; trackBy: porId">
          <span class="ad-nombre">{{ p.nombre }} {{ p.apellido || '' }}</span>
          <span class="gm-pill" *ngIf="p.activo === false">dado de baja</span>
          <small>{{ p.motivo }}<ng-container *ngIf="p.telefono"> · {{ p.telefono }}</ng-container></small>
          <button type="button" class="gm-btn gm-btn--brand gm-btn--sm" *ngIf="p.activo !== false || permitirBajas" (click)="usar.emit(p)">Es este</button>
          <small *ngIf="p.activo === false && !permitirBajas">si es este, pedile al admin que lo reactive</small>
        </li>
      </ul>
      <button type="button" class="gm-btn gm-btn--neutral gm-btn--sm" [disabled]="guardando" (click)="crearIgual.emit()">
        Es otro: crearlo igual
      </button>
    </div>
  `,
  styles: [`
    .ad { border: 1px solid var(--gm-object); background: #FFF6E5; border-radius: var(--gm-radius-lg); padding: .7rem .8rem; margin: .6rem 0; }
    .ad-titulo { margin: 0 0 .4rem; font-size: .9rem; }
    .ad-lista { list-style: none; margin: 0 0 .5rem; padding: 0; display: grid; gap: .35rem; }
    .ad-lista li { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; }
    .ad-nombre { font-weight: 700; }
    .ad-lista small { color: var(--gm-muted); flex: 1; min-width: 8rem; }
  `],
})
export class AvisoDuplicadoComponent {
  @Input() parecidos: ClienteParecido[] = [];
  @Input() guardando = false;
  /** El backend avisó del duplicado sin decir cuál: se muestra igual, sin lista. */
  @Input() mostrar = false;
  /** CLI-28: donde «Es este» elige al cliente (una venta), un dado de baja no se ofrece. */
  @Input() permitirBajas = true;
  @Output() usar = new EventEmitter<ClienteParecido>();
  @Output() crearIgual = new EventEmitter<void>();

  readonly porId = (_: number, p: ClienteParecido) => p.id;
}
