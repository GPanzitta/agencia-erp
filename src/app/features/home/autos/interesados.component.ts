import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';

import { AutosService, EtapaInteresado, Interesado, Unidad, UsadoDelInteresado } from './autos.service';
import { CAJAS, CARROCERIAS, COMBUSTIBLES, LINKS_MULTAS_DNRPA, MARCAS_SUGERIDAS, estimarAnioPorPatente, fecha, km, modelosDeMarca, monto, plata, urlDelSitio } from './autos.util';
import { ETAPAS_DEL_TABLERO, ORIGENES, ROTULO_ETAPA, TEMPERATURAS, claseProxima, cuentas, linkWhatsapp, mensajeDeCotizacion, ordenar, resumenDeBusqueda, rotuloOrigen, textoProxima } from './interesados.util';
import { NotificationService } from '../../../core/services/notification.service';
import { DocumentosService } from '../../../core/services/documentos.service';
import { PeritajeTomaDoc } from '../../../core/services/documentos/boleto-auto.doc';
import { urlFoto } from '../../../core/utils/foto-url.util';
import { environment } from '../../../../environments/environment';
import * as QRCode from 'qrcode';

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
  private documentos = inject(DocumentosService);

  readonly etapas = ETAPAS_DEL_TABLERO;
  readonly rotuloEtapa = ROTULO_ETAPA;
  readonly origenes = ORIGENES;
  readonly temperaturas = TEMPERATURAS;
  readonly carrocerias = CARROCERIAS;
  readonly combustibles = COMBUSTIBLES;
  readonly cajas = CAJAS;
  readonly marcasSugeridas = MARCAS_SUGERIDAS;
  readonly linksMultas = LINKS_MULTAS_DNRPA;
  readonly tiposVehiculo = ['Auto', 'Pick-up', 'SUV', 'Utilitario', 'Moto', 'Otro'];
  readonly coberturasSeguro = ['Todo Riesgo', 'Terceros Completo', 'Responsabilidad Civil', 'Sin seguro'];
  readonly provincias = [
    'CABA', 'Buenos Aires (GBA / Interior)', 'Córdoba', 'Santa Fe', 'Mendoza', 'Entre Ríos',
    'Tucumán', 'Salta', 'Neuquén', 'Río Negro', 'Chubut', 'San Luis', 'San Juan', 'Corrientes', 'Misiones', 'Otra provincia',
  ];
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
  unidadesStock = signal<Unidad[]>([]);
  sitioUrl = signal<string>(environment.portalUrl);
  cargando = signal(false);
  ocupado = signal(false);
  elegidoId = signal<string | null>(null);
  nuevoAbierto = signal(false);
  perdiendo = signal(false);
  peritajeAbierto = signal(false);
  editandoUsado = signal(false);
  fotoAmpliada = signal<string | null>(null);
  qrModal = signal<{ titulo: string; subtitulo: string; url: string; qrDataUrl: string } | null>(null);
  fotosNuevo: File[] = [];

  readonly elegido = computed(() => this.lista().find((i) => i.id === this.elegidoId()) ?? null);
  readonly cuentas = computed(() => cuentas(this.lista()));
  readonly columnas = computed(() => this.etapas.map((e) => ({ ...e, items: ordenar(this.lista().filter((i) => i.etapa === e.valor)) })));

  nuevo = this.vacio();
  usadoEdit = this.usadoVacio();
  nota = { texto: '', proxima_accion: '', proxima_nota: '' };
  perdida = { motivo: '' };
  cotiza = { valor: '', moneda: 'USD' as 'USD' | 'ARS', nota: '' };
  peritaje = {
    referencia: '',
    chapa: '',
    neumaticos: '',
    mecanica: '',
    interior: '',
    papeles: '',
    margen_pct: '10',
  };

  ngOnInit(): void {
    // Desde la ficha de un auto se llega con ?abrir=<id> para caer sobre un interesado.
    this.elegidoId.set(this.route.snapshot.queryParamMap.get('abrir'));
    this.cargar();
    this.api.listar('stock').subscribe({ next: (u) => this.unidadesStock.set(u), error: () => undefined });
    this.api.sitio().subscribe({ next: (s) => this.sitioUrl.set(urlDelSitio(environment.portalUrl, s.slug)), error: () => undefined });
    // Sin tocar nada mientras alguien escribe una nota o carga un interesado.
    this.reloj = setInterval(() => {
      if (!this.ocupado() && !this.nuevoAbierto() && !this.editandoUsado() && !this.nota.texto && !this.cotiza.valor && document.visibilityState === 'visible') this.cargar();
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
    this.editandoUsado.set(false);
    this.nota = { texto: '', proxima_accion: '', proxima_nota: '' };
  }

  get modelosNuevoUsado(): string[] {
    return modelosDeMarca(this.nuevo.usado.marca);
  }

  get modelosEditUsado(): string[] {
    return modelosDeMarca(this.usadoEdit.marca);
  }

  alCambiarDominioNuevo(valor: string): void {
    this.nuevo.usado.dominio = valor.toUpperCase();
    if (!this.nuevo.usado.anio.trim()) {
      const est = estimarAnioPorPatente(valor);
      if (est) this.nuevo.usado.anio = String(est);
    }
  }

  alCambiarDominioEdit(valor: string): void {
    this.usadoEdit.dominio = valor.toUpperCase();
    if (!this.usadoEdit.anio.trim()) {
      const est = estimarAnioPorPatente(valor);
      if (est) this.usadoEdit.anio = String(est);
    }
  }

  elegirFotosNuevo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []).filter((a) => a.type.startsWith('image/'));
    input.value = '';
    this.fotosNuevo = [...this.fotosNuevo, ...archivos].slice(0, 6);
  }

  quitarFotoNuevo(idx: number): void {
    this.fotosNuevo.splice(idx, 1);
  }

  private armarObjetoUsado(u: ReturnType<InteresadosComponent['usadoVacio']>): UsadoDelInteresado | null {
    const marca = u.marca.trim();
    const modelo = u.modelo.trim();
    const anio = Number(u.anio);
    if (!marca || !modelo || !Number.isInteger(anio) || anio < 1900 || anio > 2100) return null;
    const kmNum = u.km.trim() ? Number(u.km.replace(/\D/g, '')) : null;
    const guia = {
      uso: u.guia.uso.trim() || null,
      guardado: u.guia.guardado.trim() || null,
      motivo_venta: u.guia.motivo_venta.trim() || null,
      ultimo_service: u.guia.ultimo_service || null,
      ultima_vtv: u.guia.ultima_vtv || null,
      mantenimiento: u.guia.mantenimiento.trim() || null,
      neumaticos: u.guia.neumaticos.trim() || null,
      transferencia: u.guia.transferencia.trim() || null,
      agregados: u.guia.agregados.trim() || null,
      paneles_choques: u.guia.paneles_choques.trim() || null,
      reparaciones: u.guia.reparaciones.trim() || null,
    };
    const tieneGuia = Object.values(guia).some(Boolean);
    return {
      tipo_vehiculo: u.tipo_vehiculo || null,
      carroceria: u.carroceria || null,
      dominio: u.dominio.trim().toUpperCase() || null,
      marca,
      modelo,
      version: u.version.trim() || null,
      anio,
      km: kmNum !== null && Number.isFinite(kmNum) ? kmNum : null,
      combustible: u.combustible || null,
      transmision: u.transmision || null,
      seguro_compania: u.seguro_compania.trim() || null,
      seguro_cobertura: u.seguro_cobertura || null,
      seguro_cuota: monto(u.seguro_cuota),
      costo_patente: monto(u.costo_patente),
      radicacion: u.radicacion || null,
      descripcion: u.descripcion.trim() || null,
      guia: tieneGuia ? guia : null,
    };
  }

  crear(): void {
    const n = this.nuevo;
    if (n.nombre.trim().length < 2) { this.notification.error('Poné el nombre.'); return; }
    if (!n.telefono.trim()) { this.notification.error('Cargá un teléfono: sin eso no hay cómo volver a hablarle.'); return; }
    const tope = n.precio_max.trim() ? monto(n.precio_max) : null;
    if (n.precio_max.trim() && tope === null) { this.notification.error('El tope de precio no es un monto válido.'); return; }

    let usadoObj: UsadoDelInteresado | null = null;
    let resumenUsado = n.tiene_usado.trim();
    if (n.carga_usado) {
      usadoObj = this.armarObjetoUsado(n.usado);
      if (!usadoObj) {
        this.notification.error('Para cargar la ficha del usado completá al menos Marca, Modelo y Año válido.');
        return;
      }
      if (!resumenUsado) {
        const kmTxt = usadoObj.km !== null ? `${usadoObj.km.toLocaleString('es-AR')} km` : null;
        resumenUsado = [usadoObj.marca, usadoObj.modelo, usadoObj.version, usadoObj.anio, kmTxt, usadoObj.dominio ? `[${usadoObj.dominio}]` : null]
          .filter(Boolean)
          .join(' ');
      }
    }

    const archivosParaSubir = [...this.fotosNuevo];
    this.hacer(this.api.crearInteresado({
      nombre: n.nombre.trim(), telefono: n.telefono.trim(), origen: n.origen, temperatura: n.temperatura,
      ...(n.unidad_id ? { unidad_id: n.unidad_id } : {}),
      ...(n.busca.trim() ? { busca: n.busca.trim() } : {}),
      ...(n.busca_marca.trim() ? { busca_marca: n.busca_marca.trim() } : {}),
      ...(n.busca_carroceria ? { busca_carroceria: n.busca_carroceria } : {}),
      ...(tope ? { precio_max: tope, precio_moneda: n.precio_moneda } : {}),
      ...(resumenUsado ? { tiene_usado: resumenUsado } : {}),
      ...(usadoObj ? { usado: usadoObj } : {}),
      ...(n.proxima_accion ? { proxima_accion: n.proxima_accion } : {}),
      ...(n.nota.trim() ? { nota: n.nota.trim() } : {}),
    }), 'Interesado cargado', (creado) => {
      this.nuevoAbierto.set(false);
      this.nuevo = this.vacio();
      this.fotosNuevo = [];
      if (archivosParaSubir.length && creado?.id) {
        this.api.subirFotosInteresado(creado.id, archivosParaSubir).subscribe({
          next: (act) => {
            this.lista.update((l) => l.map((x) => (x.id === act.id ? act : x)));
          },
        });
      }
    });
  }

  abrirEdicionUsado(i: Interesado): void {
    const u = i.usado;
    const g = u?.guia;
    this.usadoEdit = {
      tipo_vehiculo: u?.tipo_vehiculo ?? 'Auto',
      carroceria: u?.carroceria ?? '',
      dominio: u?.dominio ?? '',
      marca: u?.marca ?? '',
      modelo: u?.modelo ?? '',
      version: u?.version ?? '',
      anio: u?.anio ? String(u.anio) : '',
      km: u?.km !== null && u?.km !== undefined ? String(u.km) : '',
      combustible: u?.combustible ?? '',
      transmision: u?.transmision ?? '',
      seguro_compania: u?.seguro_compania ?? '',
      seguro_cobertura: u?.seguro_cobertura ?? '',
      seguro_cuota: u?.seguro_cuota ? String(u.seguro_cuota) : '',
      costo_patente: u?.costo_patente ? String(u.costo_patente) : '',
      radicacion: u?.radicacion ?? '',
      descripcion: u?.descripcion ?? '',
      guia: {
        uso: g?.uso ?? '',
        guardado: g?.guardado ?? '',
        motivo_venta: g?.motivo_venta ?? '',
        ultimo_service: g?.ultimo_service ?? '',
        ultima_vtv: g?.ultima_vtv ?? '',
        mantenimiento: g?.mantenimiento ?? '',
        neumaticos: g?.neumaticos ?? '',
        transferencia: g?.transferencia ?? '',
        agregados: g?.agregados ?? '',
        paneles_choques: g?.paneles_choques ?? '',
        reparaciones: g?.reparaciones ?? '',
      },
    };
    this.editandoUsado.set(true);
  }

  guardarUsadoEditado(): void {
    const i = this.elegido();
    if (!i) return;
    const usadoObj = this.armarObjetoUsado(this.usadoEdit);
    if (!usadoObj) {
      this.notification.error('Completá Marca, Modelo y Año válido (1900 a 2100) del vehículo.');
      return;
    }
    const kmTxt = usadoObj.km !== null ? `${usadoObj.km.toLocaleString('es-AR')} km` : null;
    const resumen = [usadoObj.marca, usadoObj.modelo, usadoObj.version, usadoObj.anio, kmTxt, usadoObj.dominio ? `[${usadoObj.dominio}]` : null]
      .filter(Boolean)
      .join(' ');
    this.hacer(
      this.api.editarInteresado(i.id, { tiene_usado: resumen, usado: usadoObj }),
      'Ficha técnica del vehículo guardada',
      () => this.editandoUsado.set(false),
    );
  }

  subirFotosEnFicha(evento: Event): void {
    const i = this.elegido();
    const input = evento.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []).filter((a) => a.type.startsWith('image/'));
    input.value = '';
    if (!i || !archivos.length) return;
    this.hacer(
      this.api.subirFotosInteresado(i.id, archivos),
      archivos.length === 1 ? 'Foto agregada a la ficha' : `${archivos.length} fotos agregadas a la ficha`,
    );
  }

  borrarFotoEnFicha(indice: number): void {
    const i = this.elegido();
    if (!i) return;
    this.hacer(this.api.borrarFotoInteresado(i.id, indice), 'Foto eliminada');
  }

  async mostrarQrCotizacion(i?: Interesado): Promise<void> {
    const base = this.sitioUrl().replace(/\/+$/, '');
    const url = `${base}/vender`;
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });
    this.qrModal.set({
      titulo: i ? `QR de Tasación y Fotos para ${i.nombre}` : 'QR de Tasación («Cotizá tu auto»)',
      subtitulo: 'El cliente lo escanea con su celular para cargar los datos de su usado, responder la guía técnica y subir las fotos directo a este tablero.',
      url,
      qrDataUrl,
    });
  }

  copiarUrlQr(url: string): void {
    void navigator.clipboard?.writeText(url);
    this.notification.success('Enlace copiado al portapapeles');
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
    }), 'Cotización guardada', () => { this.cotiza = { valor: '', moneda: this.cotiza.moneda, nota: '' }; this.peritajeAbierto.set(false); });
  }

  get calculoPeritaje(): {
    referencia: number;
    descuentos: number;
    margen: number;
    pct: number;
    toma: number;
    rubros: { concepto: string; descuento: number }[];
  } {
    const ref = monto(this.peritaje.referencia) ?? 0;
    const rubros = [
      { concepto: 'Chapa y pintura', descuento: monto(this.peritaje.chapa) ?? 0 },
      { concepto: 'Neumáticos y tren delantero', descuento: monto(this.peritaje.neumaticos) ?? 0 },
      { concepto: 'Mecánica, service y distribución', descuento: monto(this.peritaje.mecanica) ?? 0 },
      { concepto: 'Interior, cristales y equipamiento', descuento: monto(this.peritaje.interior) ?? 0 },
      { concepto: 'Documentación, VTV y multas', descuento: monto(this.peritaje.papeles) ?? 0 },
    ];
    const descuentos = rubros.reduce((acc, r) => acc + r.descuento, 0);
    const pctRaw = Number(String(this.peritaje.margen_pct).replace(',', '.'));
    const pct = Number.isFinite(pctRaw) && pctRaw >= 0 && pctRaw <= 40 ? pctRaw : 0;
    const margen = Math.round(ref * (pct / 100));
    const toma = Math.max(0, Math.round(ref - descuentos - margen));
    return { referencia: ref, descuentos, margen, pct, toma, rubros };
  }

  aplicarPeritaje(): void {
    const c = this.calculoPeritaje;
    if (c.referencia <= 0 || c.toma <= 0) {
      this.notification.error('Cargá el valor de mercado de referencia del auto.');
      return;
    }
    const m = this.cotiza.moneda;
    const partes = [
      `Ref. mercado ${plata(c.referencia, m)}`,
      ...c.rubros.filter((r) => r.descuento > 0).map((r) => `- ${r.concepto}: ${plata(r.descuento, m)}`),
      c.margen > 0 ? `- Margen y garantía (${c.pct}%): ${plata(c.margen, m)}` : null,
    ].filter(Boolean);
    this.cotiza.valor = String(c.toma);
    this.cotiza.nota = partes.join(' ').slice(0, 300);
  }

  imprimirPeritaje(i: Interesado): void {
    const c = this.calculoPeritaje;
    if (c.referencia <= 0) {
      this.notification.error('Cargá el valor de mercado de referencia para imprimir la hoja de peritaje.');
      return;
    }
    const u = i.usado;
    const doc: PeritajeTomaDoc = {
      cliente_nombre: i.nombre,
      cliente_telefono: i.telefono,
      vehiculo: u ? [u.marca, u.modelo, u.version, u.anio].filter(Boolean).join(' ') : i.tiene_usado ?? 'Vehículo usado',
      dominio: u?.dominio ?? null,
      anio: u?.anio ?? null,
      km: u?.km ?? null,
      moneda: this.cotiza.moneda,
      valor_referencia: c.referencia,
      rubros: c.rubros,
      margen_agencia: c.margen,
      margen_pct: c.pct,
      valor_toma: c.toma,
      observaciones: this.cotiza.nota.trim() || null,
    };
    void this.documentos.hojaDePeritajeAuto(doc);
  }

  consultarMultasUsado(dominio: string, url: string, rotulo: string): void {
    void navigator.clipboard?.writeText(dominio);
    this.notification.info(`Patente ${dominio} copiada al portapapeles para pegar en ${rotulo}`);
    window.open(url, '_blank', 'noopener,noreferrer');
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
  private hacer(pedido: Observable<Interesado>, mensaje: string, alTerminar?: (i: Interesado) => void): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    pedido.subscribe({
      next: (i) => {
        this.ocupado.set(false);
        const enVista = this.vista() === 'activos' ? !['ganado', 'perdido'].includes(i.etapa) : this.vista() === 'ganados' ? i.etapa === 'ganado' : i.etapa === 'perdido';
        const resto = this.lista().filter((x) => x.id !== i.id);
        this.lista.set(enVista ? [i, ...resto] : resto);
        this.elegidoId.set(enVista ? i.id : null);
        alTerminar?.(i);
        if (mensaje) this.notification.success(mensaje);
      },
      error: () => this.ocupado.set(false),
    });
  }

  private usadoVacio() {
    return {
      tipo_vehiculo: 'Auto',
      carroceria: '',
      dominio: '',
      marca: '',
      modelo: '',
      version: '',
      anio: '',
      km: '',
      combustible: '',
      transmision: '',
      seguro_compania: '',
      seguro_cobertura: '',
      seguro_cuota: '',
      costo_patente: '',
      radicacion: '',
      descripcion: '',
      guia: {
        uso: '',
        guardado: '',
        motivo_venta: '',
        ultimo_service: '',
        ultima_vtv: '',
        mantenimiento: '',
        neumaticos: '',
        transferencia: '',
        agregados: '',
        paneles_choques: '',
        reparaciones: '',
      },
    };
  }

  private vacio() {
    return {
      nombre: '', telefono: '', origen: 'salon', temperatura: 'tibio', unidad_id: '', busca: '', busca_marca: '', busca_carroceria: '',
      precio_max: '', precio_moneda: 'USD' as 'USD' | 'ARS', tiene_usado: '', carga_usado: false, usado: this.usadoVacio(), proxima_accion: '', nota: '',
    };
  }
}
