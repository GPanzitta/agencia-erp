import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';

import { NotificationService } from '../../../core/services/notification.service';
import { AutosService, ComparacionDePrecios, ComparacionDeUnidad, NovedadDeAviso, OtroVendedor, Veredicto } from './autos.service';
import { monto, plata } from './autos.util';

const CADA_CUANTO_MS = 3000;
const ROTULO_BASE = { misma_version: 'su misma versión', mismo_motor: 'su mismo motor y caja', mismo_modelo: 'los del modelo' };
const ROTULO_NOVEDAD: Record<NovedadDeAviso['tipo'], string> = { bajo: 'Bajó de precio', subio: 'Subió de precio', nuevo: 'Aviso nuevo', salio: 'Ya no está publicado' };
const ROTULO: Record<Veredicto, string> = {
  buen_precio: 'Buen precio', en_precio: 'En precio', caro_pero_mejor: 'Más caro, pero mejor auto', caro: 'Caro',
  sin_comparables: 'Nadie más lo tiene', sin_precio: 'Sin precio', falta_dolar: 'Falta el dólar',
};
/** Primero lo que pide una decisión: los caros; al final, lo que no se puede comparar. */
const ORDEN: Veredicto[] = ['caro', 'caro_pero_mejor', 'en_precio', 'buen_precio', 'falta_dolar', 'sin_precio', 'sin_comparables'];

/**
 * Comparar precios (14/11/2026): se pega la dirección del listado de otro
 * vendedor, el sistema lee sus autos y los pone al lado de los míos del mismo modelo.
 */
@Component({
  selector: 'app-precios',
  standalone: false,
  templateUrl: './precios.component.html',
  styleUrls: ['./precios.component.scss'],
})
export class PreciosComponent implements OnInit, OnDestroy {
  private api = inject(AutosService);
  private notification = inject(NotificationService);

  readonly plata = plata;
  readonly rotulo = ROTULO;
  readonly rotuloBase = ROTULO_BASE;
  readonly rotuloNovedad = ROTULO_NOVEDAD;
  private reloj: ReturnType<typeof setTimeout> | null = null;
  /** Los vendedores que se estaban leyendo: al terminar se avisa cómo salió. */
  private enLectura = new Set<string>();

  datos = signal<ComparacionDePrecios | null>(null);
  cargando = signal(true);
  agregando = signal(false);
  abierta = signal<string | null>(null);
  url = '';
  nombre = '';
  dolar = '';

  mios = computed(() => [...(this.datos()?.mios ?? [])].sort((a, b) => ORDEN.indexOf(a.veredicto) - ORDEN.indexOf(b.veredicto)));
  resumen = computed(() => {
    const m = this.datos()?.mios ?? [];
    const contar = (...v: Veredicto[]) => m.filter((x) => v.includes(x.veredicto)).length;
    return { caros: contar('caro'), mejores: contar('caro_pero_mejor'), enPrecio: contar('en_precio'), buenos: contar('buen_precio'), sinPar: contar('sin_comparables', 'sin_precio', 'falta_dolar') };
  });
  faltaDolar = computed(() => (this.datos()?.mios ?? []).some((m) => m.veredicto === 'falta_dolar'));

  ngOnInit(): void { this.cargar(); }
  ngOnDestroy(): void { if (this.reloj) clearTimeout(this.reloj); }

  /** Trae la comparación. Mientras haya una lectura en curso, vuelve a preguntar cada pocos segundos. */
  cargar(): void {
    if (this.reloj) { clearTimeout(this.reloj); this.reloj = null; }
    this.api.compararPrecios().subscribe({
      next: (d) => {
        // El dólar guardado se muestra al entrar; después no se pisa lo que el usuario está escribiendo.
        if (!this.datos()) this.dolar = d.dolar === null ? '' : String(d.dolar);
        this.datos.set(d);
        this.cargando.set(false);
        for (const v of d.competidores) {
          if (v.leyendo) this.enLectura.add(v.id);
          else if (this.enLectura.delete(v.id)) this.avisar(v);
        }
        if (d.competidores.some((v) => v.leyendo)) this.reloj = setTimeout(() => this.cargar(), CADA_CUANTO_MS);
      },
      error: () => this.cargando.set(false),
    });
  }

  /** El dólar queda guardado para toda la agencia. */
  aplicarDolar(): void {
    const dolar = this.dolar.trim() ? monto(this.dolar) : null;
    if (this.dolar.trim() && dolar === null) { this.notification.error('El valor del dólar no es un número.'); return; }
    this.api.guardarDolar(dolar).subscribe({ next: () => this.cargar() });
  }

  agregar(): void {
    const url = this.url.trim();
    if (!/^https?:\/\/.+\..+/i.test(url)) { this.notification.error('Pegá la dirección completa de la página, con https:// adelante.'); return; }
    this.agregando.set(true);
    this.api.agregarVendedor(url, this.nombre.trim()).subscribe({
      next: () => { this.agregando.set(false); this.url = ''; this.nombre = ''; this.cargar(); },
      error: () => this.agregando.set(false),
    });
  }

  /** La lectura corre de fondo: la pantalla sigue usable y se actualiza sola cuando termina. */
  releer(v: OtroVendedor): void {
    this.api.releerVendedor(v.id).subscribe({ next: () => this.cargar() });
  }

  quitar(v: OtroVendedor): void {
    this.api.quitarVendedor(v.id).subscribe({ next: () => { this.notification.success(`${v.nombre} ya no se compara`); this.cargar(); } });
  }

  private avisar(v: OtroVendedor): void {
    if (v.error) this.notification.info(v.error);
    else this.notification.success(`Leímos ${v.autos} ${v.autos === 1 ? 'auto' : 'autos'} de ${v.nombre}`);
  }

  titulo(c: ComparacionDeUnidad): string {
    return [c.unidad.marca, c.unidad.modelo, c.unidad.version].filter(Boolean).join(' ');
  }
  km(n: number | null): string { return n === null ? 'km sin dato' : `${n.toLocaleString('es-AR')} km`; }
  cuando(f: string | null): string { return f ? new Date(f).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : 'nunca'; }
  dia(f: string): string { return new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }); }
  trackPorId(_: number, x: { id: string }): string { return x.id; }
  trackUnidad(_: number, c: ComparacionDeUnidad): string { return c.unidad.id; }
}
