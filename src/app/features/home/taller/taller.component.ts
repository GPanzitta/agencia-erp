import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as QRCode from 'qrcode';

import { DocumentosService } from '../../../core/services/documentos.service';
import { ExcelService } from '../../../core/services/excel.service';
import { NotificationService } from '../../../core/services/notification.service';
import { urlFoto } from '../../../core/utils/foto-url.util';
import { Router } from '@angular/router';
import { AutosService, Moneda, Unidad } from '../autos/autos.service';
import { CAJAS, COMBUSTIBLES, MARCAS_SUGERIDAS, dominioLegible, estimarAnioPorPatente, fecha, km, modelosDeMarca, monto, plata } from '../autos/autos.util';
import { linkWhatsapp } from '../autos/interesados.util';
import {
  CATEGORIAS_REPUESTO,
  CategoriaRepuestoAuto,
  ETAPAS_ORDEN_ALISTAJE,
  EstadoOrdenAlistaje,
  FotoOrdenAlistaje,
  ItemChecklistAlistaje,
  OrdenAlistaje,
  OrdenCompraTaller,
  PrioridadOrdenAlistaje,
  ROTULO_CATEGORIA_REPUESTO,
  ROTULO_ESTADO_ORDEN,
  RenglonRepuestoOrden,
  RepuestoAuto,
  SECTORES_TALLER,
  TallerService,
} from './taller.service';

type SeccionPrincipal = 'ordenes' | 'compras' | 'repuestos';
type VistaOrden = 'activas' | 'listas' | 'anuladas' | 'todas';

@Component({
  selector: 'app-taller',
  standalone: false,
  templateUrl: './taller.component.html',
  styleUrls: ['./taller.component.scss'],
})
export class TallerComponent implements OnInit {
  private api = inject(TallerService);
  private autosApi = inject(AutosService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notification = inject(NotificationService);
  private documentos = inject(DocumentosService);
  private excel = inject(ExcelService);

  readonly plata = plata;
  readonly fecha = fecha;
  readonly km = km;
  readonly dominio = dominioLegible;
  readonly foto = urlFoto;
  readonly categoriasRepuesto = CATEGORIAS_REPUESTO;
  readonly rotuloCategoria = ROTULO_CATEGORIA_REPUESTO;
  readonly etapasOrden = ETAPAS_ORDEN_ALISTAJE;
  readonly rotuloEstado = ROTULO_ESTADO_ORDEN;
  readonly sectores = SECTORES_TALLER;
  readonly marcasSugeridas = MARCAS_SUGERIDAS;
  readonly combustibles = COMBUSTIBLES;
  readonly cajas = CAJAS;

  seccion = signal<SeccionPrincipal>('ordenes');
  vistaOrden = signal<VistaOrden>('activas');
  ordenes = signal<OrdenAlistaje[]>([]);
  repuestos = signal<RepuestoAuto[]>([]);
  compras = signal<OrdenCompraTaller[]>([]);
  unidadesStock = signal<Unidad[]>([]);
  cargando = signal(false);
  ocupado = signal(false);

  elegidaId = signal<string | null>(null);
  readonly elegida = computed(() => this.ordenes().find((o) => o.id === this.elegidaId()) ?? null);

  // Modal de galería y gestión de fotos de un repuesto
  repuestoGaleriaId = signal<string | null>(null);
  readonly repuestoGaleria = computed(() => this.repuestos().find((r) => r.id === this.repuestoGaleriaId()) ?? null);

  // Contadores de resumen de Órdenes, Compras y Pañol
  readonly kpis = computed(() => {
    const ords = this.ordenes();
    const reps = this.repuestos();
    const comps = this.compras();
    return {
      enCurso: ords.filter((o) => !['lista', 'anulada'].includes(o.estado)).length,
      urgentes: ords.filter((o) => o.prioridad === 'urgente_entrega' && !['lista', 'anulada'].includes(o.estado)).length,
      enQa: ords.filter((o) => o.estado === 'control_calidad').length,
      totalSkus: reps.length,
      bajoStock: reps.filter((r) => r.bajo_stock).length,
      comprasPendientes: comps.filter((c) => c.estado === 'pendiente').length,
    };
  });

  // ─── Formularios de Orden de Alistaje ─────────────────────────────────────
  nuevaOrdenAbierta = signal(false);
  nuevaOrden = this.ordenVacia();

  get modelosVehiculoCliente(): string[] {
    return modelosDeMarca(this.nuevaOrden.vehiculo.marca);
  }

  alCambiarDominioCliente(valor: string): void {
    this.nuevaOrden.vehiculo.dominio = valor.toUpperCase();
    if (!this.nuevaOrden.vehiculo.anio.trim()) {
      const est = estimarAnioPorPatente(valor);
      if (est) this.nuevaOrden.vehiculo.anio = String(est);
    }
  }

  edicionOrden = {
    sector: '',
    responsable: '',
    prioridad: 'normal' as PrioridadOrdenAlistaje,
    falla_motivo: '',
    diagnostico: '',
    trabajo_realizado: '',
    moneda: 'ARS' as Moneda,
    costo_mano_obra: '0',
    tipo_cambio: '1150',
  };

  repuestoEnOrden = {
    modo: 'panol' as 'panol' | 'libre',
    repuesto_id: '',
    nombre: '',
    codigo: '',
    cantidad: '1',
    moneda: 'ARS' as Moneda,
    costo_unitario: '',
    consumir_ahora: true,
  };

  get repuestoElegidoDelPanol(): RepuestoAuto | null {
    if (!this.repuestoEnOrden.repuesto_id) return null;
    return this.repuestos().find((r) => r.id === this.repuestoEnOrden.repuesto_id) ?? null;
  }

  alElegirRepuestoPanol(id: string): void {
    this.repuestoEnOrden.repuesto_id = id;
    const rp = this.repuestos().find((r) => r.id === id);
    if (rp) {
      this.repuestoEnOrden.consumir_ahora = rp.stock > 0;
    }
  }

  // ─── Formularios de Órdenes de Compra (OC) atadas a Orden o Pañol ─────────
  compraEnOrdenAbierta = signal(false);
  formCompraOrden = {
    proveedor: '',
    comprobante: '',
    notas: '',
    items: [] as {
      incluir: boolean;
      renglon_orden_id: string | null;
      repuesto_id: string | null;
      codigo: string;
      nombre: string;
      portada: string | null;
      cantidad: string;
      costo_unitario: string;
    }[],
  };

  nuevaCompraGeneralAbierta = signal(false);
  filtroEstadoCompra = signal<'todas' | 'pendiente' | 'recibida'>('todas');
  formCompraGeneral = {
    orden_id: '',
    proveedor: '',
    comprobante: '',
    moneda: 'ARS' as Moneda,
    notas: '',
    repuesto_id: '',
    nombre: '',
    codigo: '',
    cantidad: '2',
    costo_unitario: '',
  };

  readonly comprasFiltradas = computed(() => {
    const est = this.filtroEstadoCompra();
    return this.compras().filter((c) => (est === 'todas' ? true : c.estado === est));
  });

  pasarADisponibleAlCerrar = true;
  notaFotoOrden = '';
  etapaFotoOrden = 'en_trabajo';
  fotoAmpliada = signal<FotoOrdenAlistaje | null>(null);
  qrModal = signal<{ titulo: string; subtitulo: string; url: string; qrDataUrl: string } | null>(null);

  // ─── Formularios del Pañol de Repuestos ───────────────────────────────────
  busquedaRepuesto = signal('');
  filtroCategoria = signal('');
  soloBajoStock = signal(false);
  nuevoRepuestoAbierto = signal(false);
  editandoRepuestoId = signal<string | null>(null);
  formRepuesto = this.repuestoVacio();
  archivosFotosRepuestoForm: File[] = [];

  readonly repuestosFiltrados = computed(() => {
    const q = this.busquedaRepuesto().trim().toLowerCase();
    const cat = this.filtroCategoria();
    const bajo = this.soloBajoStock();
    return this.repuestos().filter((r) => {
      if (cat && r.categoria !== cat) return false;
      if (bajo && !r.bajo_stock) return false;
      if (q) {
        const str = `${r.codigo ?? ''} ${r.nombre} ${r.marca ?? ''} ${r.compatibilidad ?? ''} ${r.ubicacion ?? ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((p) => {
      const sec = p.get('seccion');
      if (sec === 'repuestos' || sec === 'compras') this.seccion.set(sec);
      const abrir = p.get('abrir');
      if (abrir) this.elegidaId.set(abrir);
      const unidadId = p.get('unidad');
      if (unidadId) {
        this.nuevaOrden.unidad_id = unidadId;
        this.nuevaOrdenAbierta.set(true);
      }
    });
    this.cargarTodo();
  }

  cargarTodo(): void {
    this.cargarOrdenes();
    this.cargarRepuestos();
    this.cargarCompras();
    this.autosApi.listar('stock').subscribe({ next: (u) => this.unidadesStock.set(u), error: () => undefined });
  }

  cargarCompras(): void {
    this.api.listarCompras().subscribe({
      next: (lista) => this.compras.set(lista),
      error: () => undefined,
    });
  }

  cambiarVistaOrden(v: VistaOrden): void {
    this.vistaOrden.set(v);
    this.cargarOrdenes();
  }

  cargarOrdenes(): void {
    this.cargando.set(true);
    this.api.listarOrdenes(this.vistaOrden()).subscribe({
      next: (lista) => {
        this.ordenes.set(lista);
        this.cargando.set(false);
        const el = this.elegida();
        if (el) this.hidratarEdicion(el);
        else if (lista.length && !this.elegidaId()) {
          this.elegirOrden(lista[0]);
        }
      },
      error: () => this.cargando.set(false),
    });
  }

  cargarRepuestos(): void {
    this.api.listarRepuestos().subscribe({
      next: (lista) => this.repuestos.set(lista),
      error: () => undefined,
    });
  }

  elegirOrden(o: OrdenAlistaje): void {
    if (this.elegidaId() === o.id) {
      this.elegidaId.set(null);
      return;
    }
    this.elegidaId.set(o.id);
    this.hidratarEdicion(o);
  }

  private hidratarEdicion(o: OrdenAlistaje): void {
    this.edicionOrden = {
      sector: o.sector,
      responsable: o.responsable ?? '',
      prioridad: o.prioridad,
      falla_motivo: o.falla_motivo,
      diagnostico: o.diagnostico ?? '',
      trabajo_realizado: o.trabajo_realizado ?? '',
      moneda: o.moneda,
      costo_mano_obra: String(o.costo_mano_obra ?? 0),
      tipo_cambio: o.tipo_cambio ? String(o.tipo_cambio) : '1150',
    };
  }

  crearOrden(): void {
    const n = this.nuevaOrden;
    const esCliente = n.tipo_origen === 'cliente';
    if (!esCliente && !n.unidad_id) {
      this.notification.error('Elegí qué vehículo del stock entra a alistaje/taller o seleccioná «Auto de un cliente externo».');
      return;
    }
    if (esCliente) {
      if (n.cliente.nombre.trim().length < 2) {
        this.notification.error('Poné el nombre del cliente dueño del auto.');
        return;
      }
      const anio = Number(n.vehiculo.anio);
      if (n.vehiculo.marca.trim().length < 2 || !n.vehiculo.modelo.trim() || !Number.isInteger(anio) || anio < 1900 || anio > 2100) {
        this.notification.error('Del vehículo del cliente completá Marca, Modelo y Año válido (1900 a 2100).');
        return;
      }
    }
    if (n.falla_motivo.trim().length < 3) {
      this.notification.error('Describí qué hay que hacerle o revisar en el vehículo.');
      return;
    }
    this.ocupado.set(true);
    const payload: Record<string, unknown> = {
      tipo_origen: n.tipo_origen,
      sector: n.sector,
      responsable: n.responsable.trim() || undefined,
      prioridad: n.prioridad,
      moneda: n.moneda,
      falla_motivo: n.falla_motivo.trim(),
    };
    if (esCliente) {
      payload['cliente'] = {
        nombre: n.cliente.nombre.trim(),
        telefono: n.cliente.telefono.trim() || undefined,
        documento: n.cliente.documento.trim() || undefined,
        email: n.cliente.email.trim() || undefined,
      };
      payload['vehiculo'] = {
        dominio: n.vehiculo.dominio.trim().toUpperCase() || undefined,
        marca: n.vehiculo.marca.trim(),
        modelo: n.vehiculo.modelo.trim(),
        version: n.vehiculo.version.trim() || undefined,
        anio: Number(n.vehiculo.anio),
        km: n.vehiculo.km.trim() ? Number(n.vehiculo.km.replace(/\D/g, '')) : 0,
        color: n.vehiculo.color.trim() || undefined,
        combustible: n.vehiculo.combustible || undefined,
        transmision: n.vehiculo.transmision || undefined,
      };
    } else {
      payload['unidad_id'] = n.unidad_id;
    }

    this.api.crearOrden(payload).subscribe({
      next: (creada) => {
        this.ocupado.set(false);
        this.nuevaOrdenAbierta.set(false);
        this.nuevaOrden = this.ordenVacia();
        this.ordenes.update((l) => [creada, ...l]);
        this.elegirOrden(creada);
        this.notification.success(
          creada.tipo_origen === 'cliente'
            ? `Orden de Taller ${creada.numero} creada para ${creada.cliente?.nombre} (${creada.unidad.titulo})`
            : `Orden de Alistaje ${creada.numero} creada`,
        );
      },
      error: () => this.ocupado.set(false),
    });
  }

  whatsappClienteOrden(o: OrdenAlistaje): string | null {
    if (!o.cliente?.telefono) return null;
    const estadoTxt = this.rotuloEstado[o.estado] ?? o.estado;
    const texto = `Te escribimos por tu *${o.unidad.titulo} ${o.unidad.anio}* (Orden *${o.numero}*).\nEstado actual: *${estadoTxt}*\n${o.diagnostico ? `Diagnóstico: ${o.diagnostico}\n` : ''}${o.total_orden > 0 ? `Presupuesto / Total: *${plata(o.total_orden, o.moneda)}*` : ''}`;
    return linkWhatsapp(o.cliente.telefono, o.cliente.nombre, texto);
  }

  pasarAutoDeClienteAlStock(o: OrdenAlistaje): void {
    const partes = o.unidad.titulo.split(' ');
    const marca = partes[0] ?? '';
    const modelo = partes.slice(1).join(' ') || o.unidad.titulo;
    this.router.navigate(['/home/autos/nueva'], {
      queryParams: {
        tomar: JSON.stringify({
          dominio: o.unidad.dominio,
          marca,
          modelo,
          anio: o.unidad.anio,
          km: o.km_ingreso || o.unidad.km,
          titular_nombre: o.cliente?.nombre ?? '',
          titular_telefono: o.cliente?.telefono ?? '',
          moneda: 'USD',
        }),
      },
    });
  }

  guardarFichaOrden(): void {
    const o = this.elegida();
    if (!o) return;
    const mo = this.edicionOrden.costo_mano_obra.trim() ? (monto(this.edicionOrden.costo_mano_obra) ?? 0) : 0;
    const tc = this.edicionOrden.tipo_cambio.trim() ? monto(this.edicionOrden.tipo_cambio) : null;
    this.ocupado.set(true);
    this.api
      .editarOrden(o.id, {
        sector: this.edicionOrden.sector,
        responsable: this.edicionOrden.responsable.trim() || null,
        prioridad: this.edicionOrden.prioridad,
        falla_motivo: this.edicionOrden.falla_motivo.trim(),
        diagnostico: this.edicionOrden.diagnostico.trim() || null,
        trabajo_realizado: this.edicionOrden.trabajo_realizado.trim() || null,
        moneda: this.edicionOrden.moneda,
        costo_mano_obra: mo,
        tipo_cambio: tc,
      })
      .subscribe({
        next: (act) => {
          this.ocupado.set(false);
          this.reemplazarOrden(act);
          this.notification.success('Diagnóstico, mano de obra y datos guardados');
        },
        error: () => this.ocupado.set(false),
      });
  }

  cambiarItemChecklist(item: ItemChecklistAlistaje, estado: 'pendiente' | 'ok' | 'reparar'): void {
    const o = this.elegida();
    if (!o || o.estado === 'lista' || o.estado === 'anulada') return;
    const nuevoChecklist = o.checklist.map((c) => (c.clave === item.clave ? { ...c, estado } : c));
    this.api.editarOrden(o.id, { checklist: nuevoChecklist }).subscribe({
      next: (act) => this.reemplazarOrden(act),
    });
  }

  guardarObservacionChecklist(item: ItemChecklistAlistaje, obs: string): void {
    const o = this.elegida();
    if (!o || o.estado === 'lista' || o.estado === 'anulada') return;
    const nuevoChecklist = o.checklist.map((c) => (c.clave === item.clave ? { ...c, observacion: obs.trim() || null } : c));
    this.api.editarOrden(o.id, { checklist: nuevoChecklist }).subscribe({
      next: (act) => this.reemplazarOrden(act),
    });
  }

  agregarRepuestoAOrden(): void {
    const o = this.elegida();
    if (!o) return;
    const r = this.repuestoEnOrden;
    const cant = Number(r.cantidad.replace(',', '.'));
    if (!Number.isFinite(cant) || cant <= 0) {
      this.notification.error('La cantidad debe ser mayor a 0.');
      return;
    }

    const payload: Record<string, unknown> = {
      cantidad: cant,
      consumir_ahora: r.consumir_ahora,
    };
    if (r.modo === 'panol') {
      if (!r.repuesto_id) {
        this.notification.error('Elegí un repuesto del pañol.');
        return;
      }
      payload['repuesto_id'] = r.repuesto_id;
    } else {
      if (r.nombre.trim().length < 2) {
        this.notification.error('Escribí el nombre del repuesto o insumo.');
        return;
      }
      payload['nombre'] = r.nombre.trim();
      if (r.codigo.trim()) payload['codigo'] = r.codigo.trim();
      payload['moneda'] = r.moneda;
      payload['costo_unitario'] = monto(r.costo_unitario) ?? 0;
    }

    this.ocupado.set(true);
    this.api.agregarRepuesto(o.id, payload).subscribe({
      next: (act) => {
        this.ocupado.set(false);
        this.reemplazarOrden(act);
        this.cargarRepuestos();
        this.repuestoEnOrden = {
          ...this.repuestoEnOrden,
          repuesto_id: '',
          nombre: '',
          codigo: '',
          cantidad: '1',
          costo_unitario: '',
          consumir_ahora: true,
        };
        this.notification.success('Repuesto asignado a la orden');
      },
      error: () => this.ocupado.set(false),
    });
  }

  consumirRepuestoDeOrden(r: RenglonRepuestoOrden): void {
    const o = this.elegida();
    if (!o) return;
    this.ocupado.set(true);
    this.api.consumirRepuesto(o.id, r.id).subscribe({
      next: (act) => {
        this.ocupado.set(false);
        this.reemplazarOrden(act);
        this.cargarRepuestos();
        this.notification.success(`«${r.nombre}» consumido en ${o.numero} y descontado del stock del pañol`);
      },
      error: () => this.ocupado.set(false),
    });
  }

  faltantesSinOc(o: OrdenAlistaje): RenglonRepuestoOrden[] {
    return o.repuestos.filter((r) => !r.consumido && !r.ingresado && !r.compra_id);
  }

  abrirCompraAtadaAOrden(o: OrdenAlistaje): void {
    const faltantes = this.faltantesSinOc(o);
    const itemsBase: {
      incluir: boolean;
      renglon_orden_id: string | null;
      repuesto_id: string | null;
      codigo: string;
      nombre: string;
      portada: string | null;
      cantidad: string;
      costo_unitario: string;
    }[] = (faltantes.length ? faltantes : o.repuestos.filter((r) => !r.consumido)).map((r) => ({
      incluir: true,
      renglon_orden_id: r.id,
      repuesto_id: r.repuesto_id,
      codigo: r.codigo ?? '',
      nombre: r.nombre,
      portada: r.portada,
      cantidad: String(r.cantidad),
      costo_unitario: String(r.costo_unitario),
    }));
    if (!itemsBase.length) {
      itemsBase.push({
        incluir: true,
        renglon_orden_id: null,
        repuesto_id: null,
        codigo: '',
        nombre: '',
        portada: null,
        cantidad: '1',
        costo_unitario: '',
      });
    }
    this.formCompraOrden = {
      proveedor: 'Distribuidora Warnes',
      comprobante: '',
      notas: `Compra de repuestos atada a Orden ${o.numero} (${o.unidad.titulo})`,
      items: itemsBase,
    };
    this.compraEnOrdenAbierta.set(true);
  }

  agregarRenglonExtraCompraOrden(): void {
    this.formCompraOrden.items.push({
      incluir: true,
      renglon_orden_id: null,
      repuesto_id: null,
      codigo: '',
      nombre: '',
      portada: null,
      cantidad: '1',
      costo_unitario: '',
    });
  }

  alElegirRepuestoEnCompraOrden(idx: number, repuestoId: string): void {
    const item = this.formCompraOrden.items[idx];
    if (!item) return;
    item.repuesto_id = repuestoId || null;
    const rp = this.repuestos().find((r) => r.id === repuestoId);
    if (rp) {
      item.nombre = rp.nombre;
      item.codigo = rp.codigo ?? '';
      item.portada = rp.portada;
      item.costo_unitario = String(rp.costo);
      if (!this.formCompraOrden.proveedor.trim() && rp.proveedor) {
        this.formCompraOrden.proveedor = rp.proveedor;
      }
    }
  }

  guardarCompraAtadaAOrden(): void {
    const o = this.elegida();
    if (!o) return;
    const f = this.formCompraOrden;
    if (f.proveedor.trim().length < 2) {
      this.notification.error('Indicá el proveedor de la compra.');
      return;
    }
    const items = f.items
      .filter((it) => it.incluir && (it.repuesto_id || it.nombre.trim().length >= 2))
      .map((it) => ({
        renglon_orden_id: it.renglon_orden_id || undefined,
        repuesto_id: it.repuesto_id || undefined,
        codigo: it.codigo.trim() || undefined,
        nombre: it.nombre.trim() || undefined,
        cantidad: Number(it.cantidad.replace(',', '.')) || 1,
        costo_unitario: monto(it.costo_unitario) ?? 0,
      }));
    if (!items.length) {
      this.notification.error('Seleccioná o completá al menos un repuesto a comprar.');
      return;
    }

    this.ocupado.set(true);
    this.api
      .crearCompra({
        orden_id: o.id,
        proveedor: f.proveedor.trim(),
        comprobante: f.comprobante.trim() || undefined,
        moneda: o.moneda,
        notas: f.notas.trim() || undefined,
        items,
      })
      .subscribe({
        next: (oc) => {
          this.ocupado.set(false);
          this.compraEnOrdenAbierta.set(false);
          this.cargarCompras();
          this.api.obtenerOrden(o.id).subscribe({ next: (act) => this.reemplazarOrden(act) });
          this.notification.success(`Orden de Compra ${oc.numero} generada y atada a ${o.numero}`);
        },
        error: () => this.ocupado.set(false),
      });
  }

  recibirOrdenCompra(oc: OrdenCompraTaller, consumirEnOrden = true): void {
    this.ocupado.set(true);
    this.api.recibirCompra(oc.id, { consumir_en_orden: consumirEnOrden }).subscribe({
      next: (recibida) => {
        this.ocupado.set(false);
        this.cargarCompras();
        this.cargarRepuestos();
        this.cargarOrdenes();
        const msg =
          recibida.orden_numero && consumirEnOrden
            ? `Compra ${recibida.numero} recibida: ingresó al pañol y se descontó automáticamente al consumirse en ${recibida.orden_numero}`
            : `Compra ${recibida.numero} recibida: stock ingresado al pañol`;
        this.notification.success(msg);
      },
      error: () => this.ocupado.set(false),
    });
  }

  cancelarOrdenCompra(oc: OrdenCompraTaller): void {
    this.ocupado.set(true);
    this.api.cancelarCompra(oc.id).subscribe({
      next: (canc) => {
        this.ocupado.set(false);
        this.cargarCompras();
        this.cargarOrdenes();
        this.notification.success(`Orden de Compra ${canc.numero} cancelada`);
      },
      error: () => this.ocupado.set(false),
    });
  }

  alElegirRepuestoCompraGeneral(repuestoId: string): void {
    this.formCompraGeneral.repuesto_id = repuestoId;
    const rp = this.repuestos().find((r) => r.id === repuestoId);
    if (rp) {
      this.formCompraGeneral.nombre = rp.nombre;
      this.formCompraGeneral.codigo = rp.codigo ?? '';
      this.formCompraGeneral.costo_unitario = String(rp.costo);
      this.formCompraGeneral.moneda = rp.moneda;
      if (rp.proveedor) this.formCompraGeneral.proveedor = rp.proveedor;
    }
  }

  crearCompraGeneral(): void {
    const f = this.formCompraGeneral;
    if (f.proveedor.trim().length < 2) {
      this.notification.error('Indicá el proveedor.');
      return;
    }
    if (!f.repuesto_id && f.nombre.trim().length < 2) {
      this.notification.error('Elegí un repuesto del pañol o escribí el nombre del insumo nuevo.');
      return;
    }
    const cant = Number(f.cantidad.replace(',', '.'));
    if (!Number.isFinite(cant) || cant <= 0) {
      this.notification.error('La cantidad debe ser mayor a 0.');
      return;
    }
    this.ocupado.set(true);
    this.api
      .crearCompra({
        orden_id: f.orden_id || undefined,
        proveedor: f.proveedor.trim(),
        comprobante: f.comprobante.trim() || undefined,
        moneda: f.moneda,
        notas: f.notas.trim() || undefined,
        items: [
          {
            repuesto_id: f.repuesto_id || undefined,
            nombre: f.nombre.trim() || undefined,
            codigo: f.codigo.trim() || undefined,
            cantidad: cant,
            costo_unitario: monto(f.costo_unitario) ?? 0,
          },
        ],
      })
      .subscribe({
        next: (oc) => {
          this.ocupado.set(false);
          this.nuevaCompraGeneralAbierta.set(false);
          this.formCompraGeneral = {
            orden_id: '',
            proveedor: '',
            comprobante: '',
            moneda: 'ARS',
            notas: '',
            repuesto_id: '',
            nombre: '',
            codigo: '',
            cantidad: '2',
            costo_unitario: '',
          };
          this.cargarCompras();
          if (oc.orden_id) this.cargarOrdenes();
          this.notification.success(`Orden de Compra ${oc.numero} creada`);
        },
        error: () => this.ocupado.set(false),
      });
  }

  quitarRepuestoDeOrden(renglonId: string): void {
    const o = this.elegida();
    if (!o) return;
    this.ocupado.set(true);
    this.api.quitarRepuesto(o.id, renglonId).subscribe({
      next: (act) => {
        this.ocupado.set(false);
        this.reemplazarOrden(act);
        this.cargarRepuestos();
        this.notification.success('Repuesto quitado de la orden');
      },
      error: () => this.ocupado.set(false),
    });
  }

  moverEstadoOrden(nuevoEstado: EstadoOrdenAlistaje): void {
    const o = this.elegida();
    if (!o) return;
    const tc = monto(this.edicionOrden.tipo_cambio) ?? o.tipo_cambio ?? 1150;
    this.ocupado.set(true);
    this.api
      .cambiarEstado(o.id, {
        estado: nuevoEstado,
        pasar_unidad_a_disponible: nuevoEstado === 'lista' ? this.pasarADisponibleAlCerrar : false,
        tipo_cambio: tc,
      })
      .subscribe({
        next: (act) => {
          this.ocupado.set(false);
          this.reemplazarOrden(act);
          if (nuevoEstado === 'anulada') this.cargarRepuestos();
          const msg =
            nuevoEstado === 'lista'
              ? `Orden ${act.numero} finalizada · Gasto imputado a la unidad ${act.unidad.numero}`
              : `Orden ${act.numero} pasó a «${this.rotuloEstado[nuevoEstado]}»`;
          this.notification.success(msg);
        },
        error: () => this.ocupado.set(false),
      });
  }

  subirFotosOrden(evento: Event): void {
    const o = this.elegida();
    const input = evento.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []).filter((a) => a.type.startsWith('image/'));
    input.value = '';
    if (!o || !archivos.length) return;
    this.ocupado.set(true);
    this.api.subirFotos(o.id, archivos, this.notaFotoOrden.trim(), this.etapaFotoOrden).subscribe({
      next: (act) => {
        this.ocupado.set(false);
        this.notaFotoOrden = '';
        this.reemplazarOrden(act);
        this.notification.success(archivos.length === 1 ? 'Foto agregada a la orden' : `${archivos.length} fotos agregadas a la orden`);
      },
      error: () => this.ocupado.set(false),
    });
  }

  borrarFotoOrden(fotoId: string): void {
    const o = this.elegida();
    if (!o) return;
    this.ocupado.set(true);
    this.api.borrarFoto(o.id, fotoId).subscribe({
      next: (act) => {
        this.ocupado.set(false);
        this.reemplazarOrden(act);
        this.notification.success('Foto eliminada');
      },
      error: () => this.ocupado.set(false),
    });
  }

  imprimirOrden(o: OrdenAlistaje): void {
    const urlOrden = `${location.origin}/home/taller?abrir=${o.id}`;
    void this.documentos.ordenDeAlistajeAuto(o, urlOrden);
  }

  async mostrarQrOrden(o: OrdenAlistaje): Promise<void> {
    const url = `${location.origin}/home/taller?abrir=${o.id}`;
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });
    this.qrModal.set({
      titulo: `QR de Orden de Alistaje ${o.numero}`,
      subtitulo: `Pegalo en la carpeta de taller o llave del ${o.unidad.titulo} (${o.unidad.numero}) para abrir el checklist, repuestos y fotos escaneando desde el celular.`,
      url,
      qrDataUrl,
    });
  }

  copiarUrlQr(url: string): void {
    void navigator.clipboard?.writeText(url);
    this.notification.success('Enlace de la orden copiado');
  }

  // ─── Acciones del Pañol de Repuestos ──────────────────────────────────────

  abrirNuevoRepuesto(): void {
    this.editandoRepuestoId.set(null);
    this.formRepuesto = this.repuestoVacio();
    this.archivosFotosRepuestoForm = [];
    this.nuevoRepuestoAbierto.set(true);
  }

  abrirEdicionRepuesto(r: RepuestoAuto): void {
    this.editandoRepuestoId.set(r.id);
    this.archivosFotosRepuestoForm = [];
    this.formRepuesto = {
      codigo: r.codigo ?? '',
      nombre: r.nombre,
      categoria: r.categoria,
      marca: r.marca ?? '',
      compatibilidad: r.compatibilidad ?? '',
      ubicacion: r.ubicacion ?? '',
      unidad_medida: r.unidad_medida,
      stock: String(r.stock),
      stock_minimo: String(r.stock_minimo),
      moneda: r.moneda,
      costo: String(r.costo),
      proveedor: r.proveedor ?? '',
    };
    this.nuevoRepuestoAbierto.set(true);
  }

  alSeleccionarFotosRepuestoForm(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.archivosFotosRepuestoForm = Array.from(input.files ?? []).filter((a) => a.type.startsWith('image/'));
  }

  guardarRepuesto(): void {
    const f = this.formRepuesto;
    if (f.nombre.trim().length < 2) {
      this.notification.error('Poné el nombre del repuesto o insumo.');
      return;
    }
    const payload = {
      nombre: f.nombre.trim(),
      codigo: f.codigo.trim() || undefined,
      categoria: f.categoria,
      marca: f.marca.trim() || undefined,
      compatibilidad: f.compatibilidad.trim() || undefined,
      ubicacion: f.ubicacion.trim() || undefined,
      unidad_medida: f.unidad_medida.trim() || 'un',
      stock: Number(f.stock) || 0,
      stock_minimo: Number(f.stock_minimo) || 0,
      moneda: f.moneda,
      costo: monto(f.costo) ?? 0,
      proveedor: f.proveedor.trim() || undefined,
    };

    this.ocupado.set(true);
    const idEdit = this.editandoRepuestoId();
    const fotosASubir = [...this.archivosFotosRepuestoForm];
    const obs = idEdit ? this.api.editarRepuesto(idEdit, payload) : this.api.crearRepuesto(payload);
    obs.subscribe({
      next: (guardado) => {
        const finalizar = () => {
          this.ocupado.set(false);
          this.nuevoRepuestoAbierto.set(false);
          this.editandoRepuestoId.set(null);
          this.archivosFotosRepuestoForm = [];
          this.cargarRepuestos();
          this.cargarOrdenes();
          this.notification.success(idEdit ? 'Repuesto actualizado' : 'Repuesto agregado al pañol');
        };
        if (fotosASubir.length) {
          this.api.subirFotosRepuesto(guardado.id, fotosASubir).subscribe({
            next: () => finalizar(),
            error: () => finalizar(),
          });
        } else {
          finalizar();
        }
      },
      error: () => this.ocupado.set(false),
    });
  }

  abrirGaleriaRepuesto(repuestoId: string | null): void {
    if (!repuestoId) return;
    this.repuestoGaleriaId.set(repuestoId);
  }

  subirFotosARepuesto(r: RepuestoAuto, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []).filter((a) => a.type.startsWith('image/'));
    input.value = '';
    if (!archivos.length) return;
    this.ocupado.set(true);
    this.api.subirFotosRepuesto(r.id, archivos).subscribe({
      next: (act) => {
        this.ocupado.set(false);
        this.repuestos.update((l) => l.map((x) => (x.id === act.id ? act : x)));
        this.cargarOrdenes();
        this.notification.success(archivos.length === 1 ? 'Foto agregada al repuesto' : `${archivos.length} fotos agregadas al repuesto`);
      },
      error: () => this.ocupado.set(false),
    });
  }

  borrarFotoDeRepuesto(r: RepuestoAuto, fotoId: string): void {
    this.ocupado.set(true);
    this.api.borrarFotoRepuesto(r.id, fotoId).subscribe({
      next: (act) => {
        this.ocupado.set(false);
        this.repuestos.update((l) => l.map((x) => (x.id === act.id ? act : x)));
        this.cargarOrdenes();
        this.notification.success('Foto del repuesto eliminada');
      },
      error: () => this.ocupado.set(false),
    });
  }

  ajustarStock(r: RepuestoAuto, delta: number): void {
    this.api.ajustarStock(r.id, delta).subscribe({
      next: (act) => {
        this.repuestos.update((l) => l.map((x) => (x.id === act.id ? act : x)));
        this.notification.success(`Stock de «${act.nombre}»: ${act.stock} ${act.unidad_medida}`);
      },
    });
  }

  exportarRepuestosExcel(): void {
    const filas = this.repuestosFiltrados().map((r) => ({
      codigo: r.codigo ?? '—',
      nombre: r.nombre,
      categoria: this.rotuloCategoria[r.categoria] ?? r.categoria,
      marca: r.marca ?? '',
      compatibilidad: r.compatibilidad ?? '',
      ubicacion: r.ubicacion ?? '',
      stock: r.stock,
      minimo: r.stock_minimo,
      estado: r.bajo_stock ? 'REPONER' : 'OK',
      moneda: r.moneda,
      costo: r.costo,
      proveedor: r.proveedor ?? '',
    }));
    if (!filas.length) return;
    const hoy = new Date().toISOString().slice(0, 10);
    void this.excel.descargar(
      `panol-repuestos-${hoy}.xlsx`,
      'Repuestos',
      [
        { clave: 'codigo', titulo: 'Código SKU', ancho: 16 },
        { clave: 'nombre', titulo: 'Repuesto / Insumo', ancho: 28 },
        { clave: 'categoria', titulo: 'Categoría', ancho: 24 },
        { clave: 'marca', titulo: 'Marca', ancho: 16 },
        { clave: 'compatibilidad', titulo: 'Compatibilidad', ancho: 24 },
        { clave: 'ubicacion', titulo: 'Ubicación', ancho: 14 },
        { clave: 'stock', titulo: 'Stock actual', ancho: 12 },
        { clave: 'minimo', titulo: 'Stock mín.', ancho: 12 },
        { clave: 'estado', titulo: 'Alerta', ancho: 12 },
        { clave: 'moneda', titulo: 'Moneda', ancho: 10 },
        { clave: 'costo', titulo: 'Costo unit.', ancho: 14 },
        { clave: 'proveedor', titulo: 'Proveedor', ancho: 20 },
      ],
      filas,
    );
  }

  trackPorId(_: number, x: { id: string }): string {
    return x.id;
  }

  private reemplazarOrden(act: OrdenAlistaje): void {
    this.ordenes.update((l) => l.map((x) => (x.id === act.id ? act : x)));
    if (this.elegidaId() === act.id) this.hidratarEdicion(act);
  }

  private ordenVacia() {
    return {
      tipo_origen: 'stock' as 'stock' | 'cliente',
      unidad_id: '',
      sector: 'Service y alistaje de ingreso',
      responsable: '',
      prioridad: 'normal' as PrioridadOrdenAlistaje,
      moneda: 'ARS' as Moneda,
      falla_motivo: '',
      cliente: {
        nombre: '',
        telefono: '',
        documento: '',
        email: '',
      },
      vehiculo: {
        dominio: '',
        marca: '',
        modelo: '',
        version: '',
        anio: '',
        km: '',
        color: '',
        combustible: '',
        transmision: '',
      },
    };
  }

  private repuestoVacio() {
    return {
      codigo: '',
      nombre: '',
      categoria: 'filtros_fluidos' as CategoriaRepuestoAuto,
      marca: '',
      compatibilidad: '',
      ubicacion: '',
      unidad_medida: 'un',
      stock: '2',
      stock_minimo: '1',
      moneda: 'ARS' as Moneda,
      costo: '',
      proveedor: '',
    };
  }
}
