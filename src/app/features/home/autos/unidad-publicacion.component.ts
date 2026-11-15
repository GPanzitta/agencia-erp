import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { NotificationService } from '../../../core/services/notification.service';
import { urlFoto } from '../../../core/utils/foto-url.util';
import { AutosService, Unidad } from './autos.service';
import { monto, plata, renglon, urlDelSitio } from './autos.util';
import { CATEGORIAS, Caracteristica, GRUPOS, Publicacion, PUBLICACION_VACIA, TOPES, conPlantilla, paraGuardar, porGrupo } from './publicacion.util';

/**
 * La publicación de un auto, vista como en el sitio y editable en el lugar:
 * opciones de compra, equipamiento destacado, características y colores.
 */
@Component({
  selector: 'app-unidad-publicacion',
  standalone: false,
  templateUrl: './unidad-publicacion.component.html',
  styleUrls: ['./unidad-publicacion.component.scss'],
})
export class UnidadPublicacionComponent implements OnInit {
  private api = inject(AutosService);
  private route = inject(ActivatedRoute);
  private notification = inject(NotificationService);

  readonly plata = plata;
  readonly renglon = renglon;
  readonly foto = urlFoto;
  readonly categorias = CATEGORIAS;
  readonly primerGrupo = GRUPOS[0];
  readonly topes = TOPES;

  unidad = signal<Unidad | null>(null);
  /** Los demás autos del stock, para elegir cuáles ofrecer al lado. */
  otros = signal<Unidad[]>([]);
  sitio = signal<string | null>(null);
  guardando = signal(false);
  fotoActiva = signal(0);

  p: Publicacion = { ...PUBLICACION_VACIA };
  financiado = '';
  eligeRelacionadas = false;
  nuevoDestacado = { nombre: '', categoria: CATEGORIAS[0] };
  nuevoColor = { nombre: '', hex: '#8a8f94' };


  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') as string;
    this.api.obtener(id).subscribe({ next: (u) => this.leer(u) });
    this.api.listar('stock').subscribe({ next: (l) => this.otros.set(l.filter((u) => u.id !== id)), error: () => undefined });
    this.api.sitio().subscribe({ next: (s) => this.sitio.set(urlDelSitio(environment.portalUrl, s.slug)), error: () => undefined });
  }

  private leer(u: Unidad): void {
    const p = u.publicacion ?? PUBLICACION_VACIA;
    this.p = { ...PUBLICACION_VACIA, ...p, destacados: [...(p.destacados ?? [])], caracteristicas: (p.caracteristicas ?? []).map((c) => ({ ...c })), colores: (p.colores ?? []).map((c) => ({ ...c })), relacionadas: [...(p.relacionadas ?? [])] };
    this.financiado = this.p.precio_financiado === null ? '' : String(this.p.precio_financiado);
    this.eligeRelacionadas = this.p.relacionadas.length > 0;
    this.reagrupar();
    this.unidad.set(u);
  }

  /**
   * Las características agrupadas, para dibujarlas. Se rearma sólo cuando cambia la lista
   * (no en cada repintado): si no, Angular recrearía los campos mientras se escribe en ellos.
   */
  grupos = signal<{ grupo: string; items: Caracteristica[] }[]>([]);
  private reagrupar(): void { this.grupos.set(porGrupo(this.p.caracteristicas)); }

  agregarDestacado(): void {
    const nombre = this.nuevoDestacado.nombre.trim();
    if (!nombre) return;
    if (this.p.destacados.length >= TOPES.destacados) { this.notification.info(`Entran hasta ${TOPES.destacados} destacados.`); return; }
    this.p.destacados = [...this.p.destacados, { nombre, categoria: this.nuevoDestacado.categoria }];
    this.nuevoDestacado = { nombre: '', categoria: this.nuevoDestacado.categoria };
  }
  quitarDestacado(i: number): void { this.p.destacados = this.p.destacados.filter((_, k) => k !== i); }

  usarPlantilla(): void { this.p.caracteristicas = conPlantilla(this.p.caracteristicas); this.reagrupar(); }
  agregarCaracteristica(grupo: string): void {
    if (this.p.caracteristicas.length >= TOPES.caracteristicas) { this.notification.info(`Entran hasta ${TOPES.caracteristicas} características.`); return; }
    this.p.caracteristicas = [...this.p.caracteristicas, { grupo, etiqueta: '', valor: '' }];
    this.reagrupar();
  }
  quitarCaracteristica(c: Caracteristica): void { this.p.caracteristicas = this.p.caracteristicas.filter((x) => x !== c); this.reagrupar(); }

  agregarColor(): void {
    const nombre = this.nuevoColor.nombre.trim();
    if (!nombre) return;
    if (this.p.colores.length >= TOPES.colores) { this.notification.info(`Entran hasta ${TOPES.colores} colores.`); return; }
    this.p.colores = [...this.p.colores, { nombre, hex: this.nuevoColor.hex }];
    this.nuevoColor = { nombre: '', hex: this.nuevoColor.hex };
  }
  quitarColor(i: number): void { this.p.colores = this.p.colores.filter((_, k) => k !== i); }

  elegida(id: string): boolean { return this.p.relacionadas.includes(id); }
  alternar(id: string): void {
    if (this.elegida(id)) { this.p.relacionadas = this.p.relacionadas.filter((x) => x !== id); return; }
    if (this.p.relacionadas.length >= TOPES.relacionadas) { this.notification.info(`Se ofrecen hasta ${TOPES.relacionadas} autos al lado.`); return; }
    this.p.relacionadas = [...this.p.relacionadas, id];
  }

  guardar(): void {
    const u = this.unidad();
    if (!u) return;
    const precio = this.financiado.trim() ? monto(this.financiado) : null;
    if (this.financiado.trim() && precio === null) { this.notification.error('El precio financiado no es un número.'); return; }
    const datos = paraGuardar({ ...this.p, precio_financiado: precio, relacionadas: this.eligeRelacionadas ? this.p.relacionadas : [] });
    this.guardando.set(true);
    this.api.guardarPublicacion(u.id, datos).subscribe({
      next: (r) => { this.guardando.set(false); this.leer(r); this.notification.success(u.publicada ? 'Publicación guardada: ya se ve en el sitio' : 'Publicación guardada'); },
      error: () => this.guardando.set(false),
    });
  }

  trackPorIndice(i: number): number { return i; }
  trackPorGrupo(_: number, g: { grupo: string }): string { return g.grupo; }
  trackPorId(_: number, x: { id: string }): string { return x.id; }
}
