import { Component, Input, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export type IconName =
  | 'agregar' | 'cerrar' | 'editar' | 'borrar' | 'recargar' | 'buscar'
  | 'check' | 'alerta' | 'info' | 'flecha-izq' | 'flecha-der' | 'chevron'
  | 'usuario' | 'mesa' | 'cocina' | 'caja' | 'pedido' | 'paquete'
  | 'local' | 'ubicacion' | 'telefono' | 'mail' | 'reloj' | 'campana'
  | 'grafico' | 'nota' | 'web' | 'filtro' | 'imprimir' | 'dinero'
  | 'proveedor' | 'inventario' | 'menu' | 'salir' | 'config'
  | 'casa' | 'etiqueta' | 'moto' | 'tendencia' | 'personas'
  | 'nivel-bajo' | 'sin-stock' | 'nivel-ok' | 'foto' | 'calendario';

/**
 * Iconografía del ERP.
 *
 * Reemplaza a los 355 emojis que había repartidos por los templates. Un emoji
 * arrastra su propio color y su propio estilo: no se puede alinear con el
 * texto, cambia de dibujo según el sistema operativo y rompe cualquier paleta.
 *
 * Estos son SVG de trazo con `currentColor`, así que heredan el color de donde
 * estén y siguen al tema sin tocar nada.
 *
 * Uso:  <app-icon name="agregar"></app-icon>
 *       <app-icon name="borrar" [size]="14"></app-icon>
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="stroke"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
      [innerHTML]="trazo"
    ></svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        /* Alinea con la línea de texto: un emoji nunca lo hacía bien. */
        vertical-align: -0.125em;
        flex-shrink: 0;
      }
    `,
  ],
})
export class IconComponent {
  private sanitizer = inject(DomSanitizer);

  @Input({ required: true }) set name(valor: IconName) {
    this._name = valor;
    this._trazo = null;
  }
  get name(): IconName {
    return this._name;
  }
  private _name: IconName = 'info';
  private _trazo: SafeHtml | null = null;

  @Input() size = 18;
  @Input() stroke = 1.6;

  get trazo(): SafeHtml {
    if (this._trazo) return this._trazo;
    // El sanitizer de Angular descarta los hijos de un SVG inyectado por
    // innerHTML, así que el icono saldría vacío. Se marca como confiable
    // porque el contenido es un mapa constante de este archivo: no hay
    // ninguna vía por la que entre algo del usuario.
    const bruto = TRAZOS[this._name] ?? TRAZOS['info'];
    this._trazo = this.sanitizer.bypassSecurityTrustHtml(bruto);
    return this._trazo;
  }
}

/* Trazos sobre lienzo 24. Sin fill, todo currentColor. */
const TRAZOS: Record<IconName, string> = {
  agregar: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  cerrar: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  editar:
    '<path d="M4 20h4l10-10a2.1 2.1 0 0 0-3-3L5 17v3Z"/><line x1="14.5" y1="6.5" x2="17.5" y2="9.5"/>',
  borrar:
    '<polyline points="4 6.5 20 6.5"/><path d="M9 6.5V4.5h6v2"/><path d="M6.5 6.5 7.4 20a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1l.9-13.5"/>',
  recargar:
    '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><polyline points="20 4 20 9 15 9"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  alerta:
    '<path d="M12 3.5 2.5 20h19L12 3.5Z"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16.5"/><circle cx="12" cy="7.8" r="0.6" fill="currentColor"/>',
  'flecha-izq': '<line x1="20" y1="12" x2="4" y2="12"/><polyline points="10 6 4 12 10 18"/>',
  'flecha-der': '<line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/>',
  chevron: '<polyline points="9 6 15 12 9 18"/>',
  usuario: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  mesa:
    '<ellipse cx="12" cy="7.5" rx="8" ry="3"/><line x1="12" y1="10.5" x2="12" y2="20"/><line x1="7" y1="20" x2="17" y2="20"/>',
  cocina:
    '<path d="M12 22a6 6 0 0 0 6-6c0-4-3-5.5-3-9 0 0-2.5 1.5-2.5 4.5 0 1.2-.8 2-1.7 2-1 0-1.8-.9-1.8-2.2C7.4 13 6 14 6 16a6 6 0 0 0 6 6Z"/>',
  caja:
    '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.4"/><line x1="6" y1="12" x2="6.01" y2="12"/><line x1="18" y1="12" x2="18.01" y2="12"/>',
  pedido:
    '<path d="M6.5 3.5h11l1.5 4H5l1.5-4Z"/><path d="M5 7.5v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-11"/><line x1="9.5" y1="11.5" x2="14.5" y2="11.5"/>',
  paquete:
    '<path d="M20.5 7.8 12 3 3.5 7.8v8.4L12 21l8.5-4.8Z"/><polyline points="3.5 7.8 12 12.6 20.5 7.8"/><line x1="12" y1="12.6" x2="12" y2="21"/>',
  local:
    '<path d="M4 9.5V20h16V9.5"/><path d="M3 9.5 5 4h14l2 5.5a3 3 0 0 1-5.4 1.9 3 3 0 0 1-5.2 0A3 3 0 0 1 3 9.5Z"/><path d="M10 20v-5h4v5"/>',
  ubicacion:
    '<path d="M12 21.5s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10.3" r="2.6"/>',
  telefono:
    '<path d="M7 3.5h2.2l1.5 3.6-1.8 1.3a11 11 0 0 0 4.7 4.7l1.3-1.8 3.6 1.5V15a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 5 8.2 2 2 0 0 1 7 3.5Z"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><polyline points="3.5 6.5 12 13 20.5 6.5"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><polyline points="12 7 12 12 15.5 14"/>',
  campana:
    '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10.5 19a1.8 1.8 0 0 0 3 0"/>',
  grafico:
    '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="12" width="3" height="8"/><rect x="11" y="7" width="3" height="13"/><rect x="16" y="14" width="3" height="6"/>',
  nota:
    '<path d="M6 3.5h8.5L19 8v12.5H6Z"/><polyline points="14.5 3.5 14.5 8 19 8"/><line x1="9" y1="12.5" x2="16" y2="12.5"/><line x1="9" y1="16" x2="14" y2="16"/>',
  foto: '<path d="M4 8.5h3.3l1.6-2.5h6.2l1.6 2.5H20v11H4Z"/><circle cx="12" cy="13.5" r="3.4"/>',
  calendario:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><line x1="3.5" y1="10" x2="20.5" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>',
  web: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><line x1="3" y1="12" x2="21" y2="12"/>',
  filtro: '<polygon points="3.5 5 20.5 5 14 13 14 20 10 18 10 13"/>',
  imprimir:
    '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="7" rx="1.5"/><path d="M7 14h10v6.5H7Z"/>',
  dinero:
    '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/>',
  proveedor:
    '<path d="M2.5 16V8h11v8Z"/><path d="M13.5 11h4l3 3v2h-7Z"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
  inventario:
    '<rect x="3.5" y="4" width="17" height="5" rx="1"/><path d="M5 9v10.5h14V9"/><line x1="10" y1="13" x2="14" y2="13"/>',
  menu: '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>',
  salir:
    '<path d="M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8"/><polyline points="17 15 21 12 17 9"/><line x1="21" y1="12" x2="10" y2="12"/>',
  casa: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/><path d="M9.5 21v-6.5h5V21"/>',
  etiqueta: '<path d="M3.5 11V4.5H10L20 14.5 13.5 21 3.5 11Z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  moto: '<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M8.5 17h6l2-6h-5"/><path d="M14 6h3l1.5 5"/>',
  tendencia: '<polyline points="3.5 17 9 11 13 15 20.5 7"/><polyline points="15.5 7 20.5 7 20.5 12"/>',
  /* Dos personas: el equipo del taller (Empleados). */
  personas:
    '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="16.5" cy="9" r="2.6"/><path d="M15.5 14.5a5.5 5.5 0 0 1 6 5.5"/>',

  /* Los tres estados de stock comparten el mismo recipiente y cambian solo el
     nivel de adentro. Se leen como una serie, no como tres dibujos sueltos:
     lleno, con poco, vacío y tachado. */
  'nivel-ok':
    '<path d="M6 3.5h12v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z"/><path d="M6 8h12" stroke-dasharray="0"/><rect x="7.5" y="9.5" width="9" height="9.5" rx="0.5" fill="currentColor" stroke="none" opacity="0.85"/>',
  'nivel-bajo':
    '<path d="M6 3.5h12v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z"/><rect x="7.5" y="15.5" width="9" height="3.5" rx="0.5" fill="currentColor" stroke="none" opacity="0.85"/><line x1="6" y1="13" x2="18" y2="13" stroke-dasharray="2 2"/>',
  'sin-stock':
    '<path d="M6 3.5h12v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z"/><line x1="4.5" y1="20.5" x2="19.5" y2="3.5"/>',
  config:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
};
