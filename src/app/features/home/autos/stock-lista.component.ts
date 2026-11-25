import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AutosService, Financiacion, ReservaDelSitio, ResumenStock, Unidad, VistaStock } from './autos.service';
import { environment } from '../../../../environments/environment';
import { ROTULO_ESTADO, ROTULO_ORIGEN, TEXTO_SEMAFORO, claseDias, dominioLegible, fecha, monto, plata, renglon, textoDias, urlDelSitio } from './autos.util';
import { NotificationService } from '../../../core/services/notification.service';
import { DocumentosService } from '../../../core/services/documentos.service';
import { UnidadDoc } from '../../../core/services/documentos/boleto-auto.doc';
import { ExcelService } from '../../../core/services/excel.service';
import { AuthService } from '../../auth/services/auth.service';
import { Rol } from '../../../core/interfaces/auth.interface';
import { urlFoto } from '../../../core/utils/foto-url.util';
import * as QRCode from 'qrcode';

/**
 * El stock de la agencia (diseño del 12/11/2026): cada auto con su estado, sus
 * días parado, el semáforo de papeles y, para el dueño, lo que lleva puesto y
 * lo que deja. Tabla en escritorio, tarjeta con foto en el celular.
 */
@Component({
  selector: 'app-stock-lista',
  standalone: false,
  templateUrl: './stock-lista.component.html',
  styleUrls: ['./stock-lista.component.scss'],
})
export class StockListaComponent implements OnInit {
  private api = inject(AutosService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private notification = inject(NotificationService);
  private excel = inject(ExcelService);
  private auth = inject(AuthService);
  private documentos = inject(DocumentosService);

  qrModal = signal<{ titulo: string; subtitulo: string; url: string; qrDataUrl: string; unidad: Unidad } | null>(null);

  readonly rotuloEstado = ROTULO_ESTADO;
  readonly rotuloOrigen = ROTULO_ORIGEN;
  readonly textoSemaforo = TEXTO_SEMAFORO;
  readonly plata = plata;
  readonly renglon = renglon;
  readonly dominio = dominioLegible;
  readonly claseDias = claseDias;
  readonly textoDias = textoDias;
  readonly foto = urlFoto;

  readonly vistas: { valor: VistaStock; rotulo: string }[] = [
    { valor: 'stock', rotulo: 'En stock' },
    { valor: 'disponibles', rotulo: 'Disponibles' },
    { valor: 'reservadas', rotulo: 'Reservadas' },
    { valor: 'vendidas', rotulo: 'Vendidas' },
    { valor: 'cerradas', rotulo: 'Devueltas y bajas' },
  ];

  /** La plata del negocio (costo, margen, valor del stock) la ve sólo el dueño, salvo en Modo Cliente. */
  readonly esDuenio = computed(() => [Rol.ADMIN, Rol.SUPERADMIN].includes(this.auth.rol() as Rol) && !this.auth.modoCliente());
  /** Dar de alta es del dueño y del vendedor (hoy el puesto «mostrador»). */
  readonly puedeCargar = computed(() => this.esDuenio() || this.auth.rol() === Rol.MOSTRADOR);

  vista = signal<VistaStock>('stock');
  busqueda = signal('');
  lista = signal<Unidad[]>([]);
  resumen = signal<ResumenStock | null>(null);
  /** La dirección del sitio público de esta agencia. */
  sitio = signal<string | null>(null);
  /** Si el sitio muestra a quien mira un auto cómo están sus papeles. */
  muestraPapeles = signal(true);
  /** Las condiciones con las que el sitio simula cuotas, como las escribe el dueño. */
  /** Con qué seña y a qué cuenta el sitio toma reservas, como lo escribe el dueño. */
  res = { activa: false, monto: '', moneda: 'ARS' as 'ARS' | 'USD', horas: '48', dias: '7', alias: '', titular: '' };
  resAbierta = signal(false);
  fin = { activa: false, anticipo: '30', plazos: '12, 24, 36', tna_ars: '', tna_usd: '' };
  finAbierta = signal(false);
  cargando = signal(false);

  // ─── Importador rápido de Stock (Excel / CSV o Link web) ──────────────────
  importadorAbierto = signal(false);
  gremioAbierto = signal(false);
  descuentoGremioPct = 5;
  urlImportar = '';
  leyendoSitio = signal(false);
  importando = signal(false);
  progresoImportacion = signal('');
  filasParaImportar = signal<{
    incluir: boolean;
    dominio: string;
    marca: string;
    modelo: string;
    version: string;
    anio: number;
    km: number;
    moneda: 'ARS' | 'USD';
    precio_venta: number | null;
    costo_adquisicion: number;
    publicar: boolean;
  }[]>([]);

  ngOnInit(): void {
    // El buscador de arriba y los accesos de Inicio llegan con ?q= y ?vista= en la dirección.
    this.route.queryParamMap.subscribe((p) => {
      const vista = p.get('vista') as VistaStock | null;
      if (vista && this.vistas.some((v) => v.valor === vista)) this.vista.set(vista);
      this.busqueda.set(p.get('q') ?? '');
      this.cargar();
    });
    this.api.sitio().subscribe({ next: (r) => { this.sitio.set(urlDelSitio(environment.portalUrl, r.slug)); this.muestraPapeles.set(r.muestra_papeles); this.leerFinanciacion(r.financiacion); this.leerReserva(r.reserva); }, error: () => undefined });
  }

  ver(v: VistaStock): void {
    this.vista.set(v);
    this.cargar();
  }

  buscar(q: string): void {
    this.busqueda.set(q);
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.api.listar(this.vista(), this.busqueda().trim() || undefined).subscribe({
      next: (l) => { this.lista.set(l); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
    if (this.esDuenio()) this.api.resumen().subscribe({ next: (r) => this.resumen.set(r), error: () => undefined });
  }

  abrir(u: Unidad): void {
    this.router.navigate(['/home/autos/unidad', u.id]);
  }

  async publicarDirecto(u: Unidad, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    try {
      if (u.estado !== 'disponible') {
        await firstValueFrom(this.api.cambiarEstado(u.id, 'disponible'));
      }
      await firstValueFrom(this.api.publicar(u.id, true));
      this.notification.success(`${u.titulo} publicado en localhost:3201`);
      this.cargar();
    } catch {
      // El interceptor informa si faltó algo
    }
  }

  private unidadDocDe(u: Unidad): UnidadDoc {
    return {
      id: u.id,
      numero: u.numero,
      titulo: u.titulo,
      marca: u.marca,
      modelo: u.modelo,
      version: u.version,
      anio: u.anio,
      km: u.km,
      dominio: u.dominio,
      color: u.color,
      combustible: u.combustible,
      transmision: u.transmision,
      carroceria: u.carroceria,
      nro_motor: u.nro_motor,
      nro_chasis: u.nro_chasis,
      condicion: u.condicion,
      origen: u.origen,
      moneda: u.moneda,
      precio_piso: u.precio_piso,
      precio_venta: u.precio_venta,
      total_gastos: u.total_gastos,
      gastos: u.gastos ?? [],
      papeles: u.papeles ?? [],
      titular_nombre: u.titular_nombre,
      titular_telefono: u.titular_telefono,
      titular_documento: u.titular_documento,
      descripcion: u.descripcion,
    };
  }

  async verQrEnStock(u: Unidad, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    const base = (this.sitio() || environment.portalUrl).replace(/\/+$/, '');
    const url = `${base}/autos/${u.id}`;
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });
    this.qrModal.set({
      titulo: `QR de ${u.titulo} (${u.numero})`,
      subtitulo: 'Imprimí el cartel con QR para el parabrisas, las etiquetas QR para el llavero o compartí el enlace directo de la unidad.',
      url,
      qrDataUrl,
      unidad: u,
    });
  }

  imprimirCartelDesdeStock(u: Unidad, ev?: Event): void {
    ev?.stopPropagation();
    const base = (this.sitio() || environment.portalUrl).replace(/\/+$/, '');
    void this.documentos.cartelDeVidrieraAuto(this.unidadDocDe(u), `${base}/autos/${u.id}`);
  }

  imprimirLlaveDesdeStock(u: Unidad, ev?: Event): void {
    ev?.stopPropagation();
    void this.documentos.etiquetaDeLlaveAuto(this.unidadDocDe(u), `${location.origin}/home/autos/unidad/${u.id}`);
  }

  copiarUrlQr(url: string): void {
    void navigator.clipboard?.writeText(url);
    this.notification.success('Enlace copiado al portapapeles');
  }

  trackPorId(_: number, x: { id: string }): string {
    return x.id;
  }

  /** El dueño prende o apaga el bloque de papeles de su sitio; si falla, vuelve a como estaba. */
  cambiarPapelesDelSitio(mostrar: boolean): void {
    const antes = this.muestraPapeles();
    this.muestraPapeles.set(mostrar);
    this.api.configurarSitio({ muestra_papeles: mostrar }).subscribe({
      next: (r) => this.muestraPapeles.set(r.muestra_papeles),
      error: () => this.muestraPapeles.set(antes),
    });
  }

  private leerFinanciacion(f: Financiacion | null): void {
    if (!f) { this.fin = { ...this.fin, activa: false }; return; }
    this.fin = {
      activa: true, anticipo: String(f.anticipo_minimo_pct), plazos: f.plazos.join(', '),
      tna_ars: f.tna_ars === null ? '' : String(f.tna_ars), tna_usd: f.tna_usd === null ? '' : String(f.tna_usd),
    };
  }

  private leerReserva(r: ReservaDelSitio | null): void {
    if (!r) { this.res = { ...this.res, activa: false }; return; }
    this.res = { activa: true, monto: String(r.monto), moneda: r.moneda, horas: String(r.horas), dias: String(r.dias), alias: r.alias, titular: r.titular };
  }

  /** Guarda con qué seña, plazo y cuenta el sitio deja reservar un auto. */
  guardarReserva(): void {
    const r = this.res;
    if (!r.activa) {
      this.api.configurarSitio({ reserva: false }).subscribe({ next: () => { this.notification.success('El sitio ya no toma reservas'); this.resAbierta.set(false); } });
      return;
    }
    const [m, horas, dias] = [monto(r.monto), Number(r.horas), Number(r.dias)];
    if (m === null) { this.notification.error('Decí de cuánto es la seña.'); return; }
    if (!Number.isInteger(horas) || horas < 1 || horas > 168) { this.notification.error('Las horas para transferir van de 1 a 168.'); return; }
    if (!Number.isInteger(dias) || dias < 1 || dias > 60) { this.notification.error('Los días que se guarda el auto van de 1 a 60.'); return; }
    if (!r.alias.trim() || !r.titular.trim()) { this.notification.error('Cargá el alias o CBU y a nombre de quién está la cuenta: el cliente los ve antes de transferir.'); return; }
    this.api.configurarSitio({ reserva: true, reserva_monto: m, reserva_moneda: r.moneda, reserva_horas: horas, reserva_dias: dias, reserva_alias: r.alias.trim(), reserva_titular: r.titular.trim() }).subscribe({
      next: (s) => { this.leerReserva(s.reserva); this.resAbierta.set(false); this.notification.success('El sitio ya toma reservas con esa seña'); },
    });
  }

  /** Guarda con qué anticipo, plazos y tasas el sitio le simula la cuota a quien mira un auto. */
  guardarFinanciacion(): void {
    const f = this.fin;
    if (!f.activa) {
      this.api.configurarSitio({ financia: false }).subscribe({ next: () => { this.notification.success('El sitio ya no muestra cuotas'); this.finAbierta.set(false); } });
      return;
    }
    const tasa = (t: string) => (t.trim() ? Number(t.trim().replace(',', '.')) : null);
    const plazos = f.plazos.split(',').map((p) => Number(p.trim())).filter((p) => Number.isInteger(p) && p > 0);
    const [ars, usd, anticipo] = [tasa(f.tna_ars), tasa(f.tna_usd), Number(f.anticipo)];
    if (!plazos.length) { this.notification.error('Cargá los plazos en meses, separados por coma: 12, 24, 36.'); return; }
    if (ars === null && usd === null) { this.notification.error('Cargá la tasa anual para los autos en pesos, en dólares o las dos.'); return; }
    if ([ars, usd].some((t) => t !== null && (Number.isNaN(t) || t < 0)) || !Number.isInteger(anticipo) || anticipo < 0 || anticipo > 90) {
      this.notification.error('Revisá el anticipo (0 a 90) y las tasas: hay un número que no es válido.'); return;
    }
    this.api.configurarSitio({ financia: true, anticipo_minimo_pct: anticipo, plazos, tna_ars: ars, tna_usd: usd }).subscribe({
      next: (r) => { this.leerFinanciacion(r.financiacion); this.finAbierta.set(false); this.notification.success('El sitio ya simula cuotas con esas condiciones'); },
    });
  }

  exportarExcel(): void {
    const unidades = this.lista();
    if (!unidades.length) return;
    const duenio = this.esDuenio();
    const columnas = [
      { clave: 'numero', titulo: 'Código', ancho: 12 },
      { clave: 'dominio', titulo: 'Dominio', ancho: 14 },
      { clave: 'marca', titulo: 'Marca', ancho: 16 },
      { clave: 'modelo', titulo: 'Modelo', ancho: 18 },
      { clave: 'version', titulo: 'Versión', ancho: 20 },
      { clave: 'anio', titulo: 'Año', ancho: 10 },
      { clave: 'km', titulo: 'Kilómetros', ancho: 14 },
      { clave: 'origen', titulo: 'Origen', ancho: 20 },
      { clave: 'estado', titulo: 'Estado', ancho: 16 },
      { clave: 'dias', titulo: 'Días en stock', ancho: 14 },
      { clave: 'papeles', titulo: 'Papeles', ancho: 16 },
      { clave: 'moneda', titulo: 'Moneda', ancho: 10 },
      { clave: 'precio_venta', titulo: 'Precio de venta', ancho: 16 },
      ...(duenio
        ? [
            { clave: 'costo_total', titulo: 'Costo total', ancho: 16 },
            { clave: 'precio_piso', titulo: 'Piso consignación', ancho: 16 },
            { clave: 'margen', titulo: 'Margen', ancho: 16 },
          ]
        : []),
      { clave: 'fecha_ingreso', titulo: 'Fecha ingreso', ancho: 14 },
    ];
    const filas = unidades.map((u) => ({
      numero: u.numero,
      dominio: u.dominio ?? '—',
      marca: u.marca,
      modelo: u.modelo,
      version: u.version ?? '',
      anio: u.anio,
      km: u.km,
      origen: this.rotuloOrigen[u.origen] ?? u.origen,
      estado: this.rotuloEstado[u.estado] ?? u.estado,
      dias: u.dias_en_stock,
      papeles: u.semaforo === 'verde' ? 'Al día' : u.semaforo === 'rojo' ? 'Faltan bloqueantes' : 'En trámite',
      moneda: u.moneda,
      precio_venta: u.precio_venta ?? '',
      ...(duenio
        ? {
            costo_total: u.costo_total ?? '',
            precio_piso: u.precio_piso ?? '',
            margen: u.margen ?? '',
          }
        : {}),
      fecha_ingreso: fecha(u.fecha_ingreso),
    }));
    const hoy = new Date().toISOString().slice(0, 10);
    void this.excel.descargar(`stock-${this.vista()}-${hoy}.xlsx`, 'Stock', columnas, filas);
  }

  textoListaGremio(): string {
    const disponibles = this.lista().filter((u) => (u.estado === 'disponible' || u.estado === 'alistaje') && u.precio_venta !== null);
    if (!disponibles.length) return 'No hay unidades con precio de venta en esta vista para armar la lista.';
    const pct = Math.max(0, Math.min(30, Number(this.descuentoGremioPct) || 0));
    const factor = 1 - pct / 100;
    const renglones = disponibles.map((u) => {
      const base = u.precio_venta ?? 0;
      const paso = base >= 1_000_000 ? 50_000 : 100;
      const precioGremio = pct > 0 ? Math.round((base * factor) / paso) * paso : base;
      const kmTexto = u.condicion === '0km' ? '0 km' : `${u.km.toLocaleString('es-AR')} km`;
      return `• *${u.titulo} ${u.anio}* (${kmTexto}) — *${plata(precioGremio, u.moneda)}*`;
    });
    const pie = this.sitio() ? `\nCatálogo con fotos: ${this.sitio()}` : '';
    return `*LISTA DE STOCK DISPONIBLE / GREMIO (${disponibles.length} unidades)*\n${renglones.join('\n')}${pie}`;
  }

  copiarListaGremio(): void {
    const texto = this.textoListaGremio();
    void navigator.clipboard?.writeText(texto);
    this.notification.success('Lista para colegas copiada al portapapeles (lista para pegar en WhatsApp)');
  }

  descargarPlantillaImportacion(): void {
    const columnas = [
      { clave: 'dominio', titulo: 'Dominio', ancho: 14 },
      { clave: 'marca', titulo: 'Marca', ancho: 16 },
      { clave: 'modelo', titulo: 'Modelo', ancho: 18 },
      { clave: 'version', titulo: 'Version', ancho: 22 },
      { clave: 'anio', titulo: 'Anio', ancho: 10 },
      { clave: 'km', titulo: 'Kilometros', ancho: 14 },
      { clave: 'moneda', titulo: 'Moneda', ancho: 10 },
      { clave: 'precio_venta', titulo: 'Precio_venta', ancho: 16 },
      { clave: 'costo', titulo: 'Costo', ancho: 16 },
    ];
    const ejemplo = [
      { dominio: 'AE852RA', marca: 'Volkswagen', modelo: 'Nivus', version: '200 TSI Highline AT', anio: 2021, km: 50000, moneda: 'USD', precio_venta: 21500, costo: 19200 },
      { dominio: 'AF310KL', marca: 'Toyota', modelo: 'Corolla', version: '2.0 SEG CVT', anio: 2022, km: 38000, moneda: 'USD', precio_venta: 23900, costo: 21500 },
    ];
    void this.excel.descargar('plantilla-importar-stock.xlsx', 'Stock', columnas, ejemplo);
  }

  async cargarArchivoImportacion(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    try {
      const crudas = await this.excel.leerArchivo(archivo);
      const buscar = (f: Record<string, string>, claves: string[]) => {
        const entrada = Object.entries(f).find(([k]) => claves.includes(k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()));
        return entrada ? entrada[1] : '';
      };
      const convertidas = crudas.map((f, idx) => {
        const marca = buscar(f, ['marca', 'brand']).trim();
        const modelo = buscar(f, ['modelo', 'model']).trim();
        const version = buscar(f, ['version', 'versión', 'detalle']).trim();
        const domCrudo = buscar(f, ['dominio', 'patente', 'plate']).toUpperCase().replace(/[^A-Z0-9]/g, '');
        const dominio = /^([A-Z]{3}[0-9]{3}|[A-Z]{2}[0-9]{3}[A-Z]{2})$/.test(domCrudo)
          ? domCrudo
          : `IM${String(idx + 1).padStart(3, '0')}AA`;
        const anio = Number(buscar(f, ['anio', 'año', 'year']).replace(/\D/g, '')) || new Date().getFullYear() - 3;
        const km = Number(buscar(f, ['km', 'kilometros', 'kilometraje']).replace(/\D/g, '')) || 0;
        const monTexto = buscar(f, ['moneda', 'currency']).toUpperCase();
        const moneda: 'ARS' | 'USD' = monTexto.includes('ARS') || monTexto.includes('$') && !monTexto.includes('US') ? 'ARS' : 'USD';
        const precio = monto(buscar(f, ['precio_venta', 'precio', 'precio de venta', 'valor']));
        const costo = monto(buscar(f, ['costo', 'costo_total', 'costo adquisicion'])) ?? 0;
        return {
          incluir: !!(marca && modelo),
          dominio,
          marca,
          modelo,
          version,
          anio: anio >= 1900 && anio <= 2100 ? anio : 2020,
          km,
          moneda,
          precio_venta: precio,
          costo_adquisicion: costo,
          publicar: precio !== null,
        };
      }).filter((x) => x.marca && x.modelo);

      if (!convertidas.length) {
        this.notification.error('No encontramos filas con Marca y Modelo en el archivo.');
        return;
      }
      this.filasParaImportar.set(convertidas);
      this.notification.success(`Se leyeron ${convertidas.length} vehículos listos para revisar e importar.`);
    } catch {
      this.notification.error('No pudimos leer ese archivo. Probá con un .xlsx o .csv.');
    }
  }

  leerDesdeUrl(): void {
    const url = this.urlImportar.trim();
    if (!/^https?:\/\/.+\..+/i.test(url)) {
      this.notification.error('Pegá la dirección completa de la página, con https:// adelante.');
      return;
    }
    this.leyendoSitio.set(true);
    this.api.leerSitioParaImportar(url).subscribe({
      next: (lista) => {
        this.leyendoSitio.set(false);
        if (!lista.length) {
          this.notification.info('Abrimos la página pero no detectamos autos con precio.');
          return;
        }
        this.filasParaImportar.set(
          lista.map((u) => ({
            incluir: true,
            dominio: u.dominio,
            marca: u.marca,
            modelo: u.modelo,
            version: u.version ?? '',
            anio: u.anio,
            km: u.km,
            moneda: u.moneda,
            precio_venta: u.precio_venta,
            costo_adquisicion: 0,
            publicar: true,
          })),
        );
        this.notification.success(`Detectamos ${lista.length} autos de esa página. Revisalos y confirmá la importación.`);
      },
      error: () => {
        this.leyendoSitio.set(false);
        this.notification.error('No pudimos leer esa página web.');
      },
    });
  }

  async confirmarImportacion(): Promise<void> {
    const elegidas = this.filasParaImportar().filter((f) => f.incluir && f.marca.trim() && f.modelo.trim());
    if (!elegidas.length) {
      this.notification.error('Seleccioná al menos un auto para importar.');
      return;
    }
    this.importando.set(true);
    let creadas = 0;
    let fallidas = 0;
    for (let i = 0; i < elegidas.length; i++) {
      const f = elegidas[i];
      this.progresoImportacion.set(`Importando ${i + 1} de ${elegidas.length}: ${f.marca} ${f.modelo}…`);
      try {
        const u = await firstValueFrom(
          this.api.crear({
            origen: 'compra',
            condicion: 'usado',
            dominio: f.dominio.trim(),
            marca: f.marca.trim(),
            modelo: f.modelo.trim(),
            version: f.version.trim() || undefined,
            anio: Number(f.anio),
            km: Number(f.km) || 0,
            moneda: f.moneda,
            precio_venta: f.precio_venta ?? undefined,
            costo_adquisicion: Number(f.costo_adquisicion) || 0,
          }),
        );
        if (f.publicar && f.precio_venta) {
          await firstValueFrom(this.api.cambiarEstado(u.id, 'disponible'));
          await firstValueFrom(this.api.publicar(u.id, true));
        }
        creadas++;
      } catch {
        fallidas++;
      }
    }
    this.importando.set(false);
    this.progresoImportacion.set('');
    this.filasParaImportar.set([]);
    this.importadorAbierto.set(false);
    this.cargar();
    if (creadas > 0) {
      this.notification.success(
        `¡Importación lista! Se cargaron ${creadas} ${creadas === 1 ? 'auto' : 'autos'}${fallidas ? ` (${fallidas} no se pudieron cargar por patente repetida o cupo)` : ''}.`,
      );
    } else {
      this.notification.error('No se pudo importar ninguna unidad. Verificá que las patentes no estén repetidas.');
    }
  }
}
