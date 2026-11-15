import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../auth/services/auth.service';
import { ClaveReseteada, Empleado, Rol } from '../../../../core/interfaces/auth.interface';
import { LARGO_MINIMO_CLAVE } from '../../../../core/utils/clave.util';
import { NotificationService } from '../../../../core/services/notification.service';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { SIN_AVISO_DE_ERROR } from '../../../../core/interceptors/sin-aviso.token';

/**
 * Alta y baja de empleados del taller.
 *
 * Reemplaza al auto-registro público que había en la pantalla de login: una
 * cuenta creada desde ahí quedaba sin taller asignado y, por cómo funciona el
 * filtro por empresa, terminaba viendo los datos de todos los comercios.
 * Ahora el alta la hace el admin, que elige el rol, y el empleado nuevo
 * hereda automáticamente el taller de quien lo dio de alta.
 */
/** CLI-16: las órdenes no entregadas que tiene asignadas un técnico. */
export function ordenesAbiertasDe(ordenes: { estado?: string; numero_orden?: string; numero?: string; tecnico?: { id?: string } | null; tecnico_id?: string | null }[], usuarioId: string): string[] {
  return ordenes
    .filter((o) => o.estado !== 'entregada' && (o.tecnico?.id ?? o.tecnico_id) === usuarioId)
    .map((o) => String(o.numero_orden ?? o.numero ?? ''))
    .filter(Boolean);
}

@Component({
  selector: 'app-empleados',
  templateUrl: './empleados.component.html',
  styleUrls: ['./empleados.component.scss'],
})
export class EmpleadosComponent implements OnInit {
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private notification = inject(NotificationService);
  private http = inject(HttpClient);

  /** CLI-16: los números de las órdenes abiertas del que se da de baja (null mientras se buscan). */
  ordenesAbiertas = signal<string[] | null>(null);

  empleados = signal<Empleado[]>([]);
  isLoading = signal(false);
  isSubmitting = signal(false);
  showModal = signal(false);

  /** Quién está operando: se usa para no dejar que se desactive a sí mismo. */
  usuarioActual = computed(() => this.auth.currentUser());

  /**
   * Un admin no puede crear superadmins — el backend lo rechaza igual, pero
   * no tiene sentido ofrecerlo en la lista.
   */
  rolesDisponibles = computed(() => {
    const base = [
      { valor: Rol.ADMIN, etiqueta: 'Dueño', ayuda: 'Ve toda la agencia: plata, vendedores y configuración' },
      { valor: Rol.MOSTRADOR, etiqueta: 'Vendedor', ayuda: 'Carga unidades, reserva y cobra. No ve costos ni márgenes' },
    ];
    if (this.auth.rol() === Rol.SUPERADMIN) {
      return [{ valor: Rol.SUPERADMIN, etiqueta: 'Superadmin', ayuda: 'Acceso total al sistema' }, ...base];
    }
    return base;
  });

  empleadoForm: FormGroup;

  constructor() {
    this.empleadoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
      // SEG-54: 10 como mínimo, igual que el backend.
      password: ['', [Validators.required, Validators.minLength(LARGO_MINIMO_CLAVE), Validators.maxLength(255)]],
      telefono: ['', [Validators.maxLength(20)]],
      rol: [Rol.MOSTRADOR, Validators.required],
    });
  }

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.isLoading.set(true);
    this.auth.listarEmpleados().subscribe({
      next: (data) => {
        this.empleados.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  abrirModal() {
    this.empleadoForm.reset({ rol: Rol.MOSTRADOR });
    this.showModal.set(true);
  }

  cerrarModal() {
    this.showModal.set(false);
  }

  guardar() {
    if (this.empleadoForm.invalid) {
      this.empleadoForm.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.auth.crearEmpleado(this.empleadoForm.value).subscribe({
      next: (nuevo) => {
        this.notification.success(`${nuevo.nombre} ya puede entrar al sistema`, 'Empleado creado');
        this.cargar();
        this.cerrarModal();
        this.isSubmitting.set(false);
      },
      error: () => {
        // El motivo (email repetido, rol inválido, etc.) lo explica el toast
        // del interceptor con el mensaje que manda el backend.
        this.isSubmitting.set(false);
      },
    });
  }

  /**
   * Cambio de rol en línea. El backend revoca las sesiones del empleado:
   * si estaba logueado, su próxima acción le va a pedir entrar de nuevo
   * — con los permisos nuevos.
   */
  cambiarRol(empleado: Empleado, rol: string) {
    if (rol === empleado.rol) return;
    this.auth.cambiarRolEmpleado(empleado.id, rol).subscribe({
      next: () => {
        this.notification.success(
          `${empleado.nombre} ahora es ${this.etiquetaRol(rol as Rol)}. Su sesión fue cerrada.`,
        );
        this.cargar();
      },
      error: () => {
        this.cargar(); // repone el select al valor real
      },
    });
  }

  /** Empleado pendiente de confirmación de cambio de estado (abre el modal propio). */
  confirmandoEstado = signal<Empleado | null>(null);

  pedirCambioEstado(empleado: Empleado) {
    this.confirmandoEstado.set(empleado);
    this.ordenesAbiertas.set(null);
    if (!empleado.activo) return;
  }

  cancelarCambioEstado() {
    this.confirmandoEstado.set(null);
    this.ordenesAbiertas.set(null);
  }

  confirmarCambioEstado() {
    const empleado = this.confirmandoEstado();
    if (!empleado) return;
    this.confirmandoEstado.set(null);
    const activar = !empleado.activo;

    this.auth.cambiarEstadoEmpleado(empleado.id, activar).subscribe({
      next: () => {
        this.notification.success(
          activar
            ? `${empleado.nombre} vuelve a tener acceso`
            : `${empleado.nombre} ya no puede entrar al sistema`,
        );
        this.cargar();
      },
      // El aviso lo da el interceptor, con el mensaje traducido.
      error: () => {},
    });
  }

  // ─── SEG-54: resetear la clave de un empleado ─────────────────────────

  readonly minimoClave = LARGO_MINIMO_CLAVE;
  /** Empleado pendiente de confirmar el reseteo. */
  confirmandoReseteo = signal<Empleado | null>(null);
  /** La provisoria recién generada: se muestra UNA vez y se olvida al cerrar. */
  claveProvisoria = signal<ClaveReseteada | null>(null);
  reseteando = signal(false);

  pedirReseteo(empleado: Empleado) {
    if (this.sinAcciones(empleado) || !empleado.activo) return;
    this.confirmandoReseteo.set(empleado);
  }

  cancelarReseteo() {
    this.confirmandoReseteo.set(null);
  }

  confirmarReseteo() {
    const empleado = this.confirmandoReseteo();
    if (!empleado || this.reseteando()) return;
    this.reseteando.set(true);
    this.auth.resetearClaveEmpleado(empleado.id).subscribe({
      next: (r) => {
        this.reseteando.set(false);
        this.confirmandoReseteo.set(null);
        this.claveProvisoria.set(r);
        this.cargar();
      },
      // El aviso lo da el interceptor.
      error: () => this.reseteando.set(false),
    });
  }

  copiarProvisoria() {
    const clave = this.claveProvisoria()?.clave_provisoria;
    if (!clave) return;
    navigator.clipboard?.writeText(clave).then(
      () => this.notification.success('Clave provisoria copiada'),
      () => {},
    );
  }

  /** Cierra el aviso y la provisoria deja de estar en memoria: no se vuelve a ver. */
  cerrarProvisoria() {
    this.claveProvisoria.set(null);
  }

  esUsuarioActual(empleado: Empleado): boolean {
    return empleado.id === this.usuarioActual()?.id;
  }

  /**
   * CLI-18: el superadmin de la plataforma aparece en la lista porque tiene la
   * empresa del taller. Para el admin del taller es «Soporte de la plataforma»
   * y sin acciones: cambiarle el rol o darlo de baja termina en 403.
   */
  esSoporte(empleado: Empleado): boolean {
    return empleado.rol === Rol.SUPERADMIN && this.auth.rol() !== Rol.SUPERADMIN;
  }

  /** Sin select ni botones: la sesión propia y el soporte de la plataforma. */
  sinAcciones(empleado: Empleado): boolean {
    return this.esUsuarioActual(empleado) || this.esSoporte(empleado);
  }

  etiquetaRol(rol?: Rol | null): string {
    return this.rolesDisponibles().find((r) => r.valor === rol)?.etiqueta ?? rol ?? '—';
  }

  /** Ayuda del rol elegido en el alta: se muestra debajo del select. */
  get ayudaRolSeleccionado(): string {
    const rol = this.empleadoForm.get('rol')?.value;
    return this.rolesDisponibles().find((r) => r.valor === rol)?.ayuda ?? '';
  }
}
