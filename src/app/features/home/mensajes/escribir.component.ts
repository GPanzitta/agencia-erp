import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NotificationService } from '../../../core/services/notification.service';
import { MensajesService } from './mensajes.service';
import { Canal, Contexto, MensajeEnviado, MensajesPara, PlantillaLista, ROTULO_CANAL, correoValido, enlaceDeWhatsapp } from './mensajes.util';

/**
 * «Escribirle» (14/11/2026): se elige un mensaje de los que la agencia tiene
 * escritos, llega con los datos de esa persona ya puestos, se retoca si hace
 * falta y sale por WhatsApp (se abre la conversación con el texto listo) o por
 * correo (lo manda el sistema). Queda anotado qué se le escribió.
 */
@Component({
  selector: 'app-escribir',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './escribir.component.html',
  styleUrls: ['./escribir.component.scss'],
})
export class EscribirComponent implements OnInit {
  private api = inject(MensajesService);
  private notification = inject(NotificationService);

  @Input({ required: true }) contexto!: Contexto;
  @Input({ required: true }) destino!: string;
  @Output() cerrar = new EventEmitter<void>();
  /** Avisa que se escribió algo, para que la pantalla de atrás refresque el seguimiento. */
  @Output() enviado = new EventEmitter<void>();

  readonly rotuloCanal = ROTULO_CANAL;
  readonly canales: Canal[] = ['whatsapp', 'email'];

  datos = signal<MensajesPara | null>(null);
  historial = signal<MensajeEnviado[]>([]);
  canal = signal<Canal>('whatsapp');
  enviando = signal(false);
  verHistorial = signal(false);

  plantillaId: string | null = null;
  texto = '';
  asunto = '';
  para = '';

  ngOnInit(): void {
    this.api.para(this.contexto, this.destino).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.para = d.email ?? '';
        // Sin teléfono que sirva para WhatsApp, se arranca por correo.
        this.elegirCanal(d.whatsapp ? 'whatsapp' : 'email');
      },
      error: () => this.cerrar.emit(),
    });
    this.cargarHistorial();
  }

  private cargarHistorial(): void {
    this.api.historial(this.contexto, this.destino).subscribe({ next: (h) => this.historial.set(h), error: () => undefined });
  }

  @HostListener('document:keydown.escape')
  alEscape(): void { this.cerrar.emit(); }

  plantillas(): PlantillaLista[] { return this.datos()?.plantillas[this.canal()] ?? []; }

  elegirCanal(c: Canal): void {
    this.canal.set(c);
    const primera = this.plantillas()[0];
    if (primera) this.elegir(primera.id); else { this.plantillaId = null; this.texto = ''; this.asunto = ''; }
  }

  elegir(id: string | null): void {
    this.plantillaId = id;
    const p = this.plantillas().find((x) => x.id === id);
    this.texto = p?.texto ?? '';
    this.asunto = p?.asunto ?? '';
  }

  /** Abre WhatsApp con el texto ya escrito: el envío lo confirma el vendedor ahí. */
  abrirWhatsapp(): void {
    const d = this.datos();
    const texto = this.texto.trim();
    if (!d?.whatsapp) return;
    if (!texto) { this.notification.error('Escribí el mensaje.'); return; }
    // Se abre en el momento del clic: si se esperara la respuesta del servidor, el navegador bloquearía la ventana.
    window.open(enlaceDeWhatsapp(d.whatsapp, texto), '_blank', 'noopener');
    this.api.registrarWhatsapp(this.contexto, this.destino, texto, this.plantillaId).subscribe({
      next: () => { this.cargarHistorial(); this.enviado.emit(); },
      error: () => undefined,
    });
  }

  enviarCorreo(): void {
    const [para, asunto, cuerpo] = [this.para.trim(), this.asunto.trim(), this.texto.trim()];
    if (!correoValido(para)) { this.notification.error('Revisá el correo de la persona.'); return; }
    if (!asunto) { this.notification.error('Ponele un asunto al correo.'); return; }
    if (!cuerpo) { this.notification.error('Escribí el mensaje.'); return; }
    this.enviando.set(true);
    this.api.enviarCorreo(this.contexto, this.destino, { para, asunto, cuerpo, ...(this.plantillaId ? { plantilla_id: this.plantillaId } : {}) }).subscribe({
      next: () => {
        this.enviando.set(false);
        this.notification.success(this.datos()?.correo.pruebas ? 'Correo registrado (el servidor está en modo de prueba: no salió de verdad)' : `Correo enviado a ${para}`);
        this.cargarHistorial();
        this.enviado.emit();
      },
      error: () => { this.enviando.set(false); this.cargarHistorial(); },
    });
  }

  cuando(f: string): string {
    return new Date(f).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  rotuloEstado(m: MensajeEnviado): string {
    return m.estado === 'fallido' ? 'No salió' : m.canal === 'whatsapp' ? 'Se abrió WhatsApp' : 'Enviado';
  }
  trackPorId(_: number, x: { id: string }): string { return x.id; }
}
