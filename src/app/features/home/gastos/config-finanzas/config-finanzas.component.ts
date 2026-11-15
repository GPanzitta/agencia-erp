import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FinanceService } from '../services/finance.service';
import { NotificationService } from '../../../../core/services/notification.service';

/**
 * Parámetros financieros del local.
 *
 * El backend tenía la entidad `finance_settings` con estos tres valores desde
 * el principio, con un comentario explícito de por qué existe: "el umbral de
 * aprobación no puede ser una constante en el código, lo que es un gasto
 * grande depende del negocio". Pero no había forma de cambiarlo desde el ERP,
 * así que en la práctica seguía siendo una constante.
 */
@Component({
  selector: 'app-config-finanzas',
  templateUrl: './config-finanzas.component.html',
  styleUrls: ['./config-finanzas.component.scss'],
})
export class ConfigFinanzasComponent implements OnInit {
  private finance = inject(FinanceService);
  private fb = inject(FormBuilder);
  private notification = inject(NotificationService);

  isLoading = signal(true);
  isSaving = signal(false);
  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      umbral_aprobacion: [0, [Validators.required, Validators.min(0)]],
      alerta_saldo_minimo: [0, [Validators.required, Validators.min(0)]],
      dias_aviso_vencimiento: [3, [Validators.required, Validators.min(0), Validators.max(90)]],
    });
  }

  ngOnInit(): void {
    this.finance.verSettings().subscribe({
      next: (s) => {
        this.form.patchValue({
          umbral_aprobacion: Number(s.umbral_aprobacion),
          alerta_saldo_minimo: Number(s.alerta_saldo_minimo),
          dias_aviso_vencimiento: s.dias_aviso_vencimiento,
        });
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    this.finance.actualizarSettings(this.form.value).subscribe({
      next: () => {
        this.notification.success('Configuración guardada');
        this.isSaving.set(false);
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }
}
