import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FinanceService, LineaPresupuesto } from '../services/finance.service';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  CATEGORIAS_GASTO_VISIBLES, CategoriaGasto, ETIQUETAS_CATEGORIA_GASTO,
} from '../../../../core/interfaces/gastos.interface';

/**
 * Presupuesto mensual por categoría y su ejecución real.
 *
 * El backend calculaba todo esto (`GET /finance/presupuestos/ejecucion`):
 * asignado vs. gastado, porcentaje de consumo y un estado ok/en_alerta/
 * excedido según el umbral de cada línea. No existía pantalla — el dueño no
 * tenía forma de fijarse un techo de gasto por rubro ni de ver si lo estaba
 * pasando.
 */
@Component({
  selector: 'app-presupuestos',
  templateUrl: './presupuestos.component.html',
  styleUrls: ['./presupuestos.component.scss'],
})
export class PresupuestosComponent implements OnInit {
  private finance = inject(FinanceService);
  private fb = inject(FormBuilder);
  private notification = inject(NotificationService);

  /** Sin 'packaging': el valor solo queda para datos históricos. */
  categorias = CATEGORIAS_GASTO_VISIBLES;

  lineas = signal<LineaPresupuesto[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);
  showModal = signal(false);
  showCopiarModal = signal(false);

  /** Mes en curso en formato YYYY-MM, que es lo que espera el input month. */
  periodo = signal(new Date().toISOString().slice(0, 7));
  periodoOrigen = '';

  form: FormGroup;

  totalAsignado = computed(() => this.lineas().reduce((s, l) => s + Number(l.asignado), 0));
  totalGastado = computed(() => this.lineas().reduce((s, l) => s + Number(l.gastado), 0));
  hayExcedidos = computed(() => this.lineas().some((l) => l.estado === 'excedido'));

  constructor() {
    this.form = this.fb.group({
      categoria: [CategoriaGasto.INGREDIENTES, Validators.required],
      monto_asignado: [0, [Validators.required, Validators.min(0)]],
      umbral_alerta: [80, [Validators.min(1), Validators.max(100)]],
      notas: [''],
    });
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar() {
    this.isLoading.set(true);
    // El backend normaliza cualquier fecha del mes al día 1.
    this.finance.ejecucionPresupuesto(`${this.periodo()}-01`).subscribe({
      next: (data) => {
        this.lineas.set(data.lineas ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  cambiarPeriodo(valor: string) {
    if (!valor) return;
    this.periodo.set(valor);
    this.cargar();
  }

  abrirModal() {
    this.form.reset({
      categoria: CategoriaGasto.INGREDIENTES,
      monto_asignado: 0,
      umbral_alerta: 80,
      notas: '',
    });
    this.showModal.set(true);
  }

  cerrarModal() {
    this.showModal.set(false);
  }

  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    this.finance
      .crearPresupuesto({ ...this.form.value, periodo: `${this.periodo()}-01` })
      .subscribe({
        next: () => {
          this.notification.success('Presupuesto guardado');
          this.isSaving.set(false);
          this.cerrarModal();
          this.cargar();
        },
        error: () => {
          this.isSaving.set(false);
        },
      });
  }

  abrirCopiar() {
    // Por defecto se ofrece copiar desde el mes anterior, que es el caso real.
    const [y, m] = this.periodo().split('-').map(Number);
    const anterior = new Date(y, m - 2, 1);
    this.periodoOrigen = anterior.toISOString().slice(0, 7);
    this.showCopiarModal.set(true);
  }

  confirmarCopiar() {
    if (!this.periodoOrigen) return;
    this.isSaving.set(true);
    this.finance.copiarPresupuesto(`${this.periodoOrigen}-01`, `${this.periodo()}-01`).subscribe({
      next: () => {
        this.notification.success('Presupuesto copiado');
        this.isSaving.set(false);
        this.showCopiarModal.set(false);
        this.cargar();
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }

  colorEstado(estado: string): string {
    return {
      ok: 'var(--gm-success)',
      en_alerta: 'var(--alerta)',
      excedido: 'var(--gm-error)',
    }[estado] ?? 'var(--gm-muted)';
  }

  etiquetaCategoria(c: string): string {
    return ETIQUETAS_CATEGORIA_GASTO[c] ?? c;
  }

  etiquetaEstado(estado: string): string {
    return { ok: 'En rango', en_alerta: 'Cerca del límite', excedido: 'Excedido' }[estado] ?? estado;
  }

  /** La barra se corta al 100% para que un excedido no se salga de la caja. */
  anchoBarra(consumo: number): number {
    return Math.min(100, Math.max(0, consumo));
  }
}
