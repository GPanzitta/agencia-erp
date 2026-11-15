import {
  AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, inject,
} from '@angular/core';
import { EleccionSalida } from '../../utils/pregunta-salida';

/**
 * El diálogo «Tenés cambios sin guardar» de las fichas. El foco arranca en
 * «Seguir editando» (lo seguro), Tab no sale del diálogo y Escape es
 * «Seguir editando». La lógica (qué pasa con cada elección) es
 * `PreguntaDeSalida`; quien lo usa lo monta con `*ngIf` mientras haya pregunta.
 */
@Component({
  selector: 'app-pregunta-salida',
  standalone: true,
  template: `
    <div class="ps-fondo">
      <div class="ps-dialogo gm-card" role="dialog" aria-modal="true" aria-labelledby="ps-titulo">
        <h3 id="ps-titulo">Tenés cambios sin guardar</h3>
        <p>Cambios sin guardar: {{ detalle }}</p>
        <div class="ps-pie">
          <button #seguir type="button" class="gm-btn ps-seguir" (click)="elegir.emit('seguir')">Seguir editando</button>
          <button type="button" class="gm-btn gm-btn--neutral ps-descartar" (click)="elegir.emit('descartar')">Descartar</button>
          <button type="button" class="gm-btn gm-btn--brand ps-guardar" (click)="elegir.emit('guardar')">Guardar</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ps-fondo {
      position: fixed; inset: 0; z-index: 300;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.45); padding: 16px;
    }
    .ps-dialogo { width: min(440px, 100%); padding: 16px 18px; }
    .ps-dialogo h3 { margin: 0 0 6px; font-size: 16px; color: var(--gm-navy); }
    .ps-dialogo p { margin: 0 0 14px; font-size: 13px; color: var(--gm-text-2); overflow-wrap: anywhere; }
    .ps-pie { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
    @media (max-width: 1023px) { .ps-pie .gm-btn { min-height: 44px; } }
  `],
})
export class PreguntaSalidaComponent implements AfterViewInit {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** «teléfono, correo»: lo que se perdería. */
  @Input() detalle = '';
  @Output() elegir = new EventEmitter<EleccionSalida>();

  @ViewChild('seguir') private seguir?: ElementRef<HTMLButtonElement>;

  ngAfterViewInit(): void {
    this.seguir?.nativeElement.focus();
  }

  @HostListener('document:keydown', ['$event'])
  alTeclado(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.elegir.emit('seguir');
      return;
    }
    if (e.key === 'Tab') this.atraparTab(e);
  }

  /** Tab y Shift+Tab dan la vuelta entre los tres botones (y traen el foco si se escapó). */
  private atraparTab(e: KeyboardEvent): void {
    const botones = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('button'));
    if (!botones.length) return;
    e.preventDefault();
    const i = botones.indexOf(document.activeElement as HTMLElement);
    const destino = i < 0 ? 0 : (i + (e.shiftKey ? -1 : 1) + botones.length) % botones.length;
    botones[destino].focus();
  }
}
