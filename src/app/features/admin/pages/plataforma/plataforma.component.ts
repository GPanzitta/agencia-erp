import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { fechaAbono } from '../../../../core/services/abono.service';
import { AdminService, PlanDeTaller, TallerDePlataforma } from '../../services/admin.service';

const DIAS_PARA_MARCAR = 30;
const DIA_MS = 86400000;

/** Quién usa el sistema y quién está por irse (spec 2026-10-28 §7). */
@Component({
  selector: 'app-plataforma',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plataforma.component.html',
  styleUrls: ['./plataforma.component.scss'],
})
export class PlataformaComponent implements OnInit {
  private admin = inject(AdminService);

  readonly fecha = fechaAbono;
  readonly nombresPlan: Record<PlanDeTaller, string> = { gratis: 'Gratis', pago: 'Pago', interno: 'Interno' };
  readonly nombresEstado = { al_dia: 'Al día', vencida: 'Vencida', solo_lectura: 'Sólo lectura' };

  private lista = signal<TallerDePlataforma[]>([]);
  talleres = computed(() =>
    [...this.lista()].sort((a, b) => new Date(a.ultima_actividad).getTime() - new Date(b.ultima_actividad).getTime()),
  );

  editando = signal<string | null>(null);
  planElegido = signal<PlanDeTaller>('gratis');
  fechaElegida = signal('');
  aviso = signal('');

  precio = signal(0);
  tope = signal(0);
  gracia = signal(0);
  guardado = signal(false);

  ngOnInit(): void {
    this.cargar();
    this.admin.configPlataforma().subscribe((c) => {
      this.precio.set(c.precio_mensual);
      this.tope.set(c.tope_ordenes_gratis);
      this.gracia.set(c.dias_gracia);
    });
  }

  private cargar(): void {
    this.admin.talleresPlataforma().subscribe((lista) => this.lista.set(lista));
  }

  inactivo(t: TallerDePlataforma): boolean {
    return Date.now() - new Date(t.ultima_actividad).getTime() >= DIAS_PARA_MARCAR * DIA_MS;
  }

  editar(t: TallerDePlataforma): void {
    this.editando.set(t.id);
    this.planElegido.set(t.plan);
    this.fechaElegida.set(t.vence_en ? t.vence_en.slice(0, 10) : '');
    this.aviso.set('');
  }

  guardarPlan(): void {
    const id = this.editando();
    if (!id) return;
    const plan = this.planElegido();
    if (plan === 'pago' && !this.fechaElegida()) {
      this.aviso.set('Elegí la fecha hasta la que está pagado.');
      return;
    }
    const cambios = plan === 'pago' ? { plan, vence_en: `${this.fechaElegida()}T23:59:59-03:00` } : { plan };
    this.admin.cambiarPlanTaller(id, cambios).subscribe({
      next: () => {
        this.editando.set(null);
        this.cargar();
      },
      // El motivo lo avisa el interceptor; la fila queda abierta para corregir.
      error: () => undefined,
    });
  }

  guardarConfig(): void {
    this.guardado.set(false);
    this.admin
      .guardarConfigPlataforma({ precio_mensual: this.precio(), tope_ordenes_gratis: this.tope(), dias_gracia: this.gracia() })
      .subscribe({ next: () => this.guardado.set(true), error: () => undefined });
  }
}
