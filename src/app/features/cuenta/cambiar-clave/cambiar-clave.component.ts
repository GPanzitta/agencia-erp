import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { AuthService } from '../../auth/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RecargaService } from '../../../core/services/recarga.service';
import { clavesIguales, LARGO_MAXIMO_CLAVE, LARGO_MINIMO_CLAVE } from '../../../core/utils/clave.util';

/**
 * SEG-54: «Cambiar mi clave». Dos entradas:
 * - `/home/perfil`, desde el avatar del encabezado: cualquier puesto, cuando
 *   quiera.
 * - `/cambiar-clave` (`data.obligatorio`): el admin le reseteó la clave y la
 *   que tiene es la provisoria. El `authGuard` lo trae acá antes que a
 *   cualquier otra pantalla, y el backend le responde 403 al resto.
 *
 * Pide la actual y la nueva dos veces. Al cambiarla el backend cierra todas
 * las sesiones de la cuenta y le da a este equipo un token nuevo: la app se
 * recarga para reconectar todo (el socket incluido) con ese token.
 */
@Component({
  selector: 'app-cambiar-clave',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cambiar-clave.component.html',
  styleUrls: ['./cambiar-clave.component.scss'],
})
export class CambiarClaveComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private notification = inject(NotificationService);
  private recarga = inject(RecargaService);
  private route = inject(ActivatedRoute, { optional: true });

  readonly minimo = LARGO_MINIMO_CLAVE;
  readonly obligatorio: boolean = this.route?.snapshot?.data?.['obligatorio'] === true;
  readonly usuario = this.auth.currentUser;

  guardando = signal(false);
  verClaves = signal(false);

  form = this.fb.nonNullable.group(
    {
      actual: ['', [Validators.required, Validators.maxLength(255)]],
      nueva: ['', [Validators.required, Validators.minLength(LARGO_MINIMO_CLAVE), Validators.maxLength(LARGO_MAXIMO_CLAVE)]],
      repetida: ['', [Validators.required]],
    },
    { validators: clavesIguales },
  );

  guardar(): void {
    if (this.guardando()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { actual, nueva } = this.form.getRawValue();
    if (actual === nueva) {
      this.notification.error('La clave nueva tiene que ser distinta de la actual.');
      return;
    }
    this.guardando.set(true);
    this.auth.cambiarClave(actual, nueva).subscribe({
      next: () => {
        this.notification.success('Clave cambiada. Se cerraron las sesiones abiertas en otros equipos.');
        this.recarga.irDeCero('/home');
      },
      // El aviso (clave actual incorrecta, repetida, demasiados intentos) lo da el interceptor.
      error: () => this.guardando.set(false),
    });
  }

  salir(): void {
    this.auth.logout();
  }
}
