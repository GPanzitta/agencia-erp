import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Wallet, WalletsService } from '../configuracion/services/wallets.service';
import { IconName } from '../../../shared/components/icon/icon.component';
import { trackPorId } from '../../../shared/utils/track.util';
import { AuthService } from '../../auth/services/auth.service';
import { Rol } from '../../../core/interfaces/auth.interface';
import { NotificationService } from '../../../core/services/notification.service';
import { MovimientoDeTurno, TurnoCaja, TurnoCajaService } from './turno-caja.service';
import {
  FilaConteo, aNumero, conteoCompleto, diferenciaDeFila, hayDiferencia, montosDeApertura,
  montosDeCierre, totalDeclarado, totalDiferencia, totalEsperado,
} from './turno-caja.util';

type ModalTurno = 'abrir' | 'cerrar' | 'movimiento' | null;

/**
 * Las cajas del taller y su turno.
 *
 * Arriba, el estado del turno (abierto o no) con lo que hay en cada billetera;
 * abrir y mover plata lo hacen el mostrador y el administrador, cerrar solo el
 * administrador —igual que el backend—. Los puestos que no operan caja
 * (técnico, pañol) siguen viendo solo los saldos: ni siquiera piden el turno,
 * porque `GET /cash-register/active` les devolvería 403.
 *
 * Existe como pantalla propia y no como un permiso más sobre `/home/gastos`
 * porque el dashboard de gastos son 819 líneas de HTML escritas para el dueño:
 * abrirlo por rol significaba confiar en que ningún `*ngIf` se olvide.
 * Tampoco cuelga de `GastosModule`: vive en `HomeModule` para que el chunk
 * lazy de gastos no entre en el bundle de los puestos que no lo abren nunca.
 */
@Component({
  selector: 'app-cajas',
  standalone: false,
  templateUrl: './cajas.component.html',
  styleUrls: ['./cajas.component.scss'],
})
export class CajasComponent implements OnInit {
  private walletsService = inject(WalletsService);
  private turnoService = inject(TurnoCajaService);
  private auth = inject(AuthService);
  private notification = inject(NotificationService);

  readonly trackPorId = trackPorId;
  readonly trackPorBilletera = (i: number, f: { wallet_id: string }) => f.wallet_id || i;

  cajas = signal<Wallet[]>([]);
  cargando = signal(true);
  /** El GET no llegó: se dice, en vez de dibujar una lista vacía que miente. */
  fallo = signal(false);

  hayCajas = computed(() => this.cajas().length > 0);

  // ---- Turno ----
  turno = signal<TurnoCaja | null>(null);
  historial = signal<TurnoCaja[]>([]);
  cargandoTurno = signal(false);
  falloTurno = signal(false);
  /** Diferencias de lo contado al abrir: se muestran, no se corrigen solas. */
  diferenciasApertura = signal<NonNullable<TurnoCaja['diferencias_apertura']>>([]);
  /** Cierres del historial con el detalle por billetera desplegado. */
  expandidos = signal<ReadonlySet<string>>(new Set());

  // ---- Modales ----
  modal = signal<ModalTurno>(null);
  enviando = signal(false);
  filas = signal<FilaConteo[]>([]);
  notas = signal('');
  tipoMovimiento = signal<'ingreso' | 'retiro'>('ingreso');
  movWalletId = signal('');
  movMonto = signal<number | null>(null);
  movMotivo = signal('');

  private rol = computed(() => this.auth.rol());
  esAdmin = computed(() => this.rol() === Rol.ADMIN || this.rol() === Rol.SUPERADMIN);
  /** Abrir y mover plata: mostrador y administrador, como el backend. */
  puedeOperar = computed(() => this.esAdmin() || this.rol() === Rol.MOSTRADOR);

  movimientosDelTurno = computed<MovimientoDeTurno[]>(() =>
    [...(this.turno()?.movimientos ?? [])].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
  );

  // Cuentas en vivo del conteo (abrir y cerrar comparten las filas).
  totalEsperadoConteo = computed(() => totalEsperado(this.filas()));
  totalDeclaradoConteo = computed(() => totalDeclarado(this.filas()));
  totalDiferenciaConteo = computed(() => totalDiferencia(this.filas()));
  conDiferencia = computed(() => hayDiferencia(this.filas()));
  conteoListo = computed(() => conteoCompleto(this.filas()));

  /** Cerrar con diferencia exige motivo (el backend responde `MOTIVO_REQUERIDO`). */
  puedeCerrar = computed(
    () => this.conteoListo() && (!this.conDiferencia() || this.notas().trim().length > 0) && !this.enviando(),
  );
  puedeAbrir = computed(() => this.conteoListo() && !this.enviando());
  puedeMover = computed(() => {
    const monto = this.movMonto();
    return (
      !!this.movWalletId() && monto !== null && Number(monto) > 0 &&
      this.movMotivo().trim().length > 0 && !this.enviando()
    );
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.fallo.set(false);
    // `/wallets/active` y no `/wallets`: la lista cruda trae también las
    // billeteras dadas de baja, que el dueño ya no ve en su propio tablero.
    // Mostrarle al mostrador una caja apagada, con el último saldo que tuvo,
    // es ofrecerle plata que no existe.
    this.walletsService.getActiveWallets().subscribe({
      next: (l) => {
        this.cajas.set(l ?? []);
        this.cargando.set(false);
      },
      error: () => {
        this.cajas.set([]);
        this.fallo.set(true);
        this.cargando.set(false);
      },
    });
    this.cargarTurno();
  }

  /** Turno e historial. Solo para quien puede verlos: al resto el backend le diría 403. */
  cargarTurno(): void {
    if (!this.puedeOperar()) return;
    this.cargandoTurno.set(true);
    this.falloTurno.set(false);
    this.turnoService.activo().subscribe({
      next: (t) => {
        this.turno.set(t ?? null);
        this.cargandoTurno.set(false);
      },
      error: () => {
        this.turno.set(null);
        this.falloTurno.set(true);
        this.cargandoTurno.set(false);
      },
    });
    this.turnoService.historial(10).subscribe({
      next: (h) => this.historial.set(h ?? []),
      error: () => this.historial.set([]),
    });
  }

  /**
   * El saldo cacheado de la billetera (`current_balance`), no el que sale de
   * sumar el libro. El asiento de apertura del ledger es perezoso, así que una
   * caja sin movimientos todavía suma cero: arrancar mostrando $0 en cajas que
   * tienen plata es peor error que el desvío teórico del caché.
   *
   * Viene como string porque en Postgres es `decimal`; se normaliza acá y no
   * en el template para que la comparación con cero no dependa de la coerción
   * de JavaScript.
   */
  saldo(w: Wallet): number {
    return Number(w.current_balance ?? 0) || 0;
  }

  enRojo(w: Wallet): boolean {
    return this.saldo(w) < 0;
  }

  tipoBilletera(t?: string): string {
    return { cash: 'Efectivo', bank: 'Banco', digital: 'Digital' }[t ?? ''] ?? t ?? '';
  }

  iconoBilletera(t?: string): IconName {
    return t === 'cash' ? 'caja' : 'dinero';
  }

  num(v: unknown): number {
    return aNumero(v);
  }

  diferenciaFila(f: FilaConteo): number | null {
    return diferenciaDeFila(f);
  }

  // ---- Abrir ----
  abrirModalApertura(): void {
    // Una fila por billetera activa, precargada con el saldo del sistema: el
    // operador corrige lo que contó.
    this.filas.set(
      this.cajas().map((w) => ({
        wallet_id: w.id as string,
        nombre: w.name,
        esperado: aNumero(w.current_balance),
        // Lo contado no puede ser negativo (el backend lo rechaza): si el
        // sistema da saldo negativo se precarga cero y se avisa en la fila.
        declarado: Math.max(0, aNumero(w.current_balance)),
        saldoNegativo: aNumero(w.current_balance) < 0,
      })),
    );
    this.modal.set('abrir');
  }

  confirmarApertura(): void {
    if (!this.puedeAbrir()) return;
    this.enviando.set(true);
    this.turnoService.abrir(montosDeApertura(this.filas())).subscribe({
      next: (t) => {
        this.enviando.set(false);
        this.modal.set(null);
        // Con lo que devolvió abrir(): las diferencias y el turno no dependen
        // de que la recarga de después llegue.
        this.diferenciasApertura.set(t?.diferencias_apertura ?? []);
        if (t) this.turno.set(t);
        this.notification.success(`Turno ${t?.turno_numero ?? ''} abierto`.trim(), 'Caja');
        this.cargar();
      },
      error: () => this.enviando.set(false),
    });
  }

  // ---- Mover plata ----
  abrirModalMovimiento(tipo: 'ingreso' | 'retiro'): void {
    this.tipoMovimiento.set(tipo);
    this.movWalletId.set(this.turno()?.walletBalances?.[0]?.walletId ?? '');
    this.movMonto.set(null);
    this.movMotivo.set('');
    this.modal.set('movimiento');
  }

  confirmarMovimiento(): void {
    const turno = this.turno();
    if (!turno || !this.puedeMover()) return;
    this.enviando.set(true);
    this.turnoService
      .movimiento(turno.id, {
        tipo: this.tipoMovimiento(),
        monto: aNumero(this.movMonto()),
        motivo: this.movMotivo().trim(),
        wallet_id: this.movWalletId(),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.modal.set(null);
          this.notification.success(
            this.tipoMovimiento() === 'ingreso' ? 'Ingreso registrado' : 'Retiro registrado',
            'Caja',
          );
          this.cargar();
        },
        error: () => this.enviando.set(false),
      });
  }

  // ---- Cerrar ----
  abrirModalCierre(): void {
    if (!this.turno() || !this.esAdmin()) return;
    // Lo esperado cambia con cada cobro: se vuelve a pedir el turno antes de
    // armar el conteo, así no se compara contra una foto vieja.
    this.turnoService.activo().subscribe({
      next: (t) => {
        this.turno.set(t ?? null);
        if (!t) return;
        this.armarCierre(t);
      },
    });
  }

  private armarCierre(t: TurnoCaja): void {
    this.filas.set(
      (t.walletBalances ?? []).map((b) => ({
        wallet_id: b.walletId,
        nombre: b.wallet?.name ?? 'Billetera',
        esperado: aNumero(b.expected_amount),
        declarado: null,
      })),
    );
    this.notas.set('');
    this.modal.set('cerrar');
  }

  confirmarCierre(): void {
    const t = this.turno();
    if (!t || !this.puedeCerrar()) return;
    this.enviando.set(true);
    const notas = this.notas().trim();
    this.turnoService.cerrar(t.id, montosDeCierre(this.filas()), notas || undefined).subscribe({
      next: () => {
        this.enviando.set(false);
        this.modal.set(null);
        this.diferenciasApertura.set([]);
        this.notification.success(`Turno ${t.turno_numero} cerrado`, 'Caja');
        this.cargar();
      },
      error: () => this.enviando.set(false),
    });
  }

  /** Cambia lo contado de una fila (el input manda string, vacío = sin contar). */
  contar(indice: number, valor: unknown): void {
    const texto = valor === null || valor === undefined ? '' : String(valor).trim();
    const n = texto === '' ? null : Number(texto);
    this.filas.update((fs) =>
      fs.map((f, i) => (i === indice ? { ...f, declarado: n !== null && Number.isFinite(n) ? n : null } : f)),
    );
  }

  cerrarModal(): void {
    if (this.enviando()) return;
    this.modal.set(null);
  }

  descartarDiferenciasApertura(): void {
    this.diferenciasApertura.set([]);
  }

  // ---- Historial ----
  alternarDetalle(id: string): void {
    this.expandidos.update((s) => {
      const nuevo = new Set(s);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  estaExpandido(id: string): boolean {
    return this.expandidos().has(id);
  }
}
