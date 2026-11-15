import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProveedorService } from '../services/proveedor.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AuthService } from '../../../auth/services/auth.service';

/** SEG-51: corregir y dar de baja un proveedor, los mismos puestos que el backend (PATCH y DELETE). */
export const ROLES_EDITAN_PROVEEDOR = ['admin', 'superadmin', 'mostrador'];

@Component({
  selector: 'app-proveedores-page',
  templateUrl: './proveedores-page.component.html',
  styleUrls: ['./proveedores-page.component.scss']
})
export class ProveedoresPageComponent implements OnInit {
  private fb = inject(FormBuilder);
  private proveedorService = inject(ProveedorService);
  private notification = inject(NotificationService);
  private auth = inject(AuthService);

  /**
   * SEG-51: Editar y Dar de baja sólo para admin y mostrador (crédito, CUIT y
   * días de pago mueven plata). Es UX: el backend corta igual con 403. El
   * alta y la ficha siguen para los cuatro puestos.
   */
  puedeEditar = computed(() => ROLES_EDITAN_PROVEEDOR.includes(this.auth.rol() ?? ''));

  proveedores = signal<any[]>([]);
  loading = signal(false);

  // Modal state
  showModal = signal(false);
  isEditing = signal(false);
  currentId = signal<string | null>(null);

  form: FormGroup;
  searchTerm = signal('');

  /** Spec C §2.7. El orden es el del selector. */
  readonly condicionesIva = [
    { valor: 'responsable_inscripto', etiqueta: 'Responsable inscripto' },
    { valor: 'monotributo', etiqueta: 'Monotributo' },
    { valor: 'exento', etiqueta: 'Exento' },
    { valor: 'consumidor_final', etiqueta: 'Consumidor final' },
    { valor: 'no_informada', etiqueta: 'No informada' },
  ];

  etiquetaIva(valor: string | null | undefined): string {
    return this.condicionesIva.find((c) => c.valor === valor)?.etiqueta ?? 'No informada';
  }

  /** Ficha abierta en el panel lateral (saldo, últimas OC, repuestos, lead time). */
  fichaAbierta = signal<any | null>(null);
  cargandoFicha = signal(false);

  verFicha(p: any) {
    this.cargandoFicha.set(true);
    this.proveedorService.ficha(p.id).subscribe({
      next: (f) => { this.fichaAbierta.set(f); this.cargandoFicha.set(false); },
      error: () => this.cargandoFicha.set(false),
    });
  }

  cerrarFicha() {
    this.fichaAbierta.set(null);
  }

  estadoOcVivo(o: any): boolean {
    return o?.estado !== 'recibida' && o?.estado !== 'cancelada';
  }

  constructor() {
    this.form = this.fb.group({
      nombre:      ['', [Validators.required, Validators.maxLength(100)]],
      direccion:   ['', [Validators.required]],
      telefono:    ['', [Validators.required]],
      correo:      ['', [Validators.required, Validators.email]],
      descripcion: [''],
      // Condición comercial: gobierna vencimientos de gastos y la condición
      // de pago que el armador de OC propone por defecto.
      cuit:           [''],
      condicion_iva:  ['no_informada'],
      dias_pago:      [0, [Validators.min(0)]],
      dias_entrega:   [0, [Validators.min(0)]],
      limite_credito: [null, [Validators.min(0)]],
    });
  }

  ngOnInit() {
    this.loadProveedores();
  }

  /**
   * Condición de pago derivada de dias_pago.
   * 0 o sin dato = contado; >0 = cuenta corriente a N días.
   */
  condicionPago(p: any): string {
    const dias = Number(p?.dias_pago) || 0;
    return dias > 0 ? `Cuenta corriente · ${dias} días` : 'Contado';
  }

  get filteredProveedores() {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.proveedores();
    return this.proveedores().filter(p =>
      p.nombre.toLowerCase().includes(term) ||
      p.correo?.toLowerCase().includes(term) ||
      p.telefono?.toLowerCase().includes(term)
    );
  }

  loadProveedores() {
    this.loading.set(true);
    this.proveedorService.getProveedores().subscribe({
      next: (res) => { this.proveedores.set(res); this.loading.set(false); },
      error: (err) => { console.error(err); this.loading.set(false); }
    });
  }

  openModal(proveedor?: any) {
    if (proveedor && !this.puedeEditar()) return;
    if (proveedor) {
      this.isEditing.set(true);
      this.currentId.set(proveedor.id);
      this.form.patchValue(proveedor);
    } else {
      this.isEditing.set(false);
      this.currentId.set(null);
      this.form.reset({ condicion_iva: 'no_informada' });
    }
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.form.reset();
  }

  save() {
    if (this.form.invalid) return;

    // Los opcionales vacíos no viajan: el whitelist del backend valida tipos
    // y un null explícito no aporta nada.
    const payload: any = { ...this.form.value };
    for (const campo of ['cuit', 'condicion_iva', 'dias_pago', 'dias_entrega', 'limite_credito']) {
      if (payload[campo] === null || payload[campo] === '' || payload[campo] === undefined) {
        delete payload[campo];
      }
    }

    const req$ = this.isEditing()
      ? this.proveedorService.updateProveedor(this.currentId()!, payload)
      : this.proveedorService.createProveedor(payload);

    req$.subscribe({
      next: () => {
        this.loadProveedores();
        this.closeModal();
      },
      // El aviso lo da el interceptor, con el mensaje traducido.
      error: () => {}
    });
  }

  /** Proveedor pendiente de confirmación de baja (abre el modal propio). */
  confirmandoBaja = signal<any | null>(null);

  pedirBaja(proveedor: any) {
    if (!this.puedeEditar()) return;
    this.confirmandoBaja.set(proveedor);
  }

  cancelarBaja() {
    this.confirmandoBaja.set(null);
  }

  confirmarBaja() {
    const proveedor = this.confirmandoBaja();
    if (!proveedor) return;
    this.proveedorService.deleteProveedor(proveedor.id).subscribe({
      next: () => {
        this.notification.success('Proveedor dado de baja');
        this.confirmandoBaja.set(null);
        this.loadProveedores();
      },
      error: () => {
        this.confirmandoBaja.set(null);
      }
    });
  }
}
