import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Frecuencia, FinanceService, GastoRecurrente } from '../services/finance.service';
import { ProveedorService } from '../../proveedores/services/proveedor.service';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  CATEGORIAS_GASTO_VISIBLES, CategoriaGasto, ETIQUETAS_CATEGORIA_GASTO, MetodoPagoGasto,
} from '../../../../core/interfaces/gastos.interface';

/**
 * Gastos fijos: alquiler, servicios, sueldos, ABL. Se cargan una vez como
 * plantilla y el sistema genera el gasto del período con un botón, en vez de
 * que alguien lo cargue a mano todos los meses y se olvide alguno.
 *
 * El CRUD completo ya existía en el backend (`/finance/recurrentes`) sin
 * ninguna pantalla que lo usara.
 */
@Component({
  selector: 'app-recurrentes',
  templateUrl: './recurrentes.component.html',
  styleUrls: ['./recurrentes.component.scss'],
})
export class RecurrentesComponent implements OnInit {
  private finance = inject(FinanceService);
  private proveedorService = inject(ProveedorService);
  private fb = inject(FormBuilder);
  private notification = inject(NotificationService);

  /** Sin 'packaging': el valor solo queda para datos históricos. */
  categorias = CATEGORIAS_GASTO_VISIBLES;
  metodosPago = Object.values(MetodoPagoGasto);
  frecuencias = [
    { valor: Frecuencia.SEMANAL, etiqueta: 'Semanal' },
    { valor: Frecuencia.QUINCENAL, etiqueta: 'Quincenal' },
    { valor: Frecuencia.MENSUAL, etiqueta: 'Mensual' },
    { valor: Frecuencia.BIMESTRAL, etiqueta: 'Bimestral' },
    { valor: Frecuencia.TRIMESTRAL, etiqueta: 'Trimestral' },
    { valor: Frecuencia.ANUAL, etiqueta: 'Anual' },
  ];

  recurrentes = signal<GastoRecurrente[]>([]);
  proveedores = signal<any[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);
  generando = signal(false);
  showModal = signal(false);
  editandoId = signal<string | null>(null);

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      descripcion: ['', [Validators.required, Validators.maxLength(200)]],
      categoria: [CategoriaGasto.SERVICIOS, Validators.required],
      monto: [0, [Validators.required, Validators.min(0.01)]],
      metodo_pago: [MetodoPagoGasto.TRANSFERENCIA, Validators.required],
      frecuencia: [Frecuencia.MENSUAL, Validators.required],
      dia_vencimiento: [10, [Validators.required, Validators.min(1), Validators.max(31)]],
      fecha_inicio: [new Date().toISOString().slice(0, 10), Validators.required],
      fecha_fin: [''],
      proveedor_id: [''],
      notas: [''],
    });
  }

  ngOnInit(): void {
    this.cargar();
    this.proveedorService.getProveedores().subscribe({
      next: (data: any) => this.proveedores.set(data),
      error: () => this.proveedores.set([]),
    });
  }

  cargar() {
    this.isLoading.set(true);
    this.finance.listarRecurrentes().subscribe({
      next: (data) => {
        this.recurrentes.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  abrirModal(r?: GastoRecurrente) {
    if (r) {
      this.editandoId.set(r.id);
      this.form.patchValue({
        descripcion: r.descripcion,
        categoria: r.categoria,
        monto: Number(r.monto),
        metodo_pago: r.metodo_pago,
        frecuencia: r.frecuencia,
        dia_vencimiento: r.dia_vencimiento,
        fecha_inicio: r.fecha_inicio?.slice(0, 10),
        fecha_fin: r.fecha_fin?.slice(0, 10) ?? '',
        proveedor_id: r.proveedor?.id ?? '',
        notas: r.notas ?? '',
      });
    } else {
      this.editandoId.set(null);
      this.form.reset({
        descripcion: '',
        categoria: CategoriaGasto.SERVICIOS,
        monto: 0,
        metodo_pago: MetodoPagoGasto.TRANSFERENCIA,
        frecuencia: Frecuencia.MENSUAL,
        dia_vencimiento: 10,
        fecha_inicio: new Date().toISOString().slice(0, 10),
        fecha_fin: '',
        proveedor_id: '',
        notas: '',
      });
    }
    this.showModal.set(true);
  }

  cerrarModal() {
    this.showModal.set(false);
    this.editandoId.set(null);
  }

  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);

    // Los opcionales vacíos van en null y no se omiten (#16): omitidos, el
    // backend no los toca, y borrar el «Hasta» o el proveedor de una
    // plantilla no hacía nada. Un string vacío no pasaría la validación.
    const raw = this.form.value;
    const dto: Record<string, unknown> = {
      descripcion: raw.descripcion,
      categoria: raw.categoria,
      monto: Number(raw.monto),
      metodo_pago: raw.metodo_pago,
      frecuencia: raw.frecuencia,
      dia_vencimiento: Number(raw.dia_vencimiento),
      fecha_inicio: raw.fecha_inicio,
      fecha_fin: raw.fecha_fin || null,
      proveedor_id: raw.proveedor_id || null,
      notas: raw.notas || null,
    };

    const id = this.editandoId();
    const req = id
      ? this.finance.actualizarRecurrente(id, dto)
      : this.finance.crearRecurrente(dto);

    req.subscribe({
      next: (guardada) => {
        const accion = id ? 'actualizado' : 'creado';
        // Guardar no la pone en marcha si terminó o está de baja: se avisa
        // qué hacer, para que no parezca que va a seguir generando (#42).
        const estado = guardada ? this.estado(guardada) : 'activo';
        if (estado === 'finalizado') {
          this.notification.warning(
            `Gasto fijo ${accion}, pero ya pasó su «Hasta» y no genera más. Si sigue, extendé «Hasta».`,
          );
        } else if (estado === 'baja') {
          this.notification.warning(
            `Gasto fijo ${accion}, pero está dado de baja y no genera. Para que vuelva, tocá Reactivar.`,
          );
        } else {
          this.notification.success(`Gasto recurrente ${accion}`);
        }
        this.isSaving.set(false);
        this.cerrarModal();
        this.cargar();
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }

  /** Plantilla pendiente de confirmación de baja (modal propio). */
  bajaPendiente = signal<GastoRecurrente | null>(null);

  desactivar(r: GastoRecurrente) {
    this.bajaPendiente.set(r);
  }

  confirmarBaja() {
    const r = this.bajaPendiente();
    if (!r) return;
    this.bajaPendiente.set(null);
    this.finance.desactivarRecurrente(r.id).subscribe({
      next: () => {
        this.notification.success('Gasto recurrente dado de baja');
        this.cargar();
      },
      // El aviso lo da el interceptor, con el mensaje traducido.
      error: () => {},
    });
  }

  /**
   * Tres estados (#42): `activo`; `finalizado`, cuando el próximo vencimiento
   * ya pasó el «Hasta» (sigue activa y extender «Hasta» la vuelve a poner en
   * marcha); y `baja`, cuando alguien la dio de baja (vuelve con Reactivar).
   * Una plantilla que el bug viejo apagó al llegar al «Hasta» figura de baja.
   */
  estado(r: GastoRecurrente): 'activo' | 'finalizado' | 'baja' {
    if (!r.activo) return 'baja';
    const fin = r.fecha_fin?.slice(0, 10);
    const proxima = r.proxima_generacion?.slice(0, 10);
    // 'YYYY-MM-DD' se compara bien como texto.
    if (fin && proxima && proxima > fin) return 'finalizado';
    return 'activo';
  }

  /** 'YYYY-MM-DD' → 'dd/mm', sin pasar por Date (y sin corrimiento de huso). */
  diaMes(fecha?: string | null): string {
    if (!fecha) return '';
    return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
  }

  /** 'YYYY-MM-DD' → 'dd/mm/aaaa'. */
  diaMesAnio(fecha?: string | null): string {
    if (!fecha) return '';
    return `${this.diaMes(fecha)}/${fecha.slice(0, 4)}`;
  }

  /** Plantilla dada de baja que se está por reactivar (modal propio). */
  reactivarPendiente = signal<GastoRecurrente | null>(null);
  reactivando = signal(false);

  reactivar(r: GastoRecurrente) {
    this.reactivarPendiente.set(r);
  }

  /**
   * 'pendiente' genera desde donde quedó, hueco incluido (el servicio siguió
   * y se pagó); 'hoy' saltea lo vencido y retoma desde hoy.
   */
  confirmarReactivar(desde: 'pendiente' | 'hoy') {
    const r = this.reactivarPendiente();
    if (!r || this.reactivando()) return;
    this.reactivando.set(true);
    this.finance.reactivarRecurrente(r.id, desde).subscribe({
      next: () => {
        this.reactivando.set(false);
        this.reactivarPendiente.set(null);
        this.notification.success(`"${r.descripcion}" vuelve a generar gastos`);
        this.cargar();
      },
      // El aviso lo da el interceptor; el modal queda abierto para reintentar.
      error: () => this.reactivando.set(false),
    });
  }

  /**
   * Genera los gastos del período a partir de las plantillas activas. El
   * backend es idempotente: no duplica los que ya generó.
   */
  generar() {
    this.generando.set(true);
    this.finance.generarRecurrentes().subscribe({
      next: (r: any) => {
        const n = r?.generados;
        this.notification.success(
          typeof n === 'number'
            ? n === 0
              ? 'No había gastos nuevos para generar'
              : `Se generaron ${n} gasto${n === 1 ? '' : 's'}`
            : 'Gastos generados',
        );
        this.generando.set(false);
      },
      error: () => {
        this.generando.set(false);
      },
    });
  }

  etiquetaFrecuencia(f: Frecuencia): string {
    return this.frecuencias.find((x) => x.valor === f)?.etiqueta ?? f;
  }

  etiquetaCategoria(c: string): string {
    return ETIQUETAS_CATEGORIA_GASTO[c] ?? c;
  }
}
