import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, FalloDeLogin } from '../services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { interpretarError } from '../../../core/errores/mensajes.util';
import { INICIALES_PRODUCTO, NOMBRE_PRODUCTO } from '../../../core/marca-producto';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  readonly marca = NOMBRE_PRODUCTO;
  readonly iniciales = INICIALES_PRODUCTO;
  loginForm: FormGroup;
  mostrarAyuda = signal(false);
  enviando = signal(false);
  /** Clave correcta y cuenta sin confirmar: se ofrece reenviar el correo. */
  sinConfirmar = signal<string | null>(null);

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private notification = inject(NotificationService);

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  reenviarConfirmacion(): void {
    const email = this.sinConfirmar();
    if (!email) return;
    this.authService.reenviarConfirmacion(email).subscribe({
      next: () => {
        this.sinConfirmar.set(null);
        this.notification.success('Te mandamos otro correo para confirmar la cuenta');
      },
    });
  }

  onSubmit() {
    if (!this.loginForm.valid || this.enviando()) return;
    this.enviando.set(true);
    this.sinConfirmar.set(null);
    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        this.enviando.set(false);
        this.notification.success(`Bienvenido a ${NOMBRE_PRODUCTO}`);
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.enviando.set(false);
        if ((err as any)?.error?.code === 'CUENTA_SIN_CONFIRMAR') this.sinConfirmar.set(this.loginForm.value.email);
        if (!(err instanceof FalloDeLogin)) return; // el interceptor ya avisó
        if (err.tipo === 'sesion_rechazada') {
          const codigo = (err.original as any)?.error?.code;
          // CLI-04: el backend aceptó la clave pero no deja usar la sesión.
          this.notification.error(
            codigo === 'USUARIO_DADO_DE_BAJA'
              ? 'Tu usuario está dado de baja. Hablá con el encargado.'
              : 'El usuario y la clave están bien, pero el sistema no te deja entrar: puede que estés dado de baja o que te hayan cambiado el acceso. Hablá con el encargado.',
            'No se pudo abrir la sesión',
          );
          return;
        }
        const m = interpretarError(err.original);
        this.notification.error(m.detalle, m.titulo);
      },
    });
  }
}
