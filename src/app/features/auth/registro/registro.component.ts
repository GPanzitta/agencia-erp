import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { INICIALES_PRODUCTO, NOMBRE_PRODUCTO } from '../../../core/marca-producto';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../services/auth.service';
import { LARGO_MINIMO_CLAVE } from '../../../core/utils/clave.util';

/** Informativos: los valores por defecto no cambian (spec 2026-10-28 §13.7). */
const RUBROS = ['Usados', '0 km', 'Pickups y utilitarios', 'Motos', 'Consignación'];

/** Un taller nuevo se da de alta solo (spec 2026-10-28 §6). */
@Component({
  selector: 'app-registro',
  standalone: false,
  templateUrl: './registro.component.html',
  styleUrls: ['../login/login.component.scss', './registro.component.scss'],
})
export class RegistroComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private notification = inject(NotificationService);

  readonly marca = NOMBRE_PRODUCTO;
  readonly iniciales = INICIALES_PRODUCTO;
  readonly rubros = RUBROS;
  readonly minimo = LARGO_MINIMO_CLAVE;

  form = this.fb.group({
    taller: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
    telefono: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(40)]],
    clave: ['', [Validators.required, Validators.minLength(LARGO_MINIMO_CLAVE), Validators.maxLength(72)]],
    sitio_web: [''],
  });
  rubrosElegidos = signal<string[]>([]);
  enviando = signal(false);
  /** Adónde se mandó (o se intentó mandar) la confirmación; con esto se cambia de pantalla. */
  enviadoA = signal<string | null>(null);
  correoFallo = signal(false);

  alternarRubro(rubro: string): void {
    this.rubrosElegidos.update((r) => (r.includes(rubro) ? r.filter((x) => x !== rubro) : [...r, rubro]));
  }

  enviar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const email = (v.email ?? '').trim();
    this.enviando.set(true);
    this.auth.registrarTaller({
      taller: (v.taller ?? '').trim(),
      nombre: (v.nombre ?? '').trim(),
      email,
      telefono: (v.telefono ?? '').trim(),
      clave: v.clave ?? '',
      rubros: this.rubrosElegidos(),
      ...(v.sitio_web ? { sitio_web: v.sitio_web } : {}),
    }).subscribe({
      next: ({ enviado }) => {
        this.enviando.set(false);
        this.correoFallo.set(!enviado);
        this.enviadoA.set(email);
        this.form.patchValue({ clave: '' });
      },
      error: () => this.enviando.set(false), // el interceptor ya avisó
    });
  }

  reenviar(): void {
    const email = this.enviadoA();
    if (!email) return;
    this.auth.reenviarConfirmacion(email).subscribe({
      next: () => {
        this.correoFallo.set(false);
        this.notification.success('Te mandamos otro correo');
      },
    });
  }
}
