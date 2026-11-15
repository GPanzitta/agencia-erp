import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { INICIALES_PRODUCTO, NOMBRE_PRODUCTO } from '../../../core/marca-producto';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../services/auth.service';

/** Adonde llega el link del correo de confirmación. */
@Component({
  selector: 'app-confirmar',
  standalone: false,
  templateUrl: './confirmar.component.html',
  styleUrls: ['../login/login.component.scss', '../registro/registro.component.scss'],
})
export class ConfirmarComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private notification = inject(NotificationService);

  readonly marca = NOMBRE_PRODUCTO;
  readonly iniciales = INICIALES_PRODUCTO;
  estado = signal<'confirmando' | 'ok' | 'invalida'>('confirmando');
  email = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] });

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.estado.set('invalida');
      return;
    }
    this.auth.confirmarCuenta(token).subscribe({
      next: () => this.estado.set('ok'),
      error: () => this.estado.set('invalida'),
    });
  }

  reenviar(): void {
    if (this.email.invalid) {
      this.email.markAsTouched();
      return;
    }
    this.auth.reenviarConfirmacion(this.email.value.trim()).subscribe({
      next: () => this.notification.success('Si hay una cuenta sin confirmar con ese correo, te mandamos otro link'),
    });
  }
}
