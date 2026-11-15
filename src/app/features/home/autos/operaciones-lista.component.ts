import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { Rol } from '../../../core/interfaces/auth.interface';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../auth/services/auth.service';
import { AutosService, Billetera, Comisiones, ComisionesDeVendedor, Operacion, PedidoDeReserva, PorMoneda } from './autos.service';
import { dominioLegible, fecha, monto, plata } from './autos.util';

type Vista = 'reservas' | 'vendidas' | 'anuladas' | 'sitio' | 'comisiones';
type FilaDeComision = ComisionesDeVendedor['operaciones'][number];

/**
 * Las ventas de la agencia: reservas vivas, ventas cerradas y operaciones caídas
 * (diseño del 12/11/2026), más los pedidos de reserva que entran por el sitio y
 * las comisiones de cada vendedor (13/11/2026).
 */
@Component({
  selector: 'app-operaciones-lista',
  standalone: false,
  templateUrl: './operaciones-lista.component.html',
  styleUrls: ['./operaciones-lista.component.scss'],
})
export class OperacionesListaComponent implements OnInit {
  private api = inject(AutosService);
  private auth = inject(AuthService);
  private notification = inject(NotificationService);

  readonly plata = plata;
  readonly fecha = fecha;
  readonly dominio = dominioLegible;
  readonly esDuenio = computed(() => [Rol.ADMIN, Rol.SUPERADMIN].includes(this.auth.rol() as Rol));
  readonly vistas: { valor: Vista; rotulo: string }[] = [
    { valor: 'reservas', rotulo: 'Reservas' },
    { valor: 'sitio', rotulo: 'Del sitio' },
    { valor: 'vendidas', rotulo: 'Vendidas' },
    { valor: 'anuladas', rotulo: 'Caídas' },
    { valor: 'comisiones', rotulo: 'Comisiones' },
  ];
  readonly ROTULO_PEDIDO: Record<PedidoDeReserva['estado'], string> = {
    pendiente: 'Esperando la seña', confirmada: 'Confirmada', rechazada: 'Rechazada', vencida: 'Plazo vencido',
  };

  vista = signal<Vista>('reservas');
  /** A qué comprador se le está escribiendo (la ventana «Escribirle»). */
  escribirA = signal<string | null>(null);
  lista = signal<Operacion[]>([]);
  cargando = signal(false);

  pedidos = signal<PedidoDeReserva[]>([]);
  /** Cuántos pedidos del sitio esperan que alguien mire si llegó la seña. */
  porConfirmar = computed(() => this.pedidos().filter((p) => p.estado === 'pendiente').length);
  billeteras = signal<Billetera[]>([]);
  /** El pedido que se está confirmando o rechazando. */
  panel = signal<{ id: string; tipo: 'confirmar' | 'rechazar' } | null>(null);
  confirma = { wallet_id: '', tipo_cambio: '', motivo: '' };
  ocupado = signal(false);

  comisiones = signal<Comisiones | null>(null);
  periodo = { desde: '', hasta: '' };
  abierto = signal<string | null>(null);
  /** El porcentaje de cada vendedor mientras se edita. */
  pct: Record<string, string> = {};

  ngOnInit(): void {
    // Inicio manda directo a los pedidos del sitio con ?vista=sitio.
    if (new URLSearchParams(location.search).get('vista') === 'sitio') this.ver('sitio');
    else this.cargar();
    // Para el aviso de la pestaña, aunque no se entre a ella.
    this.api.pedidosDeReserva().subscribe({ next: (l) => this.pedidos.set(l), error: () => undefined });
  }

  ver(v: Vista): void {
    this.vista.set(v);
    this.panel.set(null);
    this.cargar();
  }

  cargar(): void {
    const v = this.vista();
    this.cargando.set(true);
    const fin = { error: () => this.cargando.set(false) };
    if (v === 'sitio') {
      this.api.pedidosDeReserva().subscribe({ next: (l) => { this.pedidos.set(l); this.cargando.set(false); }, ...fin });
      if (!this.billeteras().length) this.api.billeteras().subscribe({ next: (b) => this.billeteras.set(b), error: () => undefined });
    } else if (v === 'comisiones') {
      this.api.comisiones(this.periodo.desde, this.periodo.hasta).subscribe({
        next: (c) => {
          this.comisiones.set(c);
          this.periodo = { desde: c.desde, hasta: c.hasta };
          this.pct = Object.fromEntries(c.vendedores.filter((x) => x.id).map((x) => [x.id as string, x.pct === null ? '' : String(x.pct)]));
          this.cargando.set(false);
        }, ...fin,
      });
    } else {
      this.api.operaciones(v).subscribe({ next: (l) => { this.lista.set(l); this.cargando.set(false); }, ...fin });
    }
  }

  // ─── Pedidos del sitio ────────────────────────────────────────────────────

  abrir(p: PedidoDeReserva, tipo: 'confirmar' | 'rechazar'): void {
    this.confirma = { wallet_id: '', tipo_cambio: '', motivo: '' };
    this.panel.set({ id: p.id, tipo });
  }

  cajasPara(p: PedidoDeReserva): Billetera[] {
    return this.billeteras().filter((b) => (b.moneda ?? 'ARS') === p.moneda);
  }

  confirmar(p: PedidoDeReserva): void {
    const cruza = p.moneda !== p.unidad.moneda;
    const tc = cruza ? monto(this.confirma.tipo_cambio) : null;
    if (cruza && tc === null) { this.notification.error('La seña y el auto están en monedas distintas: decí a cuánto tomás el dólar.'); return; }
    this.resolver(this.api.confirmarReserva(p.id, { ...(this.confirma.wallet_id ? { wallet_id: this.confirma.wallet_id } : {}), ...(tc !== null ? { tipo_cambio: tc } : {}) }), 'Reserva confirmada: la unidad quedó reservada con su seña');
  }

  rechazar(p: PedidoDeReserva): void {
    this.resolver(this.api.rechazarReserva(p.id, this.confirma.motivo.trim()), 'Pedido rechazado');
  }

  private resolver(pedido: ReturnType<AutosService['confirmarReserva']>, mensaje: string): void {
    this.ocupado.set(true);
    pedido.subscribe({
      next: (r) => {
        this.pedidos.update((l) => l.map((x) => (x.id === r.id ? r : x)));
        this.panel.set(null); this.ocupado.set(false); this.notification.success(mensaje);
      },
      error: () => this.ocupado.set(false),
    });
  }

  // ─── Comisiones ───────────────────────────────────────────────────────────

  /** «$ 400.000 · US$ 100», sin la moneda que está en cero. */
  totales(t: PorMoneda): string {
    const partes = [t.ARS ? plata(t.ARS, 'ARS') : null, t.USD ? plata(t.USD, 'USD') : null].filter(Boolean);
    return partes.length ? partes.join(' · ') : '—';
  }

  guardarPct(v: ComisionesDeVendedor): void {
    if (!v.id) return;
    const texto = (this.pct[v.id] ?? '').trim().replace(',', '.');
    const n = texto ? Number(texto) : null;
    if (n !== null && (Number.isNaN(n) || n < 0 || n > 50)) { this.notification.error('El porcentaje va de 0 a 50.'); return; }
    this.api.porcentajeDeVendedor(v.id, n).subscribe({ next: () => { this.notification.success(n ? `${v.nombre} cobra ${n} % de cada venta que cierre` : `${v.nombre} quedó sin porcentaje fijo`); this.cargar(); } });
  }

  marcar(o: FilaDeComision, pagada: boolean): void {
    this.api.ajustarComision(o.id, { pagada }).subscribe({ next: () => { this.notification.success(pagada ? 'Comisión marcada como pagada' : 'La comisión volvió a quedar pendiente'); this.cargar(); } });
  }

  trackPorId(_: number, x: { id: string | null }): string {
    return x.id ?? 'sin';
  }
}
