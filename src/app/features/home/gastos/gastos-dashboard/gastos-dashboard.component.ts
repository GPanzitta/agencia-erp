import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Anticipo, ExpenseService, ResumenGastos } from '../services/expense.service';
import {
  MovimientoBilletera, Wallet, WalletsService,
} from '../../configuracion/services/wallets.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ExcelService } from '../../../../core/services/excel.service';
import { AuthService } from '../../../auth/services/auth.service';
import { Rol } from '../../../../core/interfaces/auth.interface';
import { confirmarExportacion } from '../../../../core/utils/exportacion.util';
import { DeudaProveedor } from '../services/finance.service';
import {
  CATEGORIAS_GASTO_VISIBLES, ETIQUETAS_CATEGORIA_GASTO,
  EstadoAprobacionGasto, EstadoPagoGasto, Gasto, MetodoPagoGasto,
} from '../../../../core/interfaces/gastos.interface';

/** Etiquetas legibles de los orígenes del ledger. */
const ORIGENES: Record<string, string> = {
  apertura: 'Saldo inicial',
  venta: 'Venta',
  pago_gasto: 'Pago de gasto',
  anulacion_pago: 'Anulación',
  retiro_caja: 'Retiro de caja',
  ingreso_caja: 'Ingreso de caja',
  ajuste: 'Ajuste',
  transferencia: 'Transferencia',
};

@Component({
  selector: 'app-gastos-dashboard',
  templateUrl: './gastos-dashboard.component.html',
  styleUrls: ['./gastos-dashboard.component.scss']
})
export class GastosDashboardComponent implements OnInit {
  private expenseService = inject(ExpenseService);
  private walletsService = inject(WalletsService);
  private fb = inject(FormBuilder);
  private notification = inject(NotificationService);
  private excel = inject(ExcelService);
  private router = inject(Router);
  private auth = inject(AuthService);

  EstadoPagoGasto = EstadoPagoGasto;
  EstadoAprobacionGasto = EstadoAprobacionGasto;
  metodosPago = Object.values(MetodoPagoGasto);
  /** Sin 'packaging': solo queda para mostrar datos históricos. */
  categorias = CATEGORIAS_GASTO_VISIBLES;

  activeTab = signal<
    'gastos' | 'cuentas' | 'vencimientos' | 'presupuestos' | 'recurrentes' | 'oc' | 'config'
  >('gastos');

  // ─── Resumen y cajas ────────────────────────────────────────────────────

  resumen = signal<ResumenGastos | null>(null);
  wallets = signal<Wallet[]>([]);

  /** Billetera cuyo libro está abierto en el modal, con sus asientos. */
  billeteraAbierta = signal<Wallet | null>(null);
  movimientosBilletera = signal<MovimientoBilletera[]>([]);
  cargandoMovimientos = signal(false);

  // ─── Lista y filtros ────────────────────────────────────────────────────

  filtros = signal<{
    categoria: string;
    estado_pago: string;
    proveedor_id: string;
    desde: string;
    hasta: string;
    vencidos: boolean;
    solo_activos: boolean;
  }>({
    categoria: '',
    estado_pago: '',
    proveedor_id: '',
    desde: '',
    hasta: '',
    vencidos: false,
    solo_activos: true,
  });

  hayFiltrosActivos = computed(() => {
    const f = this.filtros();
    return !!(f.categoria || f.estado_pago || f.proveedor_id || f.desde || f.hasta || f.vencidos || !f.solo_activos);
  });

  /**
   * Se incrementa tras cada pago, anulación o alta. Las pestañas hermanas
   * (Cuentas por pagar, Vencimientos) lo reciben como @Input y recargan:
   * sin esto, pagar desde Vencimientos dejaba su lista desactualizada.
   */
  versionDatos = signal(0);

  gastos = signal<Gasto[]>([]);
  totalFiltrado = computed(() => this.gastos().reduce((s, g) => s + Number(g.monto), 0));
  totalAdeudado = computed(() =>
    this.gastos().reduce((s, g) => s + (Number(g.monto) - Number(g.monto_pagado || 0)), 0),
  );

  showModal = signal(false);
  showConfirmAnular = signal(false);
  gastoIdToAnular = signal<string | null>(null);

  // ─── Detalle de un gasto (pagos imputados) ──────────────────────────────

  gastoDetalle = signal<Gasto | null>(null);
  pagoAAnular = signal<{ id: string; monto: number } | null>(null);
  /**
   * PLA-03: una anulación (de gasto o de pago) en vuelo. Dos pedidos a la vez
   * revertían dos veces el mismo egreso y la caja quedaba con plata de más;
   * el botón se apaga hasta la respuesta. (La guarda de fondo es del backend.)
   */
  anulando = signal(false);
  motivoAnularPago = '';
  /** El pago a anular es de un turno cerrado: el operador elige el destino. */
  pedirDestinoPago = signal(false);

  // ─── Pago ───────────────────────────────────────────────────────────────

  showPagoModal = signal(false);
  gastoAPagar = signal<Gasto | null>(null);
  isSubmittingPago = signal(false);
  pagoForm: FormGroup;

  /** Espejo del form como signals, para derivar los avisos de fondos. */
  montoPago = signal(0);
  walletElegida = signal('');

  saldoPendiente = computed(() => {
    const g = this.gastoAPagar();
    if (!g) return 0;
    return Number(g.monto) - Number(g.monto_pagado || 0);
  });

  /** La billetera elegida en el modal de pago, con su saldo. */
  billeteraDePago = computed(() =>
    this.wallets().find((w) => w.id === this.walletElegida()) ?? null);

  /**
   * Cuánto quedaría en la billetera después del pago. Es el mismo chequeo que
   * hace el backend en el ledger; acá se anticipa para que el problema se vea
   * antes de apretar el botón, no después.
   */
  saldoResultante = computed(() => {
    const w = this.billeteraDePago();
    if (!w) return null;
    return Number(w.current_balance ?? 0) - (this.montoPago() || 0);
  });

  fondosInsuficientes = computed(() => {
    const r = this.saldoResultante();
    return r !== null && r < 0;
  });

  // ─── Aprobación / rechazo ───────────────────────────────────────────────

  showRechazoModal = signal(false);
  gastoARechazar = signal<Gasto | null>(null);
  motivoRechazo = '';

  gastosPendientesDeAprobar = computed(() =>
    this.gastos().filter((g) => g.estado && g.estado_aprobacion === EstadoAprobacionGasto.PENDIENTE)
  );

  constructor() {
    this.pagoForm = this.fb.group({
      monto: [0, [Validators.required, Validators.min(0.01)]],
      wallet_id: ['', Validators.required],
      metodo_pago: [MetodoPagoGasto.EFECTIVO, Validators.required],
      referencia: [''],
      notas: [''],
    });
    // Los avisos de fondos se derivan de signals; el form reactivo no dispara
    // computed(), así que estos dos campos se espejan.
    this.pagoForm.get('monto')!.valueChanges.subscribe((v) => this.montoPago.set(Number(v) || 0));
    this.pagoForm.get('wallet_id')!.valueChanges.subscribe((v) => this.walletElegida.set(v ?? ''));
  }

  ngOnInit(): void {
    this.recargarTodo();
  }

  /** Los proveedores viven en su propia pantalla; la pestaña solo navega.
   *  El módulo es de admin/pañol: a mostrador no se le ofrece el link. */
  puedeVerProveedores(): boolean {
    const rol = this.auth.rol();
    return rol === Rol.ADMIN || rol === Rol.SUPERADMIN;
  }

  irAProveedores(): void {
    this.router.navigate(['/home/proveedores']);
  }

  /** Lista + KPIs + cajas. Después de pagar o anular, todo cambia junto. */
  recargarTodo(): void {
    this.loadExpenses();
    this.versionDatos.update((v) => v + 1);
    this.expenseService.resumen().subscribe({
      next: (r) => this.resumen.set(r),
      error: (err) => console.error('Error cargando resumen', err),
    });
    this.walletsService.getActiveWallets().subscribe({
      next: (data) => this.wallets.set(data),
      error: (err) => console.error('Error cargando billeteras', err),
    });
  }

  /**
   * Llega desde Cuentas por pagar: saltar a la lista de gastos con el filtro
   * puesto en ese proveedor. Antes esa tabla era un número sin camino: decía
   * cuánto se debe pero no llevaba a los comprobantes que lo componen.
   */
  filtrarPorProveedor(proveedorId: string): void {
    this.filtros.update((f) => ({ ...f, proveedor_id: proveedorId }));
    this.activeTab.set('gastos');
    this.loadExpenses();
  }

  nombreProveedorFiltrado(): string {
    const id = this.filtros().proveedor_id;
    if (!id) return '';
    const g = this.gastos().find((x) => x.proveedor?.id === id);
    return g?.proveedor?.nombre ?? 'proveedor elegido';
  }

  loadExpenses() {
    this.expenseService.getExpenses(this.filtros()).subscribe({
      next: (data) => this.gastos.set(data),
      error: (err) => console.error('Error cargando gastos', err)
    });
  }

  cambiarFiltro(campo: string, valor: unknown) {
    this.filtros.update((f) => ({ ...f, [campo]: valor }));
    this.loadExpenses();
  }

  limpiarFiltros() {
    this.filtros.set({
      categoria: '',
      estado_pago: '',
      proveedor_id: '',
      desde: '',
      hasta: '',
      vencidos: false,
      solo_activos: true,
    });
    this.loadExpenses();
  }

  // ─── Cajas ──────────────────────────────────────────────────────────────

  abrirBilletera(w: Wallet): void {
    if (!w.id) return;
    this.billeteraAbierta.set(w);
    this.cargandoMovimientos.set(true);
    this.walletsService.movimientos(w.id).subscribe({
      next: (l) => { this.movimientosBilletera.set(l); this.cargandoMovimientos.set(false); },
      error: () => { this.movimientosBilletera.set([]); this.cargandoMovimientos.set(false); },
    });
  }

  cerrarBilletera(): void {
    this.billeteraAbierta.set(null);
    this.movimientosBilletera.set([]);
  }

  etiquetaOrigen(origen: string): string {
    return ORIGENES[origen] ?? origen;
  }

  tipoBilletera(t?: string): string {
    return { cash: 'Efectivo', bank: 'Banco', digital: 'Digital' }[t ?? ''] ?? t ?? '';
  }

  // ─── Transferencia entre cajas ──────────────────────────────────────────

  transferencia = signal<{ origen: Wallet } | null>(null);
  transDestino = signal('');
  transMonto = signal<number | null>(null);
  transMotivo = '';
  transGuardando = signal(false);

  /** Cajas a las que se puede mandar plata desde la elegida. */
  destinosPosibles = computed(() =>
    this.wallets().filter((w) => w.id !== this.transferencia()?.origen.id));

  /** Espejo del chequeo de fondos del backend, antes de apretar. */
  transInsuficiente = computed(() => {
    const t = this.transferencia();
    if (!t) return false;
    return (this.transMonto() || 0) > Number(t.origen.current_balance ?? 0);
  });

  abrirTransferencia(w: Wallet, ev: Event): void {
    ev.stopPropagation();
    this.transferencia.set({ origen: w });
    this.transDestino.set(this.destinosPosibles()[0]?.id ?? '');
    this.transMonto.set(null);
    this.transMotivo = '';
  }

  confirmarTransferencia(): void {
    const t = this.transferencia();
    const monto = this.transMonto();
    if (!t?.origen.id || !this.transDestino() || !monto || monto <= 0 || !this.transMotivo.trim()) return;
    this.transGuardando.set(true);
    this.walletsService.transferir({
      origen_id: t.origen.id,
      destino_id: this.transDestino(),
      monto,
      motivo: this.transMotivo.trim(),
    }).subscribe({
      next: () => {
        this.notification.success('Transferencia registrada en las dos cajas.');
        this.transGuardando.set(false);
        this.transferencia.set(null);
        this.recargarTodo();
      },
      error: () => {
        this.transGuardando.set(false);
      },
    });
  }

  // ─── Ajuste de saldo (arqueo contra la realidad) ────────────────────────

  ajuste = signal<Wallet | null>(null);
  ajusteSaldoReal = signal<number | null>(null);
  ajusteMotivo = '';
  ajusteGuardando = signal(false);

  /** La diferencia que el ajuste va a asentar, mostrada antes de confirmar. */
  ajusteDelta = computed(() => {
    const w = this.ajuste();
    const real = this.ajusteSaldoReal();
    if (!w || real === null) return null;
    return Number((real - Number(w.current_balance ?? 0)).toFixed(2));
  });

  abrirAjuste(w: Wallet, ev: Event): void {
    ev.stopPropagation();
    this.ajuste.set(w);
    this.ajusteSaldoReal.set(null);
    this.ajusteMotivo = '';
  }

  confirmarAjuste(): void {
    const w = this.ajuste();
    const real = this.ajusteSaldoReal();
    if (!w?.id || real === null || real < 0 || !this.ajusteMotivo.trim()) return;
    this.ajusteGuardando.set(true);
    this.walletsService.ajustar(w.id, real, this.ajusteMotivo.trim()).subscribe({
      next: (r) => {
        this.notification.success(
          `Saldo ajustado: se asentó una diferencia de $${r.ajuste.toFixed(2)}.`,
        );
        this.ajusteGuardando.set(false);
        this.ajuste.set(null);
        this.recargarTodo();
      },
      error: () => {
        this.ajusteGuardando.set(false);
      },
    });
  }

  // ─── Pago a proveedor (imputación FIFO) ─────────────────────────────────

  pagoProveedor = signal<DeudaProveedor | null>(null);
  ppMonto = signal<number | null>(null);
  ppWallet = signal('');
  ppMetodo = MetodoPagoGasto.TRANSFERENCIA as string;
  ppReferencia = '';
  ppGuardando = signal(false);
  /** Resultado de la imputación, para mostrar qué comprobantes tocó. */
  ppResultado = signal<{
    total_aplicado: number; comprobantes_saldados: number; deuda_restante: number;
    desde_anticipos?: number; desde_caja?: number;
    imputaciones: { numero_gasto: string; aplicado: number; saldado: boolean }[];
  } | null>(null);

  ppBilletera = computed(() =>
    this.wallets().find((w) => w.id === this.ppWallet()) ?? null);

  /** Si el proveedor tiene saldo a cuenta, por defecto se consume primero. */
  ppUsarAnticipos = signal(true);
  ppACuenta = computed(() => Number(this.pagoProveedor()?.a_cuenta ?? 0));
  /** Lo que efectivamente va a salir de la caja: el resto lo cubren anticipos. */
  ppDesdeCaja = computed(() => {
    const monto = this.ppMonto() || 0;
    const anticipos = this.ppUsarAnticipos() ? this.ppACuenta() : 0;
    return Math.max(0, monto - anticipos);
  });

  ppInsuficiente = computed(() => {
    const w = this.ppBilletera();
    if (!w) return false;
    return this.ppDesdeCaja() > Number(w.current_balance ?? 0);
  });

  abrirPagoProveedor(deuda: DeudaProveedor): void {
    this.pagoProveedor.set(deuda);
    this.ppMonto.set(Number(deuda.deuda));
    this.ppWallet.set(this.wallets()[0]?.id ?? '');
    this.ppMetodo = MetodoPagoGasto.TRANSFERENCIA;
    this.ppReferencia = '';
    this.ppUsarAnticipos.set(true);
    this.ppResultado.set(null);
  }

  confirmarPagoProveedor(): void {
    const deuda = this.pagoProveedor();
    const monto = this.ppMonto();
    if (!deuda?.proveedor_id || !monto || monto <= 0 || !this.ppWallet() || this.ppInsuficiente()) return;
    this.ppGuardando.set(true);
    this.expenseService.pagarProveedor({
      proveedor_id: deuda.proveedor_id,
      monto,
      wallet_id: this.ppWallet(),
      metodo_pago: this.ppMetodo,
      referencia: this.ppReferencia.trim() || undefined,
      usar_anticipos: this.ppUsarAnticipos(),
    }).subscribe({
      next: (r) => {
        this.ppGuardando.set(false);
        this.ppResultado.set(r);   // se muestra el detalle de la imputación
        this.recargarTodo();
      },
      error: () => {
        this.ppGuardando.set(false);
      },
    });
  }

  cerrarPagoProveedor(): void {
    this.pagoProveedor.set(null);
    this.ppResultado.set(null);
  }

  // ─── Anticipos a proveedor ──────────────────────────────────────────────

  anticipoProveedor = signal<DeudaProveedor | null>(null);
  antMonto = signal<number | null>(null);
  antWallet = signal('');
  antNotas = '';
  antGuardando = signal(false);
  /** Anticipos vigentes del proveedor, para verlos y poder anular. */
  antVigentes = signal<Anticipo[]>([]);

  antBilletera = computed(() =>
    this.wallets().find((w) => w.id === this.antWallet()) ?? null);

  antInsuficiente = computed(() => {
    const w = this.antBilletera();
    if (!w) return false;
    return (this.antMonto() || 0) > Number(w.current_balance ?? 0);
  });

  abrirAnticipo(deuda: DeudaProveedor): void {
    this.anticipoProveedor.set(deuda);
    this.antMonto.set(null);
    this.antWallet.set(this.wallets()[0]?.id ?? '');
    this.antNotas = '';
    this.cargarAnticiposVigentes(deuda.proveedor_id!);
  }

  private cargarAnticiposVigentes(proveedorId: string): void {
    this.expenseService.anticiposDe(proveedorId).subscribe({
      next: (r) => this.antVigentes.set(r.anticipos ?? []),
      error: () => this.antVigentes.set([]),
    });
  }

  confirmarAnticipo(): void {
    const deuda = this.anticipoProveedor();
    const monto = this.antMonto();
    if (!deuda?.proveedor_id || !monto || monto <= 0 || !this.antWallet() || this.antInsuficiente()) return;
    this.antGuardando.set(true);
    this.expenseService.crearAnticipo({
      proveedor_id: deuda.proveedor_id,
      monto,
      wallet_id: this.antWallet(),
      notas: this.antNotas.trim() || undefined,
    }).subscribe({
      next: () => {
        this.antGuardando.set(false);
        this.notification.success(`Anticipo registrado a cuenta de ${deuda.proveedor}`);
        this.antMonto.set(null);
        this.antNotas = '';
        this.cargarAnticiposVigentes(deuda.proveedor_id!);
        this.recargarTodo();
      },
      error: () => {
        this.antGuardando.set(false);
      },
    });
  }

  /** Solo un anticipo sin consumir se puede anular: el importe vuelve a la caja. */
  anticipoAAnular = signal<Anticipo | null>(null);
  motivoAnularAnticipo = '';

  anularAnticipo(a: Anticipo): void {
    this.motivoAnularAnticipo = '';
    this.anticipoAAnular.set(a);
  }

  confirmarAnularAnticipo(): void {
    const a = this.anticipoAAnular();
    if (!a) return;
    this.expenseService.anularAnticipo(a.id, this.motivoAnularAnticipo.trim() || undefined).subscribe({
      next: () => {
        this.notification.success('Anticipo anulado: el importe volvió a la caja');
        const deuda = this.anticipoProveedor();
        if (deuda?.proveedor_id) this.cargarAnticiposVigentes(deuda.proveedor_id);
        this.recargarTodo();
        this.anticipoAAnular.set(null);
      },
      // El aviso lo da el interceptor, con el mensaje traducido.
      error: () => {},
    });
  }

  cerrarAnticipo(): void {
    this.anticipoProveedor.set(null);
    this.antVigentes.set([]);
  }

  // ─── Exportación ────────────────────────────────────────────────────────

  exportando = signal(false);

  /** La lista filtrada tal como se ve, a un .xlsx. */
  async exportarExcel(): Promise<void> {
    // DAT-01: cuántos registros salen a un archivo, antes de bajarlos.
    if (!confirmarExportacion(this.gastos().length, 'gastos')) return;
    this.exportando.set(true);
    try {
      await this.excel.descargar(
        `gastos-${new Date().toISOString().slice(0, 10)}.xlsx`,
        'Gastos',
        [
          { clave: 'numero', titulo: 'Número', ancho: 14 },
          { clave: 'fecha', titulo: 'Fecha', ancho: 12 },
          { clave: 'vence', titulo: 'Vence', ancho: 12 },
          { clave: 'descripcion', titulo: 'Descripción', ancho: 34 },
          { clave: 'categoria', titulo: 'Rubro', ancho: 14 },
          { clave: 'proveedor', titulo: 'Proveedor', ancho: 20 },
          { clave: 'monto', titulo: 'Monto', ancho: 12 },
          { clave: 'pagado', titulo: 'Pagado', ancho: 12 },
          { clave: 'saldo', titulo: 'Saldo', ancho: 12 },
          { clave: 'estado_pago', titulo: 'Estado', ancho: 12 },
          { clave: 'comprobante', titulo: 'Comprobante', ancho: 18 },
        ],
        this.gastos().map((g) => ({
          numero: g.numero_gasto,
          fecha: String(g.fecha).slice(0, 10),
          vence: g.fecha_vencimiento ? String(g.fecha_vencimiento).slice(0, 10) : '',
          descripcion: g.descripcion,
          categoria: this.etiquetaCategoria(g.categoria),
          proveedor: g.proveedor?.nombre ?? '',
          monto: Number(g.monto),
          pagado: Number(g.monto_pagado || 0),
          saldo: Number(g.monto) - Number(g.monto_pagado || 0),
          estado_pago: g.estado ? this.etiquetaEstadoPago(g.estado_pago) : 'Anulado',
          comprobante: g.numero_comprobante ?? '',
        })),
      );
    } finally {
      this.exportando.set(false);
    }
  }

  // ─── Alta / edición / anulación de gasto ────────────────────────────────

  /** Gasto que el modal de alta va a editar (null = alta nueva). */
  gastoAEditar = signal<Gasto | null>(null);

  openModal() {
    this.gastoAEditar.set(null);
    this.showModal.set(true);
  }
  closeModal() { this.showModal.set(false); }

  editarGasto(gasto: Gasto, ev: Event): void {
    ev.stopPropagation();
    this.gastoAEditar.set(gasto);
    this.showModal.set(true);
  }

  /** Un click: mismo gasto, fecha de hoy. Para el proveedor de todas las semanas. */
  duplicarGasto(gasto: Gasto, ev: Event): void {
    ev.stopPropagation();
    this.expenseService.createExpense({
      fecha: new Date().toISOString().slice(0, 10),
      categoria: gasto.categoria,
      descripcion: gasto.descripcion,
      monto: Number(gasto.monto),
      metodo_pago: gasto.metodo_pago,
      ...(gasto.proveedor?.id ? { proveedor_id: gasto.proveedor.id } : {}),
      ...(gasto.notas ? { notas: gasto.notas } : {}),
    }).subscribe({
      next: (nuevo) => {
        this.notification.success(`Duplicado como ${nuevo.numero_gasto}, con fecha de hoy.`);
        this.recargarTodo();
      },
      // El aviso lo da el interceptor, con el mensaje traducido.
      error: () => {},
    });
  }

  /**
   * La anulación pide motivo: es una acción auditada, y "quién anuló y por
   * qué" es exactamente lo que se busca cuando algo no cierra.
   */
  motivoAnularGasto = '';

  confirmAnularGasto(id: string) {
    this.gastoIdToAnular.set(id);
    this.motivoAnularGasto = '';
    this.showConfirmAnular.set(true);
  }

  /** Pago de un turno cerrado: el operador elige el destino en un modal propio. */
  destinoPendiente = signal(false);

  elegirDestino(destino: 'turno_actual' | 'sin_arqueo'): void {
    this.destinoPendiente.set(false);
    this.onConfirmAnular(destino);
  }

  cancelarDestino(): void {
    this.destinoPendiente.set(false);
    this.showConfirmAnular.set(false);
    this.gastoIdToAnular.set(null);
  }

  onConfirmAnular(destino?: 'turno_actual' | 'sin_arqueo') {
    const id = this.gastoIdToAnular();
    if (!id || !this.motivoAnularGasto.trim() || this.anulando()) return;
    this.anulando.set(true);
    this.expenseService.anularExpenseConMotivo(id, this.motivoAnularGasto.trim(), destino).subscribe({
      next: () => {
        this.anulando.set(false);
        this.notification.success('Gasto anulado. Si tenía pagos, el importe volvió a las billeteras.');
        this.recargarTodo();
        this.showConfirmAnular.set(false);
      },
      error: (err) => {
        this.anulando.set(false);
        // Pagos de un turno cerrado: el operador decide el destino del dinero.
        if (err?.error?.code === 'DESTINO_REQUERIDO' && !destino) {
          this.destinoPendiente.set(true);
          return;
        }
        this.showConfirmAnular.set(false);
      }
    });
  }

  onCancelAnular() {
    this.showConfirmAnular.set(false);
    this.gastoIdToAnular.set(null);
  }

  // ─── Detalle y anulación de pagos ───────────────────────────────────────

  verDetalle(gasto: Gasto): void {
    // Se relee del backend porque la lista no trae los pagos.
    this.expenseService.getExpense(gasto.id).subscribe({
      next: (g) => this.gastoDetalle.set(g),
      // El aviso lo da el interceptor, con el mensaje traducido.
      error: () => {},
    });
  }

  cerrarDetalle(): void {
    this.gastoDetalle.set(null);
    this.pagoAAnular.set(null);
  }

  prepararAnularPago(pago: { id: string; monto: string | number }): void {
    this.pagoAAnular.set({ id: pago.id, monto: Number(pago.monto) });
    this.motivoAnularPago = '';
    this.pedirDestinoPago.set(false);
  }

  confirmarAnularPago(destino?: 'turno_actual' | 'sin_arqueo'): void {
    const pago = this.pagoAAnular();
    const gasto = this.gastoDetalle();
    if (!pago || !gasto || this.anulando()) return;
    this.anulando.set(true);
    this.expenseService.anularPago(pago.id, this.motivoAnularPago.trim() || undefined, destino).subscribe({
      next: () => {
        this.anulando.set(false);
        this.notification.success(
          destino === 'sin_arqueo'
            ? 'Pago anulado sin tocar la caja: el arqueo de cierre de ese turno ya había ajustado la diferencia.'
            : 'Pago anulado: la plata entró al arqueo del turno actual.',
        );
        this.pagoAAnular.set(null);
        this.pedirDestinoPago.set(false);
        this.verDetalle(gasto);   // refresca el detalle abierto
        this.recargarTodo();
      },
      error: (err) => {
        this.anulando.set(false);
        // El pago es de un turno cerrado: el backend exige que el operador
        // decida el destino de la plata antes de revertir.
        if (err?.error?.code === 'DESTINO_REQUERIDO') {
          this.pedirDestinoPago.set(true);
          return;
        }
      },
    });
  }

  // ─── Aprobación ─────────────────────────────────────────────────────────

  aprobar(gasto: Gasto) {
    this.expenseService.aprobar(gasto.id).subscribe({
      next: () => {
        this.notification.success(`Gasto ${gasto.numero_gasto} aprobado`);
        this.recargarTodo();
      },
      // El aviso lo da el interceptor, con el mensaje traducido.
      error: () => {},
    });
  }

  abrirRechazo(gasto: Gasto) {
    this.gastoARechazar.set(gasto);
    this.motivoRechazo = '';
    this.showRechazoModal.set(true);
  }

  cerrarRechazo() {
    this.showRechazoModal.set(false);
    this.gastoARechazar.set(null);
  }

  confirmarRechazo() {
    const gasto = this.gastoARechazar();
    if (!gasto || !this.motivoRechazo.trim()) return;
    this.expenseService.rechazar(gasto.id, this.motivoRechazo.trim()).subscribe({
      next: () => {
        this.notification.success(`Gasto ${gasto.numero_gasto} rechazado`);
        this.cerrarRechazo();
        this.recargarTodo();
      },
      // El aviso lo da el interceptor, con el mensaje traducido.
      error: () => {},
    });
  }

  // ─── Pago ───────────────────────────────────────────────────────────────

  abrirPago(gasto: Gasto) {
    this.gastoAPagar.set(gasto);
    const saldo = Number(gasto.monto) - Number(gasto.monto_pagado || 0);
    this.pagoForm.reset({
      monto: saldo > 0 ? saldo : 0,
      wallet_id: this.wallets()[0]?.id ?? '',
      metodo_pago: gasto.metodo_pago || MetodoPagoGasto.EFECTIVO,
      referencia: '',
      notas: '',
    });
    this.montoPago.set(saldo > 0 ? saldo : 0);
    this.walletElegida.set(this.wallets()[0]?.id ?? '');
    this.showPagoModal.set(true);
  }

  cerrarPago() {
    this.showPagoModal.set(false);
    this.gastoAPagar.set(null);
  }

  confirmarPago() {
    const gasto = this.gastoAPagar();
    if (!gasto || this.pagoForm.invalid) {
      this.pagoForm.markAllAsTouched();
      return;
    }
    // Espejo del chequeo del ledger: si no alcanza, ni se manda.
    if (this.fondosInsuficientes()) return;

    this.isSubmittingPago.set(true);
    this.expenseService.registrarPago(gasto.id, this.pagoForm.value).subscribe({
      next: () => {
        this.notification.success(`Pago registrado para ${gasto.numero_gasto}`);
        this.isSubmittingPago.set(false);
        this.cerrarPago();
        this.recargarTodo();
      },
      error: () => {
        this.isSubmittingPago.set(false);
      },
    });
  }

  // ─── Etiquetas ──────────────────────────────────────────────────────────

  etiquetaEstadoPago(estado: EstadoPagoGasto): string {
    return { pendiente: 'Sin pagar', parcial: 'Pago parcial', pagado: 'Pagado' }[estado] ?? estado;
  }

  etiquetaCategoria(c: string): string {
    return ETIQUETAS_CATEGORIA_GASTO[c] ?? c;
  }

  /** Vencido: pasó la fecha y sigue con saldo. */
  estaVencido(g: Gasto): boolean {
    if (!g.fecha_vencimiento || g.estado_pago === EstadoPagoGasto.PAGADO) return false;
    return new Date(g.fecha_vencimiento) < new Date();
  }

  /** Porcentaje pagado de un gasto, para la barrita de la tabla. */
  porcentajePagado(g: Gasto): number {
    const total = Number(g.monto);
    if (!total) return 0;
    return Math.min(100, Math.round((Number(g.monto_pagado || 0) / total) * 100));
  }

  /** `2026-08` → `Ago`. Para el mini gráfico de meses. */
  etiquetaMes(m: string): string {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const idx = parseInt(m.split('-')[1], 10) - 1;
    return meses[idx] ?? m;
  }

  /** Altura relativa de la barra de un mes respecto del máximo del período. */
  alturaMes(total: number): number {
    const max = Math.max(...(this.resumen()?.por_mes.map((x) => x.total) ?? [1]), 1);
    return Math.max(4, Math.round((total / max) * 100));
  }
}
