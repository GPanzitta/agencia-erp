import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AutosService, Financiacion, ReservaDelSitio, ResumenStock, Unidad, VistaStock } from './autos.service';
import { environment } from '../../../../environments/environment';
import { ROTULO_ESTADO, ROTULO_ORIGEN, TEXTO_SEMAFORO, claseDias, dominioLegible, monto, plata, renglon, textoDias, urlDelSitio } from './autos.util';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../auth/services/auth.service';
import { Rol } from '../../../core/interfaces/auth.interface';
import { urlFoto } from '../../../core/utils/foto-url.util';

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
  private auth = inject(AuthService);

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

  /** La plata del negocio (costo, margen, valor del stock) la ve sólo el dueño. */
  readonly esDuenio = computed(() => [Rol.ADMIN, Rol.SUPERADMIN].includes(this.auth.rol() as Rol));
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
}
