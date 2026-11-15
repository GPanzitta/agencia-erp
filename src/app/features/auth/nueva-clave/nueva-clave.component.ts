import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { INICIALES_PRODUCTO, NOMBRE_PRODUCTO } from '../../../core/marca-producto';
import { LARGO_MINIMO_CLAVE } from '../../../core/utils/clave.util';
import { AuthService } from '../services/auth.service';

/** Adonde llega el link del correo de «me olvidé la clave». */
@Component({
  selector: 'app-nueva-clave',
  standalone: false,
  templateUrl: './nueva-clave.component.html',
  styleUrls: ['../login/login.component.scss', '../registro/registro.component.scss'],
})
export class NuevaClaveComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);

  readonly marca = NOMBRE_PRODUCTO;
  readonly iniciales = INICIALES_PRODUCTO;
  readonly largoMinimo = LARGO_MINIMO_CLAVE;
  estado = signal<'pidiendo' | 'ok' | 'invalido'>('pidiendo');
  distintas = signal(false);
  form = new FormGroup({
    clave: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(LARGO_MINIMO_CLAVE), Validators.maxLength(72)] }),
    repetir: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  private token: string | null = null;

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) this.estado.set('invalido');
  }

  enviar(): void {
    const { clave, repetir } = this.form.getRawValue();
    this.distintas.set(clave !== repetir);
    if (this.form.invalid || this.distintas() || !this.token) {
      this.form.markAllAsTouched();
      return;
    }
    this.auth.cambiarClavePorCorreo(this.token, clave).subscribe({
      next: () => this.estado.set('ok'),
      error: () => this.estado.set('invalido'),
    });
  }
}
