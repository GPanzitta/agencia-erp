import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { Rol } from '../../../core/interfaces/auth.interface';
import { DocumentosService } from '../../../core/services/documentos.service';
import { VentaAutoDoc } from '../../../core/services/documentos/boleto-auto.doc';
import { ExcelService } from '../../../core/services/excel.service';
import { NotificationService } from '../../../core/services/notification.service';
import { urlFoto } from '../../../core/utils/foto-url.util';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../auth/services/auth.service';
import { AutosService, Billetera, Comisiones, ComisionesDeVendedor, FotoOperacion, Operacion, PedidoDeReserva, PorMoneda } from './autos.service';
import { dominioLegible, fecha, monto, plata, urlDelSitio } from './autos.util';
import * as QRCode from 'qrcode';

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
  private excel = inject(ExcelService);
  private notification = inject(NotificationService);
  private documentos = inject(DocumentosService);

  readonly plata = plata;
  readonly fecha = fecha;
  readonly dominio = dominioLegible;
  readonly foto = urlFoto;
  readonly esDuenio = computed(() => [Rol.ADMIN, Rol.SUPERADMIN].includes(this.auth.rol() as Rol) && !this.auth.modoCliente());
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
  sitioUrl = signal<string>(environment.portalUrl);
  ovFotosAbierta = signal<string | null>(null);
  notaFotoOv = '';
  etapaFotoOv = 'reserva';
  fotoAmpliada = signal<FotoOperacion | null>(null);
  qrModal = signal<{ titulo: string; subtitulo: string; url: string; qrDataUrl: string } | null>(null);

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
    this.api.sitio().subscribe({ next: (s) => this.sitioUrl.set(urlDelSitio(environment.portalUrl, s.slug)), error: () => undefined });
  }

  imprimirOv(o: Operacion, ev?: Event): void {
    ev?.stopPropagation();
    const doc: VentaAutoDoc = {
      numero: o.numero,
      cliente_nombre: o.cliente_nombre,
      cliente_telefono: o.cliente_telefono,
      cliente_documento: o.cliente_documento,
      precio: o.precio,
      moneda: o.moneda,
      pagado: o.pagado,
      saldo: o.saldo,
      reserva_vence: o.reserva_vence,
      pagos: o.pagos.map((p) => ({
        medio: p.medio,
        monto: p.monto,
        moneda: p.moneda,
        tipo_cambio: p.tipo_cambio,
        equivalente: p.equivalente,
        toma: p.toma,
        detalle: p.detalle,
        fecha: p.fecha,
      })),
      unidad: {
        titulo: o.unidad.titulo,
        anio: o.unidad.anio,
        km: 0,
        dominio: o.unidad.dominio,
        color: null,
        nro_motor: null,
        nro_chasis: null,
        condicion: 'usado',
      },
    };
    const urlSeguimiento = `${this.sitioUrl().replace(/\/+$/, '')}/ov/${o.id}`;
    void this.documentos.ordenDeVentaAuto(doc, urlSeguimiento);
  }

  async verQrOv(o: Operacion, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    const url = `${this.sitioUrl().replace(/\/+$/, '')}/ov/${o.id}`;
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });
    this.qrModal.set({
      titulo: `QR de Orden de Venta ${o.numero}`,
      subtitulo: `El cliente (${o.cliente_nombre}) escanea este código para seguir en vivo el estado de cuenta, papeles, gestoría y fotos de su ${o.unidad.titulo}.`,
      url,
      qrDataUrl,
    });
  }

  copiarUrlQr(url: string): void {
    void navigator.clipboard?.writeText(url);
    this.notification.success('Enlace de seguimiento de la OV copiado');
  }

  alternarFotosOv(o: Operacion, ev?: Event): void {
    ev?.stopPropagation();
    this.ovFotosAbierta.set(this.ovFotosAbierta() === o.id ? null : o.id);
  }

  subirFotosEnOv(o: Operacion, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []).filter((a) => a.type.startsWith('image/'));
    input.value = '';
    if (!archivos.length) return;
    this.ocupado.set(true);
    this.api.subirFotosOperacion(o.id, archivos, this.notaFotoOv.trim(), this.etapaFotoOv).subscribe({
      next: (act) => {
        this.ocupado.set(false);
        this.notaFotoOv = '';
        this.lista.update((l) => l.map((x) => (x.id === act.id ? act : x)));
        this.notification.success(archivos.length === 1 ? 'Foto guardada en la OV' : `${archivos.length} fotos guardadas en la OV`);
      },
      error: () => this.ocupado.set(false),
    });
  }

  borrarFotoEnOv(o: Operacion, fotoId: string): void {
    this.ocupado.set(true);
    this.api.borrarFotoOperacion(o.id, fotoId).subscribe({
      next: (act) => {
        this.ocupado.set(false);
        this.lista.update((l) => l.map((x) => (x.id === act.id ? act : x)));
        this.notification.success('Foto quitada de la OV');
      },
      error: () => this.ocupado.set(false),
    });
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

  exportarExcel(): void {
    const v = this.vista();
    const hoy = new Date().toISOString().slice(0, 10);
    if (v === 'comisiones') {
      const c = this.comisiones();
      if (!c) return;
      const filas = c.vendedores.flatMap((vend) =>
        vend.operaciones.map((o) => ({
          vendedor: vend.nombre,
          pct: vend.pct ?? '',
          operacion: o.numero,
          unidad: o.unidad,
          cliente: o.cliente,
          fecha: fecha(o.cerrada_at),
          moneda: o.moneda,
          precio: o.precio,
          comision: o.comision ?? '',
          estado_pago: o.pagada_at ? `Pagada (${fecha(o.pagada_at)})` : 'Pendiente',
        })),
      );
      if (!filas.length) return;
      void this.excel.descargar(
        `comisiones-${c.desde}-a-${c.hasta}.xlsx`,
        'Comisiones',
        [
          { clave: 'vendedor', titulo: 'Vendedor', ancho: 20 },
          { clave: 'pct', titulo: '% Comisión', ancho: 12 },
          { clave: 'operacion', titulo: 'Operación', ancho: 14 },
          { clave: 'unidad', titulo: 'Unidad', ancho: 24 },
          { clave: 'cliente', titulo: 'Cliente', ancho: 20 },
          { clave: 'fecha', titulo: 'Fecha cierre', ancho: 14 },
          { clave: 'moneda', titulo: 'Moneda', ancho: 10 },
          { clave: 'precio', titulo: 'Precio venta', ancho: 16 },
          { clave: 'comision', titulo: 'Comisión', ancho: 16 },
          { clave: 'estado_pago', titulo: 'Pago comisión', ancho: 20 },
        ],
        filas,
      );
      return;
    }

    const ops = this.lista();
    if (!ops.length) return;
    const filas = ops.map((o) => ({
      numero: o.numero,
      estado: o.estado,
      unidad: `${o.unidad.titulo} ${o.unidad.anio}`,
      dominio: o.unidad.dominio ?? '—',
      cliente: o.cliente_nombre,
      telefono: o.cliente_telefono ?? '',
      documento: o.cliente_documento ?? '',
      vendedor: o.vendedor?.nombre ?? '',
      moneda: o.moneda,
      precio: o.precio,
      pagado: o.pagado,
      saldo: o.saldo,
      fecha: v === 'reservas' ? fecha(o.reserva_vence) : fecha(o.cerrada_at ?? o.created_at),
    }));
    void this.excel.descargar(
      `operaciones-${v}-${hoy}.xlsx`,
      'Operaciones',
      [
        { clave: 'numero', titulo: 'Operación', ancho: 14 },
        { clave: 'estado', titulo: 'Estado', ancho: 14 },
        { clave: 'unidad', titulo: 'Unidad', ancho: 26 },
        { clave: 'dominio', titulo: 'Dominio', ancho: 14 },
        { clave: 'cliente', titulo: 'Cliente', ancho: 22 },
        { clave: 'telefono', titulo: 'Teléfono', ancho: 16 },
        { clave: 'documento', titulo: 'DNI / CUIT', ancho: 16 },
        { clave: 'vendedor', titulo: 'Vendedor', ancho: 18 },
        { clave: 'moneda', titulo: 'Moneda', ancho: 10 },
        { clave: 'precio', titulo: 'Precio acordado', ancho: 16 },
        { clave: 'pagado', titulo: 'Cobrado', ancho: 16 },
        { clave: 'saldo', titulo: 'Saldo', ancho: 16 },
        { clave: 'fecha', titulo: v === 'reservas' ? 'Vence reserva' : 'Fecha', ancho: 16 },
      ],
      filas,
    );
  }
}
