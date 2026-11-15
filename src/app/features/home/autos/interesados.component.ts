import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';

import { AutosService, EtapaInteresado, Interesado } from './autos.service';
import { CARROCERIAS, fecha, km, monto, plata } from './autos.util';
import { ETAPAS_DEL_TABLERO, ORIGENES, ROTULO_ETAPA, TEMPERATURAS, claseProxima, cuentas, linkWhatsapp, mensajeDeCotizacion, ordenar, resumenDeBusqueda, rotuloOrigen, textoProxima } from './interesados.util';
import { NotificationService } from '../../../core/services/notification.service';
import { urlFoto } from '../../../core/utils/foto-url.util';

type Vista = 'activos' | 'ganados' | 'perdidos';

/**
 * Interesados (tanda de la demo, 12/11/2026): un tablero por etapa con quién
 * consultó, qué busca y cuándo hay que volver a hablarle, y al lado de cada
 * uno los autos del stock que hoy le sirven.
 */
@Component({
  selector: 'app-interesados',
  standalone: false,
  templateUrl: './interesados.component.html',
  styleUrls: ['./interesados.component.scss'],
})
export class InteresadosComponent implements OnInit, OnDestroy {
  /** Cada cuánto se vuelve a pedir el tablero, para que una consulta del sitio aparezca sola. */
  private static readonly REFRESCO_MS = 20000;
  private reloj: ReturnType<typeof setInterval> | null = null;
  private api = inject(AutosService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notification = inject(NotificationService);

  readonly etapas = ETAPAS_DEL_TABLERO;
  readonly rotuloEtapa = ROTULO_ETAPA;
  readonly origenes = ORIGENES;
  readonly temperaturas = TEMPERATURAS;
  readonly carrocerias = CARROCERIAS;
  readonly rotuloOrigen = rotuloOrigen;
  readonly busqueda = resumenDeBusqueda;
  readonly proxima = textoProxima;
  readonly claseProxima = claseProxima;
  readonly whatsapp = linkWhatsapp;
  /** A qué interesado se le está escribiendo (la ventana «Escribirle»). */
  escribirA = signal<string | null>(null);
  readonly plata = plata;
  readonly km = km;
  readonly fecha = fecha;
  readonly foto = urlFoto;

  readonly vistas: { valor: Vista; rotulo: string }[] = [
    { valor: 'activos', rotulo: 'Tablero' },
    { valor: 'ganados', rotulo: 'Compraron' },
    { valor: 'perdidos', rotulo: 'Se perdieron' },
  ];

  vista = signal<Vista>('activos');
  lista = signal<Interesado[]>([]);
  cargando = signal(false);
  ocupado = signal(false);
  elegidoId = signal<string | null>(null);
  nuevoAbierto = signal(false);
  perdiendo = signal(false);

  readonly elegido = computed(() => this.lista().find((i) => i.id === this.elegidoId()) ?? null);
  readonly cuentas = computed(() => cuentas(this.lista()));
  readonly columnas = computed(() => this.etapas.map((e) => ({ ...e, items: ordenar(this.lista().filter((i) => i.etapa === e.valor)) })));

  nuevo = this.vacio();
  nota = { texto: '', proxima_accion: '', proxima_nota: '' };
  perdida = { motivo: '' };
  cotiza = { valor: '', moneda: 'USD' as 'USD' | 'ARS', nota: '' };

  ngOnInit(): void {
    // Desde la ficha de un auto se llega con ?abrir=<id> para caer sobre un interesado.
    this.elegidoId.set(this.route.snapshot.queryParamMap.get('abrir'));
    this.cargar();
    // Sin tocar nada mientras alguien escribe una nota o carga un interesado.
    this.reloj = setInterval(() => {
      if (!this.ocupado() && !this.nuevoAbierto() && !this.nota.texto && !this.cotiza.valor && document.visibilityState === 'visible') this.cargar();
    }, InteresadosComponent.REFRESCO_MS);
  }

  ngOnDestroy(): void {
    if (this.reloj) clearInterval(this.reloj);
  }

  ver(v: Vista): void {
    this.vista.set(v);
    this.elegidoId.set(null);
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.api.interesados(this.vista()).subscribe({
      next: (l) => { this.lista.set(l); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  elegir(i: Interesado): void {
    this.elegidoId.set(this.elegidoId() === i.id ? null : i.id);
    this.perdiendo.set(false);
    this.nota = { texto: '', proxima_accion: '', proxima_nota: '' };
  }

  crear(): void {
    const n = this.nuevo;
    if (n.nombre.trim().length < 2) { this.notification.error('Poné el nombre.'); return; }
    if (!n.telefono.trim()) { this.notification.error('Cargá un teléfono: sin eso no hay cómo volver a hablarle.'); return; }
    const tope = n.precio_max.trim() ? monto(n.precio_max) : null;
    if (n.precio_max.trim() && tope === null) { this.notification.error('El tope de precio no es un monto válido.'); return; }
    this.hacer(this.api.crearInteresado({
      nombre: n.nombre.trim(), telefono: n.telefono.trim(), origen: n.origen, temperatura: n.temperatura,
      ...(n.busca.trim() ? { busca: n.busca.trim() } : {}),
      ...(n.busca_marca.trim() ? { busca_marca: n.busca_marca.trim() } : {}),
      ...(n.busca_carroceria ? { busca_carroceria: n.busca_carroceria } : {}),
      ...(tope ? { precio_max: tope, precio_moneda: n.precio_moneda } : {}),
      ...(n.tiene_usado.trim() ? { tiene_usado: n.tiene_usado.trim() } : {}),
      ...(n.proxima_accion ? { proxima_accion: n.proxima_accion } : {}),
      ...(n.nota.trim() ? { nota: n.nota.trim() } : {}),
    }), 'Interesado cargado', () => { this.nuevoAbierto.set(false); this.nuevo = this.vacio(); });
  }

  anotar(): void {
    const i = this.elegido();
    if (!i) return;
    if (this.nota.texto.trim().length < 2) { this.notification.error('Escribí qué pasó.'); return; }
    this.hacer(this.api.anotarInteresado(i.id, {
      texto: this.nota.texto.trim(),
      ...(this.nota.proxima_accion ? { proxima_accion: this.nota.proxima_accion, proxima_nota: this.nota.proxima_nota.trim() } : {}),
    }), 'Anotado', () => { this.nota = { texto: '', proxima_accion: '', proxima_nota: '' }; });
  }

  mover(etapa: EtapaInteresado): void {
    const i = this.elegido();
    if (i) this.hacer(this.api.moverInteresado(i.id, etapa), etapa === 'ganado' ? 'Compró' : `Pasó a «${ROTULO_ETAPA[etapa]}»`);
  }

  /** Le pone un valor al auto que entrega; queda en la ficha y en el seguimiento. */
  cotizar(): void {
    const i = this.elegido();
    if (!i) return;
    const valor = monto(this.cotiza.valor);
    if (valor === null || valor <= 0) { this.notification.error('Poné el valor de la cotización.'); return; }
    this.hacer(this.api.cotizarInteresado(i.id, {
      valor, moneda: this.cotiza.moneda, ...(this.cotiza.nota.trim() ? { nota: this.cotiza.nota.trim() } : {}),
    }), 'Cotización guardada', () => { this.cotiza = { valor: '', moneda: this.cotiza.moneda, nota: '' }; });
  }

  /** Abre el alta de stock con el auto del interesado ya cargado: lo que dijo en el sitio y lo que se le cotizó. */
  tomarAlStock(i: Interesado): void {
    if (!i.usado) return;
    this.router.navigate(['/home/autos/nueva'], { queryParams: { tomar: JSON.stringify({
      ...i.usado, titular_nombre: i.nombre, titular_telefono: i.telefono,
      costo: i.cotizacion.valor, moneda: i.cotizacion.moneda ?? 'USD',
    }) } });
  }

  /** El WhatsApp con la cotización ya escrita, listo para mandar. */
  whatsappCotizacion(i: Interesado): string | null {
    if (i.cotizacion?.valor == null) return null;
    return linkWhatsapp(i.telefono, i.nombre, mensajeDeCotizacion(i, plata(i.cotizacion.valor, i.cotizacion.moneda ?? 'USD')));
  }

  perder(): void {
    const i = this.elegido();
    if (!i) return;
    if (this.perdida.motivo.trim().length < 3) { this.notification.error('Decí por qué se perdió.'); return; }
    this.hacer(this.api.moverInteresado(i.id, 'perdido', this.perdida.motivo.trim()), 'Quedó como perdido', () => {
      this.perdiendo.set(false); this.perdida = { motivo: '' };
    });
  }

  temperatura(valor: string): void {
    const i = this.elegido();
    if (i && i.temperatura !== valor) this.hacer(this.api.editarInteresado(i.id, { temperatura: valor }), '');
  }

  trackPorId(_: number, x: { id: string }): string { return x.id; }
  trackPorValor(_: number, x: { valor: string }): string { return x.valor; }

  /** Toda acción devuelve al interesado ya actualizado: se reemplaza en la lista (o sale, si cambió de vista). */
  private hacer(pedido: Observable<Interesado>, mensaje: string, alTerminar?: () => void): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    pedido.subscribe({
      next: (i) => {
        this.ocupado.set(false);
        const enVista = this.vista() === 'activos' ? !['ganado', 'perdido'].includes(i.etapa) : this.vista() === 'ganados' ? i.etapa === 'ganado' : i.etapa === 'perdido';
        const resto = this.lista().filter((x) => x.id !== i.id);
        this.lista.set(enVista ? [i, ...resto] : resto);
        this.elegidoId.set(enVista ? i.id : null);
        alTerminar?.();
        if (mensaje) this.notification.success(mensaje);
      },
      error: () => this.ocupado.set(false),
    });
  }

  private vacio() {
    return {
      nombre: '', telefono: '', origen: 'salon', temperatura: 'tibio', busca: '', busca_marca: '', busca_carroceria: '',
      precio_max: '', precio_moneda: 'USD' as 'USD' | 'ARS', tiene_usado: '', proxima_accion: '', nota: '',
    };
  }
}
