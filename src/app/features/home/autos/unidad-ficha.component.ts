import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';

import { AutosService, Billetera, EstadoPapel, Interesado, EstadoUnidad, MedioPago, Moneda, Operacion, Papel, Unidad } from './autos.service';
import { ROTULO_ESTADO, ROTULO_MEDIO, ROTULO_ORIGEN, ROTULO_PAPEL, TEXTO_SEMAFORO, claseDias, dominioLegible, fecha, monto, plata, renglon, textoDias } from './autos.util';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../auth/services/auth.service';
import { Rol } from '../../../core/interfaces/auth.interface';
import { urlFoto } from '../../../core/utils/foto-url.util';
import { DocumentosService } from '../../../core/services/documentos.service';
import { VentaAutoDoc } from '../../../core/services/documentos/boleto-auto.doc';
import { resumenDeBusqueda, textoProxima } from './interesados.util';

type Panel = '' | 'precio' | 'reservar' | 'pago' | 'cerrar' | 'anular' | 'salida';

/**
 * La ficha de un auto (diseño del 12/11/2026): lo que es, lo que lleva puesto,
 * sus papeles, sus fotos y su venta. Todo lo que cambia la unidad pasa por acá.
 */
@Component({
  selector: 'app-unidad-ficha',
  standalone: false,
  templateUrl: './unidad-ficha.component.html',
  styleUrls: ['./unidad-ficha.component.scss'],
})
export class UnidadFichaComponent implements OnInit {
  private api = inject(AutosService);
  private route = inject(ActivatedRoute);
  private notification = inject(NotificationService);
  private auth = inject(AuthService);
  private documentos = inject(DocumentosService);

  readonly rotuloEstado = ROTULO_ESTADO;
  readonly rotuloOrigen = ROTULO_ORIGEN;
  readonly rotuloPapel = ROTULO_PAPEL;
  readonly rotuloMedio = ROTULO_MEDIO;
  readonly textoSemaforo = TEXTO_SEMAFORO;
  readonly medios = Object.entries(ROTULO_MEDIO) as [MedioPago, string][];
  readonly estadosPapel: EstadoPapel[] = ['falta', 'en_tramite', 'ok'];
  readonly plata = plata;
  readonly renglon = renglon;
  readonly dominio = dominioLegible;
  readonly fecha = fecha;
  readonly claseDias = claseDias;
  readonly textoDias = textoDias;
  readonly foto = urlFoto;

  readonly esDuenio = computed(() => [Rol.ADMIN, Rol.SUPERADMIN].includes(this.auth.rol() as Rol));
  readonly esComercial = computed(() => this.esDuenio() || this.auth.rol() === Rol.MOSTRADOR);

  u = signal<Unidad | null>(null);
  op = signal<Operacion | null>(null);
  billeteras = signal<Billetera[]>([]);
  cargando = signal(true);
  ocupado = signal(false);
  panel = signal<Panel>('');
  fotoGrande = signal<string | null>(null);
  /** Quién consultó por este auto y a quién más le sirve (sólo para quien vende). */
  interesados = signal<{ consultaron: Interesado[]; coinciden: Interesado[] } | null>(null);
  readonly busqueda = resumenDeBusqueda;
  readonly proxima = textoProxima;

  gasto = { descripcion: '', monto: '', moneda: 'ARS' as Moneda, tipo_cambio: '' };
  precio = { precio_venta: '', costo: '', piso: '', descripcion: '' };
  reserva = { cliente_nombre: '', cliente_telefono: '', cliente_documento: '', precio: '', vence: '' };
  pago = this.pagoVacio();
  cierre = { comision: '' };
  anulacion = { motivo: '' };
  salida = { estado: 'baja' as EstadoUnidad, motivo: '' };

  ngOnInit(): void {
    this.route.paramMap.subscribe((p) => this.cargar(p.get('id') ?? ''));
    this.api.billeteras().subscribe({ next: (b) => this.billeteras.set(b), error: () => undefined });
  }

  cargar(id: string): void {
    // Al cambiar de auto en la misma pantalla se vuelven a pedir sus interesados.
    this.interesados.set(null);
    this.cargando.set(true);
    this.api.obtener(id).subscribe({
      next: (u) => { this.poner(u); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  abrir(p: Panel): void {
    const u = this.u();
    if (p === 'precio' && u) {
      this.precio = {
        precio_venta: u.precio_venta?.toString() ?? '', costo: u.costo_adquisicion ? u.costo_adquisicion.toString() : '',
        piso: u.precio_piso?.toString() ?? '', descripcion: u.descripcion ?? '',
      };
    }
    if (p === 'reservar' && u) this.reserva = { cliente_nombre: '', cliente_telefono: '', cliente_documento: '', precio: u.precio_venta?.toString() ?? '', vence: '' };
    if (p === 'pago') this.pago = this.pagoVacio();
    this.panel.set(this.panel() === p ? '' : p);
  }

  // ─── La unidad ────────────────────────────────────────────────────────────

  mover(estado: EstadoUnidad): void {
    this.hacer(this.api.cambiarEstado(this.id, estado), `Pasó a «${ROTULO_ESTADO[estado]}»`);
  }

  sacarDelStock(): void {
    if (this.salida.motivo.trim().length < 3) { this.notification.error('Decí por qué sale del stock.'); return; }
    this.hacer(this.api.cambiarEstado(this.id, this.salida.estado, this.salida.motivo.trim()), 'La unidad salió del stock');
  }

  publicar(publicada: boolean): void {
    this.hacer(this.api.publicar(this.id, publicada), publicada ? 'Publicada en el sitio' : 'Se quitó del sitio');
  }

  guardarPrecio(): void {
    const u = this.u();
    if (!u) return;
    const precio = this.precio.precio_venta.trim() ? monto(this.precio.precio_venta) : null;
    if (precio === null) { this.notification.error('El precio de venta no es un monto válido.'); return; }
    const cambios: Record<string, unknown> = { descripcion: this.precio.descripcion };
    if (precio !== u.precio_venta) cambios['precio_venta'] = precio;
    if (this.esDuenio() && u.origen === 'consignacion' && this.precio.piso.trim()) {
      const piso = monto(this.precio.piso);
      if (piso === null) { this.notification.error('El precio piso no es un monto válido.'); return; }
      if (piso !== u.precio_piso) cambios['precio_piso'] = piso;
    }
    if (this.esDuenio() && u.origen !== 'consignacion' && this.precio.costo.trim()) {
      const costo = monto(this.precio.costo);
      if (costo === null) { this.notification.error('El costo no es un monto válido.'); return; }
      if (costo !== u.costo_adquisicion) cambios['costo_adquisicion'] = costo;
    }
    this.hacer(this.api.editar(this.id, cambios), 'Guardado');
  }

  agregarGasto(): void {
    const u = this.u();
    const m = monto(this.gasto.monto);
    if (!u || this.gasto.descripcion.trim().length < 2) { this.notification.error('Decí en qué se gastó.'); return; }
    if (m === null) { this.notification.error('El monto no es válido.'); return; }
    const tc = this.gasto.moneda === u.moneda ? null : monto(this.gasto.tipo_cambio);
    if (this.gasto.moneda !== u.moneda && tc === null) { this.notification.error('Decí a cuánto estaba el dólar ese día.'); return; }
    const datos = { descripcion: this.gasto.descripcion.trim(), monto: m, moneda: this.gasto.moneda, ...(tc ? { tipo_cambio: tc } : {}) };
    this.hacer(this.api.agregarGasto(this.id, datos), 'Gasto cargado', () => {
      this.gasto = { descripcion: '', monto: '', moneda: this.gasto.moneda, tipo_cambio: this.gasto.tipo_cambio };
    });
  }

  quitarGasto(gastoId: string): void {
    this.hacer(this.api.quitarGasto(this.id, gastoId), 'Gasto quitado');
  }

  papel(p: Papel, estado: EstadoPapel, vence: string | null = p.vence): void {
    this.hacer(this.api.papel(this.id, p.tipo, { estado, ...(vence ? { vence } : {}), ...(p.nota ? { nota: p.nota } : {}) }), '');
  }

  subirFotos(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []);
    input.value = '';
    const seguir = (i: number): void => {
      if (i >= archivos.length) {
        this.ocupado.set(false);
        this.notification.success(archivos.length === 1 ? 'Foto subida' : `${archivos.length} fotos subidas`);
        return;
      }
      this.api.subirFoto(this.id, archivos[i]).subscribe({ next: (u) => { this.poner(u); seguir(i + 1); }, error: () => this.ocupado.set(false) });
    };
    if (archivos.length) { this.ocupado.set(true); seguir(0); }
  }

  portada(fotoId: string): void { this.hacer(this.api.portada(this.id, fotoId), 'Es la foto de portada'); }
  borrarFoto(fotoId: string): void { this.hacer(this.api.borrarFoto(this.id, fotoId), 'Foto quitada'); }

  // ─── La venta ─────────────────────────────────────────────────────────────

  reservar(): void {
    const r = this.reserva;
    if (r.cliente_nombre.trim().length < 2) { this.notification.error('Decí quién la reserva.'); return; }
    const precio = monto(r.precio);
    if (precio === null) { this.notification.error('El precio acordado no es un monto válido.'); return; }
    this.operar(this.api.reservar({
      unidad_id: this.id, cliente_nombre: r.cliente_nombre.trim(), precio,
      ...(r.cliente_telefono.trim() ? { cliente_telefono: r.cliente_telefono.trim() } : {}),
      ...(r.cliente_documento.trim() ? { cliente_documento: r.cliente_documento.trim() } : {}),
      ...(r.vence ? { reserva_vence: r.vence } : {}),
    }), 'Unidad reservada. Cargá la seña.');
  }

  pagar(): void {
    const o = this.op();
    const p = this.pago;
    const m = monto(p.monto);
    if (!o || m === null) { this.notification.error('El monto no es válido.'); return; }
    const tc = p.moneda === o.moneda ? null : monto(p.tipo_cambio);
    if (p.moneda !== o.moneda && tc === null) { this.notification.error('Decí a cuánto se tomó el dólar.'); return; }
    const datos: Record<string, unknown> = {
      medio: p.medio, monto: m, moneda: p.moneda,
      ...(tc ? { tipo_cambio: tc } : {}), ...(p.detalle.trim() ? { detalle: p.detalle.trim() } : {}),
    };
    if (p.medio === 'usado') {
      const anio = Number(p.toma.anio);
      if (!p.toma.dominio.trim() || p.toma.marca.trim().length < 2 || !p.toma.modelo.trim() || !Number.isInteger(anio)) {
        this.notification.error('Del usado que se toma hacen falta dominio, marca, modelo y año.'); return;
      }
      datos['toma'] = {
        dominio: p.toma.dominio.trim(), marca: p.toma.marca.trim(), modelo: p.toma.modelo.trim(), anio,
        km: Number(p.toma.km.replace(/\D/g, '')) || 0,
      };
    } else if (p.wallet_id) {
      datos['wallet_id'] = p.wallet_id;
    }
    this.operar(this.api.pagar(o.id, datos), p.medio === 'usado' ? 'Usado tomado: ya está en el stock' : 'Pago anotado');
  }

  quitarPago(pagoId: string): void {
    const o = this.op();
    if (o) this.operar(this.api.quitarPago(o.id, pagoId), 'Pago quitado');
  }

  cerrar(): void {
    const o = this.op();
    const comision = this.cierre.comision.trim() ? monto(this.cierre.comision) : null;
    if (this.cierre.comision.trim() && comision === null) { this.notification.error('La comisión no es un monto válido.'); return; }
    if (o) this.operar(this.api.cerrar(o.id, comision), 'Venta cerrada');
  }

  anular(): void {
    const o = this.op();
    if (this.anulacion.motivo.trim().length < 3) { this.notification.error('Decí por qué se cae la operación.'); return; }
    if (o) this.operar(this.api.anular(o.id, this.anulacion.motivo.trim()), 'Operación anulada: la unidad volvió a estar disponible');
  }

  // ─── Papeles de la venta ──────────────────────────────────────────────────

  recibo(pagoId: string): void {
    const venta = this.ventaParaDocumento();
    const n = this.op()?.pagos.findIndex((p) => p.id === pagoId) ?? -1;
    if (venta && n >= 0) void this.documentos.reciboDePagoAuto(venta, venta.pagos[n]);
  }

  boleto(): void {
    const venta = this.ventaParaDocumento();
    if (venta) void this.documentos.boletoAuto(venta);
  }

  private ventaParaDocumento(): VentaAutoDoc | null {
    const o = this.op();
    const u = this.u();
    if (!o || !u) return null;
    return {
      numero: o.numero, cliente_nombre: o.cliente_nombre, cliente_telefono: o.cliente_telefono, cliente_documento: o.cliente_documento,
      precio: o.precio, moneda: o.moneda, pagado: o.pagado, saldo: o.saldo, reserva_vence: o.reserva_vence,
      pagos: o.pagos.map((p) => ({ medio: p.medio, monto: p.monto, moneda: p.moneda, tipo_cambio: p.tipo_cambio, equivalente: p.equivalente, toma: p.toma, detalle: p.detalle, fecha: p.fecha })),
      unidad: { titulo: u.titulo, anio: u.anio, km: u.km, dominio: u.dominio, color: u.color, nro_motor: u.nro_motor, nro_chasis: u.nro_chasis, condicion: u.condicion },
    };
  }

  trackPorId(_: number, x: { id: string }): string { return x.id; }
  trackPorTipo(_: number, x: { tipo: string }): string { return x.tipo; }

  // ─── Internos ─────────────────────────────────────────────────────────────

  private get id(): string { return this.u()?.id ?? ''; }

  private poner(u: Unidad): void {
    this.u.set(u);
    if (this.esComercial() && this.interesados() === null) {
      this.api.interesadosDeUnidad(u.id).subscribe({ next: (i) => this.interesados.set(i), error: () => undefined });
    }
    if (!u.operacion) { this.op.set(null); return; }
    if (this.esComercial()) this.api.operacion(u.operacion.id).subscribe({ next: (o) => this.op.set(o), error: () => undefined });
  }

  /** Una acción sobre la unidad: el backend devuelve la ficha entera ya actualizada. */
  private hacer(pedido: Observable<Unidad>, mensaje: string, alTerminar?: () => void): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    pedido.subscribe({
      next: (u) => {
        this.ocupado.set(false);
        this.panel.set('');
        this.poner(u);
        alTerminar?.();
        if (mensaje) this.notification.success(mensaje);
      },
      error: () => this.ocupado.set(false),
    });
  }

  /** Una acción sobre la operación: cambia también la unidad, así que se vuelve a pedir. */
  private operar(pedido: Observable<Operacion>, mensaje: string): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    pedido.subscribe({
      next: (o) => {
        this.ocupado.set(false);
        this.panel.set('');
        this.op.set(o);
        this.notification.success(mensaje);
        this.api.obtener(o.unidad.id).subscribe({ next: (u) => this.poner(u), error: () => undefined });
      },
      error: () => this.ocupado.set(false),
    });
  }

  private pagoVacio() {
    return {
      medio: 'efectivo' as MedioPago, monto: '', moneda: (this.op()?.moneda ?? 'USD') as Moneda, tipo_cambio: '', wallet_id: '', detalle: '',
      toma: { dominio: '', marca: '', modelo: '', anio: '', km: '' },
    };
  }
}
