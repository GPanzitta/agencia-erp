import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AccionAuditada, AuditoriaService, RegistroAuditoria, ResumenAccion } from './auditoria.service';
import { NotificationService } from '../../../core/services/notification.service';

/**
 * Registro de acciones sensibles del taller: la plata (caja, gastos, pagos),
 * los puntos de no retorno del ciclo de la orden, la agenda, el pañol y las
 * compras. El filtro ofrece todas las acciones del enum del backend (CLI-12).
 */
@Component({
  selector: 'app-auditoria',
  templateUrl: './auditoria.component.html',
  styleUrls: ['./auditoria.component.scss'],
})
export class AuditoriaComponent implements OnInit {
  private auditoria = inject(AuditoriaService);
  private notification = inject(NotificationService);

  acciones = Object.values(AccionAuditada);

  registros = signal<RegistroAuditoria[]>([]);
  resumen = signal<ResumenAccion[]>([]);
  total = signal(0);
  pagina = signal(1);
  porPagina = 50;
  isLoading = signal(false);

  filtros = signal<{ accion: string; desde: string; hasta: string }>({
    accion: '',
    desde: '',
    hasta: '',
  });

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / this.porPagina)));
  hayFiltros = computed(() => {
    const f = this.filtros();
    return !!(f.accion || f.desde || f.hasta);
  });

  /**
   * Etiquetas legibles. El enum del backend usa snake_case, que sirve para
   * filtrar pero no para leer en una tabla.
   */
  private etiquetas: Record<string, string> = {
    caja_abierta: 'Caja abierta',
    caja_cerrada: 'Caja cerrada',
    movimiento_caja: 'Movimiento de caja',
    gasto_aprobado: 'Gasto aprobado',
    gasto_rechazado: 'Gasto rechazado',
    gasto_anulado: 'Gasto anulado',
    pago_anulado: 'Pago anulado',
    presupuesto_aprobado: 'Presupuesto aprobado',
    presupuesto_rechazado: 'Presupuesto rechazado',
    orden_entregada: 'Orden entregada',
    orden_editada: 'Orden editada',
    bitacora_editada: 'Bitácora editada',
    plantilla_editada: 'Mensaje editado',
    turno_agendado: 'Turno agendado',
    turno_reprogramado: 'Turno reprogramado',
    turno_cancelado: 'Turno cancelado',
    stock_ajustado: 'Stock ajustado',
    repuesto_desactivado: 'Repuesto desactivado',
    oc_editada: 'OC editada',
    oc_cerrada_con_faltante: 'OC cerrada con faltante',
    devolucion_proveedor: 'Devolución al proveedor',
    repuesto_fusionado: 'Repuestos fusionados',
    precio_modificado: 'Precio modificado',
    // Las que propone CLI-12 para la tanda 2 del backend: si llegan, ya se leen.
    usuario_creado: 'Usuario creado',
    usuario_rol_cambiado: 'Rol de usuario cambiado',
    usuario_estado_cambiado: 'Usuario dado de baja o reactivado',
    empresa_configuracion_editada: 'Configuración de la empresa editada',
    cliente_dado_de_baja: 'Cliente dado de baja',
    venta_devuelta: 'Venta devuelta',
    venta_cancelada: 'Venta cancelada',
    // Etiquetas de registros históricos del sistema madre (ya no se emiten):
    venta_anulada: 'Venta anulada',
    venta_rechazada: 'Venta rechazada',
  };

  /** Las que conviene mirar primero ante un descuadre o un reclamo. */
  private sensibles = new Set([
    'gasto_anulado',
    'pago_anulado',
    'movimiento_caja',
    'orden_entregada',
    'stock_ajustado',
    'precio_modificado',
    'devolucion_proveedor',
    'usuario_rol_cambiado',
    'empresa_configuracion_editada',
  ]);

  ngOnInit(): void {
    this.cargar();
    this.auditoria.resumen(30).subscribe({
      next: (r) => this.resumen.set(r),
      error: () => this.resumen.set([]),
    });
  }

  cargar() {
    this.isLoading.set(true);
    this.auditoria
      .consultar({ ...this.filtros(), pagina: this.pagina(), porPagina: this.porPagina })
      .subscribe({
        next: (r) => {
          this.registros.set(r.items ?? []);
          this.total.set(r.total ?? 0);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  cambiarFiltro(campo: string, valor: string) {
    this.filtros.update((f) => ({ ...f, [campo]: valor }));
    this.pagina.set(1);
    this.cargar();
  }

  limpiarFiltros() {
    this.filtros.set({ accion: '', desde: '', hasta: '' });
    this.pagina.set(1);
    this.cargar();
  }

  irA(p: number) {
    if (p < 1 || p > this.totalPaginas()) return;
    this.pagina.set(p);
    this.cargar();
  }

  /** Una acción que el ERP todavía no conoce se lee igual: «algo_nuevo» → «Algo nuevo». */
  etiqueta(accion: string): string {
    const conocida = this.etiquetas[accion];
    if (conocida) return conocida;
    const texto = String(accion ?? '').replace(/_/g, ' ').trim();
    return texto ? texto[0].toUpperCase() + texto.slice(1) : '';
  }

  esSensible(accion: string): boolean {
    return this.sensibles.has(accion);
  }

  /** El `detalle` es jsonb libre: se muestra como pares legibles. */
  detalleLegible(detalle?: Record<string, unknown> | null): string {
    if (!detalle) return '';
    return Object.entries(detalle)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${this.valorLegible(v)}`)
      .join(' · ');
  }

  /**
   * Los campos que el backend guardaba antes eran todos escalares, así que
   * interpolarlos alcanzaba. `orden_editada` y `bitacora_editada` guardan TODO
   * lo suyo dentro de `cambios`, que es una lista de objetos: sin este caso la
   * única pantalla que muestra el log decía `cambios: [object Object]`, y el
   * texto anterior de un comentario editado no se podía leer en ningún lado.
   *
   * La forma es la misma que arma `resumenDeCambios` en el backend, para que
   * la nota de la bitácora y la fila de auditoría se lean igual.
   */
  private valorLegible(v: unknown): string {
    const esCambio = (c: unknown) => !!c && typeof c === 'object' && ('antes' in c || 'despues' in c);
    if (Array.isArray(v) && v.length && v.every(esCambio)) {
      return v.map((c: any) => `${c.rotulo ?? c.campo}: ${c.antes ?? '—'} → ${c.despues ?? '—'}`).join(' · ');
    }
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return `${v}`;
  }
}
