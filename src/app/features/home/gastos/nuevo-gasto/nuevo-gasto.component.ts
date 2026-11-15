import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  CATEGORIAS_GASTO_VISIBLES, ETIQUETAS_CATEGORIA_GASTO,
  Gasto, MetodoPagoGasto, TipoComprobanteGasto,
} from '../../../../core/interfaces/gastos.interface';
import { ProveedorService } from '../../proveedores/services/proveedor.service';
import { Proveedor } from '../../../../core/interfaces/proveedor.interface';
import { ExpenseService } from '../services/expense.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { urlFoto } from '../../../../core/utils/foto-url.util';

const ETIQUETAS_COMPROBANTE: Record<string, string> = {
  factura_a: 'Factura A',
  factura_b: 'Factura B',
  factura_c: 'Factura C',
  factura_m: 'Factura M',
  nota_credito: 'Nota de crédito',
  nota_debito: 'Nota de débito',
  ticket: 'Ticket',
  remito: 'Remito',
  sin_comprobante: 'Sin comprobante',
};

/**
 * Alta de un gasto.
 *
 * El backend aceptaba desde el principio vencimiento, tipo de comprobante,
 * punto de venta y desglose fiscal (neto/IVA/percepciones) — pero el form
 * nunca los ofreció, así que el circuito de vencimientos no tenía cómo
 * alimentarse: un gasto sin fecha de vencimiento no aparece en Vencimientos
 * ni cuenta como "vencido" en ningún lado.
 */
@Component({
  selector: 'app-nuevo-gasto',
  templateUrl: './nuevo-gasto.component.html',
  styleUrls: ['./nuevo-gasto.component.scss']
})
export class NuevoGastoComponent implements OnInit {
  @Input() set showModal(value: boolean) {
    this._showModal = value;
    if (value && this.expenseForm) {
      if (this._gastoAEditar) this.precargar(this._gastoAEditar);
      else this.resetForm();
    }
  }
  get showModal(): boolean { return this._showModal; }
  private _showModal = false;

  /**
   * Gasto a editar. Con esto seteado, el modal precarga los valores y el
   * guardado hace PATCH en vez de POST. El monto solo se puede subir por
   * encima de lo ya pagado — esa regla la hace cumplir el backend.
   */
  @Input() set gastoAEditar(g: Gasto | null) {
    this._gastoAEditar = g;
    if (g && this.expenseForm) this.precargar(g);
  }
  get gastoAEditar(): Gasto | null { return this._gastoAEditar; }
  private _gastoAEditar: Gasto | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() expenseCreated = new EventEmitter<any>();

  private fb = inject(FormBuilder);
  private proveedorService = inject(ProveedorService);
  private expenseService = inject(ExpenseService);
  private notification = inject(NotificationService);

  expenseForm!: FormGroup;
  /** Sin 'packaging': el valor solo queda para datos históricos. */
  categorias = CATEGORIAS_GASTO_VISIBLES;
  metodosPago = Object.values(MetodoPagoGasto);
  tiposComprobante = Object.values(TipoComprobanteGasto);
  proveedores = signal<Proveedor[]>([]);
  isSaving = signal(false);

  /**
   * Desglose fiscal opcional. Cuando está activo, el monto se calcula
   * neto + IVA + percepciones — la misma regla del backend, para que no
   * puedan quedar dos números contradiciéndose.
   */
  conDesglose = signal(false);
  private neto = signal(0);
  private iva = signal(0);
  private percepciones = signal(0);
  totalDesglose = computed(() => this.neto() + this.iva() + this.percepciones());

  proveedorElegido = signal<string>('');

  /** El proveedor seleccionado, para el aviso del plazo de pago. */
  proveedorActual = computed(() =>
    this.proveedores().find((p) => p.id === this.proveedorElegido()) ?? null);

  ngOnInit(): void {
    this.initForm();
    this.loadProveedores();
  }

  initForm() {
    this.expenseForm = this.fb.group({
      fecha: [this.hoy(), Validators.required],
      categoria: ['', Validators.required],
      descripcion: ['', Validators.required],
      monto: [null, [Validators.required, Validators.min(0.01)]],
      metodo_pago: ['', Validators.required],
      proveedor_id: [''],
      // El circuito de vencimientos se alimenta de este campo.
      fecha_vencimiento: [''],
      tipo_comprobante: [TipoComprobanteGasto.SIN_COMPROBANTE],
      punto_venta: [''],
      numero_comprobante: [''],
      // Desglose fiscal
      neto: [null],
      iva: [null],
      percepciones: [null],
      imagen_comprobante_url: [''],
      notas: ['']
    });

    this.expenseForm.get('proveedor_id')!.valueChanges
      .subscribe((v) => this.proveedorElegido.set(v ?? ''));
    this.expenseForm.get('neto')!.valueChanges
      .subscribe((v) => { this.neto.set(Number(v) || 0); this.sincronizarMonto(); });
    this.expenseForm.get('iva')!.valueChanges
      .subscribe((v) => { this.iva.set(Number(v) || 0); this.sincronizarMonto(); });
    this.expenseForm.get('percepciones')!.valueChanges
      .subscribe((v) => { this.percepciones.set(Number(v) || 0); this.sincronizarMonto(); });
  }

  private resetForm(): void {
    this.expenseForm.reset({
      fecha: this.hoy(),
      categoria: '',
      metodo_pago: '',
      proveedor_id: '',
      fecha_vencimiento: '',
      tipo_comprobante: TipoComprobanteGasto.SIN_COMPROBANTE,
      punto_venta: '',
      numero_comprobante: '',
      imagen_comprobante_url: '',
      notas: '',
    });
    this.conDesglose.set(false);
    this.desgloseAlCargar = false;
    this.neto.set(0); this.iva.set(0); this.percepciones.set(0);
    this.expenseForm.get('monto')!.enable();
    this.fijarMontoEnCero(false);
  }

  /**
   * Si el gasto que se editó tenía el desglose activo al abrirlo. Solo en ese
   * caso, destildarlo manda neto, IVA y percepciones en 0 para limpiarlos;
   * si no, el PATCH no manda desglose y el backend no lo toca.
   */
  private desgloseAlCargar = false;

  /**
   * El gasto que se edita quedó en $0 por una nota de crédito total. El
   * formulario no puede exigir monto > 0 (nacería inválido y no se podría
   * guardar nada) y el backend no acepta un monto 0 por el PATCH: mientras el
   * operario no escriba otro monto, no se manda.
   */
  montoEnCero = signal(false);

  private fijarMontoEnCero(enCero: boolean): void {
    this.montoEnCero.set(enCero);
    const monto = this.expenseForm.get('monto')!;
    monto.setValidators(
      enCero ? [Validators.required, Validators.min(0)] : [Validators.required, Validators.min(0.01)],
    );
    monto.updateValueAndValidity({ emitEvent: false });
  }

  get esEdicion(): boolean { return !!this._gastoAEditar; }

  private precargar(g: Gasto): void {
    this.conDesglose.set(false);
    this.desgloseAlCargar = false;
    this.expenseForm.get('monto')!.enable();
    this.fijarMontoEnCero(Number(g.monto) === 0);
    this.expenseForm.reset({
      fecha: String(g.fecha).slice(0, 10),
      categoria: g.categoria,
      descripcion: g.descripcion,
      monto: Number(g.monto),
      metodo_pago: g.metodo_pago,
      proveedor_id: g.proveedor?.id ?? '',
      fecha_vencimiento: g.fecha_vencimiento ? String(g.fecha_vencimiento).slice(0, 10) : '',
      tipo_comprobante: g.tipo_comprobante ?? TipoComprobanteGasto.SIN_COMPROBANTE,
      punto_venta: g.punto_venta ?? '',
      numero_comprobante: g.numero_comprobante ?? '',
      imagen_comprobante_url: g.imagen_comprobante_url ?? '',
      notas: g.notas ?? '',
    });

    // El desglose se precarga solo si hay algo que desglosar y cierra con el
    // total. Uno que no cierra (una nota de crédito le bajó el monto) se
    // abriría mostrando otro total, y guardar cualquier cosa lo mandaría.
    const neto = Number(g.neto ?? 0);
    const iva = Number(g.iva ?? 0);
    const percepciones = Number(g.percepciones ?? 0);
    const cierra =
      Number((neto + iva + percepciones).toFixed(2)) === Number(Number(g.monto).toFixed(2));
    if ((iva > 0 || percepciones > 0) && cierra) {
      this.conDesglose.set(true);
      this.desgloseAlCargar = true;
      this.expenseForm.get('monto')!.disable();
      this.expenseForm.patchValue({ neto, iva, percepciones });
    }
  }

  // ─── Foto del comprobante ────────────────────────────────────────────

  subiendoComprobante = signal(false);

  get comprobanteUrl(): string {
    return this.expenseForm?.get('imagen_comprobante_url')?.value || '';
  }

  /** El backend guarda /uploads/... (host de la API) o la URL absoluta de Cloudinary. */
  get comprobanteHref(): string {
    const url = this.comprobanteUrl;
    return url ? urlFoto(url) : url;
  }

  subirComprobante(ev: Event): void {
    const archivo = (ev.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    this.subiendoComprobante.set(true);
    this.expenseService.uploadComprobante(archivo).subscribe({
      next: (r) => {
        this.expenseForm.patchValue({ imagen_comprobante_url: r.url });
        this.subiendoComprobante.set(false);
      },
      error: () => {
        this.subiendoComprobante.set(false);
      },
    });
  }

  quitarComprobante(): void {
    this.expenseForm.patchValue({ imagen_comprobante_url: '' });
  }

  private hoy(): string {
    return new Date().toISOString().substring(0, 10);
  }

  loadProveedores() {
    this.proveedorService.getProveedores().subscribe({
      next: (data) => this.proveedores.set(data),
      error: (err) => console.error('Error al cargar proveedores:', err)
    });
  }

  toggleDesglose(activo: boolean): void {
    this.conDesglose.set(activo);
    const monto = this.expenseForm.get('monto')!;
    if (activo) {
      // Con desglose, el total deja de tipearse: se deriva.
      monto.disable();
      this.sincronizarMonto();
    } else {
      this.expenseForm.patchValue({ neto: null, iva: null, percepciones: null });
      this.neto.set(0); this.iva.set(0); this.percepciones.set(0);
      monto.enable();
    }
  }

  private sincronizarMonto(): void {
    if (!this.conDesglose()) return;
    this.expenseForm.get('monto')!.setValue(
      Number(this.totalDesglose().toFixed(2)),
      { emitEvent: false },
    );
  }

  etiquetaComprobante(t: string): string {
    return ETIQUETAS_COMPROBANTE[t] ?? t;
  }

  etiquetaCategoria(c: string): string {
    return ETIQUETAS_CATEGORIA_GASTO[c] ?? c;
  }

  onClose() {
    this.close.emit();
  }

  onSubmit() {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    // getRawValue: con desglose activo, "monto" está disabled y .value lo omite.
    const v = this.expenseForm.getRawValue();
    const payload: Record<string, unknown> = {
      fecha: v.fecha,
      categoria: v.categoria,
      descripcion: v.descripcion,
      metodo_pago: v.metodo_pago,
      tipo_comprobante: v.tipo_comprobante || undefined,
    };

    if (this.conDesglose()) {
      // Se manda el desglose y el backend calcula el total: una sola verdad.
      payload['neto'] = Number(v.neto) || 0;
      payload['iva'] = Number(v.iva) || 0;
      payload['percepciones'] = Number(v.percepciones) || 0;
    } else if (this.esEdicion && this.montoEnCero() && !(Number(v.monto) > 0)) {
      // Gasto en $0 por nota de crédito total y el operario no lo cambió: no
      // se manda ni monto ni desglose, y el backend no toca los totales.
    } else {
      payload['monto'] = Number(v.monto);
      // Tenía desglose y el operario lo sacó: hay que limpiarlo, o el backend
      // conservaría el guardado.
      if (this.esEdicion && this.desgloseAlCargar) {
        payload['neto'] = 0;
        payload['iva'] = 0;
        payload['percepciones'] = 0;
      }
    }

    if (v.proveedor_id) payload['proveedor_id'] = v.proveedor_id;
    if (v.fecha_vencimiento) payload['fecha_vencimiento'] = v.fecha_vencimiento;
    if (v.punto_venta) payload['punto_venta'] = v.punto_venta;
    if (v.numero_comprobante) payload['numero_comprobante'] = v.numero_comprobante;
    if (v.imagen_comprobante_url) payload['imagen_comprobante_url'] = v.imagen_comprobante_url;
    if (v.notas) payload['notas'] = v.notas;

    this.isSaving.set(true);
    // Mismo modal, dos destinos: alta o edición del gasto precargado.
    const peticion = this.esEdicion
      ? this.expenseService.updateExpense(this._gastoAEditar!.id, payload)
      : this.expenseService.createExpense(payload);

    const estabaAprobado = this._gastoAEditar?.estado_aprobacion === 'aprobado';
    peticion.subscribe({
      next: (res) => {
        this.isSaving.set(false);
        // El backend lo vuelve a poner en espera si el total nuevo pasa el
        // umbral de aprobación: sin este aviso, el botón Pagar desaparece sin
        // explicación.
        if (this.esEdicion && estabaAprobado && res?.estado_aprobacion === 'pendiente') {
          this.notification.warning(
            'El total nuevo supera el umbral de aprobación: el gasto volvió a esperar firma.',
          );
        }
        this.expenseCreated.emit(res);
        this.onClose();
      },
      error: () => {
        this.isSaving.set(false);
      }
    });
  }
}
