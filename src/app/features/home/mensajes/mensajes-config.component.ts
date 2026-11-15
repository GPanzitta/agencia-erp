import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NotificationService } from '../../../core/services/notification.service';
import { MensajesService } from './mensajes.service';
import { Canal, Catalogo, Contexto, EJEMPLO, Plantilla, ROTULO_CANAL, ROTULO_CONTEXTO, renderizarPlantilla, variablesDesconocidas } from './mensajes.util';

interface Borrador { id: string | null; clave: string | null; nombre: string; asunto: string; texto: string; contexto: Contexto; canal: Canal; activa: boolean }

/**
 * Configuración → Mensajes (14/11/2026): los textos que la agencia manda por
 * WhatsApp y por correo. Se reescriben con variables entre llaves y se ve al
 * lado cómo le llega a la persona.
 */
@Component({
  selector: 'app-mensajes-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mensajes-config.component.html',
  styleUrls: ['./mensajes-config.component.scss'],
})
export class MensajesConfigComponent implements OnInit {
  private api = inject(MensajesService);
  private notification = inject(NotificationService);

  readonly rotuloContexto = ROTULO_CONTEXTO;
  readonly rotuloCanal = ROTULO_CANAL;
  readonly contextos: Contexto[] = ['interesado', 'operacion'];
  readonly canales: Canal[] = ['whatsapp', 'email'];

  catalogo = signal<Catalogo | null>(null);
  guardando = signal(false);
  b: Borrador | null = null;

  grupos = computed(() => {
    const c = this.catalogo();
    if (!c) return [];
    return this.contextos.map((contexto) => ({ contexto, items: c.plantillas.filter((p) => p.contexto === contexto) }));
  });

  ngOnInit(): void { this.cargar(); }

  private cargar(elegir?: string): void {
    this.api.catalogo().subscribe({
      next: (c) => {
        this.catalogo.set(c);
        const p = c.plantillas.find((x) => x.id === (elegir ?? this.b?.id)) ?? c.plantillas[0];
        if (p && (elegir || !this.b)) this.abrir(p);
      },
    });
  }

  abrir(p: Plantilla): void {
    this.b = { id: p.id, clave: p.clave, nombre: p.nombre, asunto: p.asunto ?? '', texto: p.texto, contexto: p.contexto, canal: p.canal, activa: p.activa };
  }

  nuevo(contexto: Contexto, canal: Canal): void {
    this.b = { id: null, clave: null, nombre: '', asunto: '', texto: 'Hola {cliente}, ', contexto, canal, activa: true };
  }

  variables(): string[] { return this.b ? this.catalogo()?.variables[this.b.contexto] ?? [] : []; }
  ayuda(v: string): string { return this.catalogo()?.ayuda[v] ?? ''; }
  malas(): string[] { return this.b ? variablesDesconocidas(`${this.b.texto}\n${this.b.asunto}`, this.variables()) : []; }
  vistaPrevia(): string { return this.b ? renderizarPlantilla(this.b.texto, EJEMPLO) : ''; }
  asuntoPrevio(): string { return this.b ? renderizarPlantilla(this.b.asunto, EJEMPLO) : ''; }

  /** Mete la variable donde está el cursor del texto. */
  insertar(v: string, campo: HTMLTextAreaElement): void {
    if (!this.b) return;
    const [desde, hasta] = [campo.selectionStart ?? this.b.texto.length, campo.selectionEnd ?? this.b.texto.length];
    this.b.texto = `${this.b.texto.slice(0, desde)}{${v}}${this.b.texto.slice(hasta)}`;
    const cursor = desde + v.length + 2;
    setTimeout(() => { campo.focus(); campo.setSelectionRange(cursor, cursor); });
  }

  guardar(): void {
    const b = this.b;
    if (!b) return;
    if (!b.nombre.trim()) { this.notification.error('Ponele un nombre al mensaje, para encontrarlo después.'); return; }
    if (!b.texto.trim()) { this.notification.error('El mensaje está vacío.'); return; }
    if (b.canal === 'email' && !b.asunto.trim()) { this.notification.error('Un correo necesita asunto.'); return; }
    if (this.malas().length) { this.notification.error(`Este mensaje no puede usar ${this.malas().map((v) => `{${v}}`).join(', ')}.`); return; }
    this.guardando.set(true);
    const hecho = (p: Plantilla) => { this.guardando.set(false); this.notification.success('Mensaje guardado'); this.cargar(p.id); };
    const fallo = () => this.guardando.set(false);
    const comun = { nombre: b.nombre.trim(), texto: b.texto, ...(b.canal === 'email' ? { asunto: b.asunto.trim() } : {}) };
    if (b.id) this.api.editar(b.id, comun).subscribe({ next: hecho, error: fallo });
    else this.api.crear({ ...comun, contexto: b.contexto, canal: b.canal }).subscribe({ next: hecho, error: fallo });
  }

  alternar(): void {
    const b = this.b;
    if (!b?.id) return;
    this.api.editar(b.id, { activa: !b.activa }).subscribe({ next: (p) => { this.notification.success(p.activa ? 'El mensaje vuelve a ofrecerse' : 'El mensaje ya no se ofrece al escribir'); this.cargar(p.id); } });
  }

  restaurar(): void {
    if (!this.b?.id) return;
    this.api.restaurar(this.b.id).subscribe({ next: (p) => { this.notification.success('Volvió al texto original'); this.cargar(p.id); } });
  }

  borrar(): void {
    const b = this.b;
    if (!b?.id) return;
    this.api.borrar(b.id).subscribe({ next: () => { this.notification.success(`«${b.nombre}» borrado`); this.b = null; this.cargar(); } });
  }

  trackPorId(_: number, x: { id: string }): string { return x.id; }
}
