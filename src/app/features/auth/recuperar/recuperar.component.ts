import { Component, inject, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { INICIALES_PRODUCTO, NOMBRE_PRODUCTO } from '../../../core/marca-producto';
import { AuthService } from '../services/auth.service';

/** «Me olvidé la clave»: en un taller que se dio de alta solo, no hay a quién pedírsela. */
@Component({
  selector: 'app-recuperar',
  standalone: false,
  templateUrl: './recuperar.component.html',
  styleUrls: ['../login/login.component.scss', '../registro/registro.component.scss'],
})
export class RecuperarComponent {
  private auth = inject(AuthService);

  readonly marca = NOMBRE_PRODUCTO;
  readonly iniciales = INICIALES_PRODUCTO;
  enviado = signal(false);
  email = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] });

  enviar(): void {
    const correo = this.email.value.trim();
    this.email.setValue(correo);
    if (this.email.invalid) {
      this.email.markAsTouched();
      return;
    }
    this.auth.pedirRecuperacion(correo).subscribe({ next: () => this.enviado.set(true) });
  }
}
