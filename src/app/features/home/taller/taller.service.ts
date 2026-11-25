import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Moneda } from '../autos/autos.service';

export type CategoriaRepuestoAuto =
  | 'filtros_fluidos'
  | 'frenos_suspension'
  | 'distribucion_motor'
  | 'neumaticos_llantas'
  | 'baterias_electricidad'
  | 'estetica_detailing'
  | 'chapa_pintura'
  | 'accesorios_seguridad'
  | 'otro';

export type EstadoOrdenAlistaje =
  | 'recibida'
  | 'diagnostico'
  | 'en_trabajo'
  | 'control_calidad'
  | 'lista'
  | 'anulada';

export type PrioridadOrdenAlistaje = 'normal' | 'alta' | 'urgente_entrega';

export interface FotoRepuestoAuto {
  id: string;
  url: string;
  url_miniatura: string;
  fecha: string;
}

export interface RepuestoAuto {
  id: string;
  codigo: string | null;
  nombre: string;
  categoria: CategoriaRepuestoAuto;
  marca: string | null;
  compatibilidad: string | null;
  ubicacion: string | null;
  unidad_medida: string;
  stock: number;
  stock_minimo: number;
  bajo_stock: boolean;
  moneda: Moneda;
  costo: number;
  proveedor: string | null;
  portada: string | null;
  fotos: FotoRepuestoAuto[];
  updated_at: string;
}

export interface ItemChecklistAlistaje {
  clave: string;
  grupo: 'Mecanica' | 'Seguridad' | 'Estetica' | 'Equipamiento';
  nombre: string;
  estado: 'pendiente' | 'ok' | 'reparar';
  observacion: string | null;
}

export interface FotoOrdenAlistaje {
  id: string;
  url: string;
  url_miniatura: string;
  etapa: string;
  nota: string | null;
  autor: string | null;
  fecha: string;
}

export interface RenglonRepuestoOrden {
  id: string;
  repuesto_id: string | null;
  codigo: string | null;
  nombre: string;
  portada: string | null;
  stock_actual: number | null;
  cantidad: number;
  moneda: Moneda;
  costo_unitario: number;
  subtotal: number;
  ingresado: boolean;
  consumido: boolean;
  compra_id: string | null;
  compra_numero: string | null;
  compra_estado: 'pendiente' | 'recibida' | 'cancelada' | null;
}

export interface ItemOrdenCompraTaller {
  renglon_orden_id: string | null;
  repuesto_id: string | null;
  codigo: string | null;
  nombre: string;
  portada?: string | null;
  cantidad: number;
  costo_unitario: number;
  subtotal: number;
}

export interface OrdenCompraTaller {
  id: string;
  numero: string;
  estado: 'pendiente' | 'recibida' | 'cancelada';
  orden_id: string | null;
  orden_numero: string | null;
  orden_vehiculo: string | null;
  proveedor: string;
  comprobante: string | null;
  moneda: Moneda;
  total: number;
  items: ItemOrdenCompraTaller[];
  notas: string | null;
  created_at: string;
  recibida_at: string | null;
}

export interface ClienteExternoTaller {
  nombre: string;
  telefono: string | null;
  documento: string | null;
  email: string | null;
}

export interface OrdenAlistaje {
  id: string;
  numero: string;
  tipo_origen: 'stock' | 'cliente';
  estado: EstadoOrdenAlistaje;
  prioridad: PrioridadOrdenAlistaje;
  sector: string;
  responsable: string | null;
  cliente: ClienteExternoTaller | null;
  unidad: {
    id: string | null;
    numero: string;
    titulo: string;
    dominio: string | null;
    anio: number;
    km: number;
    color?: string | null;
    moneda: Moneda;
    estado: string;
  };
  falla_motivo: string;
  diagnostico: string | null;
  trabajo_realizado: string | null;
  km_ingreso: number | null;
  moneda: Moneda;
  costo_mano_obra: number;
  tipo_cambio: number | null;
  total_repuestos: number;
  total_orden: number;
  gasto_imputado: boolean;
  checklist: ItemChecklistAlistaje[];
  checklist_progreso: { total: number; ok: number; reparar: number; pendiente: number };
  repuestos: RenglonRepuestoOrden[];
  compras: OrdenCompraTaller[];
  fotos: FotoOrdenAlistaje[];
  bitacora: { fecha: string; texto: string; autor: string | null }[];
  created_at: string;
  finalizada_at: string | null;
}

export const CATEGORIAS_REPUESTO: [CategoriaRepuestoAuto, string][] = [
  ['filtros_fluidos', 'Filtros y fluidos (aceite, aire, refrigerante)'],
  ['frenos_suspension', 'Frenos, tren delantero y suspensión'],
  ['distribucion_motor', 'Distribución, correas y motor'],
  ['neumaticos_llantas', 'Neumáticos y llantas'],
  ['baterias_electricidad', 'Baterías, lámparas y electricidad'],
  ['estetica_detailing', 'Estética, pulido y detailing'],
  ['chapa_pintura', 'Chapa, pintura y parabrisas'],
  ['accesorios_seguridad', 'Accesorios, matafuegos y balizas'],
  ['otro', 'Otros insumos'],
];

export const ROTULO_CATEGORIA_REPUESTO: Record<CategoriaRepuestoAuto, string> = Object.fromEntries(CATEGORIAS_REPUESTO) as Record<CategoriaRepuestoAuto, string>;

export const ETAPAS_ORDEN_ALISTAJE: { valor: EstadoOrdenAlistaje; rotulo: string }[] = [
  { valor: 'recibida', rotulo: 'Recibida' },
  { valor: 'diagnostico', rotulo: 'En diagnóstico' },
  { valor: 'en_trabajo', rotulo: 'En preparación / taller' },
  { valor: 'control_calidad', rotulo: 'Control de calidad (QA)' },
  { valor: 'lista', rotulo: 'Lista para salón' },
  { valor: 'anulada', rotulo: 'Anulada' },
];

export const ROTULO_ESTADO_ORDEN: Record<EstadoOrdenAlistaje, string> = {
  recibida: 'Recibida',
  diagnostico: 'En diagnóstico',
  en_trabajo: 'En preparación / taller',
  control_calidad: 'Control de calidad (QA)',
  lista: 'Lista para salón',
  anulada: 'Anulada',
};

export const SECTORES_TALLER = [
  'Service y alistaje de ingreso',
  'Mecánica y distribución',
  'Frenos y tren delantero',
  'Chapa y pintura',
  'Estética, tapizados y detailing',
  'Neumáticos y alineación',
  'Electricidad y batería',
  'Revisión pre-entrega (OV)',
];

type Cuerpo = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class TallerService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/taller`;

  listarRepuestos(q?: string, categoria?: string, bajoStock?: boolean): Observable<RepuestoAuto[]> {
    return this.http.get<RepuestoAuto[]>(`${this.base}/repuestos`, {
      params: {
        ...(q ? { q } : {}),
        ...(categoria ? { categoria } : {}),
        ...(bajoStock ? { bajo_stock: '1' } : {}),
      },
    });
  }

  crearRepuesto(datos: Cuerpo): Observable<RepuestoAuto> {
    return this.http.post<RepuestoAuto>(`${this.base}/repuestos`, datos);
  }

  editarRepuesto(id: string, datos: Cuerpo): Observable<RepuestoAuto> {
    return this.http.patch<RepuestoAuto>(`${this.base}/repuestos/${id}`, datos);
  }

  ajustarStock(id: string, delta: number): Observable<RepuestoAuto> {
    return this.http.post<RepuestoAuto>(`${this.base}/repuestos/${id}/stock`, { delta });
  }

  borrarRepuesto(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.base}/repuestos/${id}`);
  }

  subirFotosRepuesto(id: string, archivos: File[]): Observable<RepuestoAuto> {
    const fd = new FormData();
    archivos.forEach((a) => fd.append('fotos', a));
    return this.http.post<RepuestoAuto>(`${this.base}/repuestos/${id}/fotos`, fd);
  }

  borrarFotoRepuesto(id: string, fotoId: string): Observable<RepuestoAuto> {
    return this.http.delete<RepuestoAuto>(`${this.base}/repuestos/${id}/fotos/${fotoId}`);
  }

  listarOrdenes(vista: 'activas' | 'listas' | 'anuladas' | 'todas' = 'activas', unidadId?: string): Observable<OrdenAlistaje[]> {
    return this.http.get<OrdenAlistaje[]>(`${this.base}/ordenes`, {
      params: { vista, ...(unidadId ? { unidad_id: unidadId } : {}) },
    });
  }

  obtenerOrden(id: string): Observable<OrdenAlistaje> {
    return this.http.get<OrdenAlistaje>(`${this.base}/ordenes/${id}`);
  }

  crearOrden(datos: Cuerpo): Observable<OrdenAlistaje> {
    return this.http.post<OrdenAlistaje>(`${this.base}/ordenes`, datos);
  }

  editarOrden(id: string, datos: Cuerpo): Observable<OrdenAlistaje> {
    return this.http.patch<OrdenAlistaje>(`${this.base}/ordenes/${id}`, datos);
  }

  cambiarEstado(id: string, datos: Cuerpo): Observable<OrdenAlistaje> {
    return this.http.post<OrdenAlistaje>(`${this.base}/ordenes/${id}/estado`, datos);
  }

  agregarRepuesto(id: string, datos: Cuerpo): Observable<OrdenAlistaje> {
    return this.http.post<OrdenAlistaje>(`${this.base}/ordenes/${id}/repuestos`, datos);
  }

  consumirRepuesto(id: string, renglonId: string): Observable<OrdenAlistaje> {
    return this.http.post<OrdenAlistaje>(`${this.base}/ordenes/${id}/repuestos/${renglonId}/consumir`, {});
  }

  quitarRepuesto(id: string, renglonId: string): Observable<OrdenAlistaje> {
    return this.http.delete<OrdenAlistaje>(`${this.base}/ordenes/${id}/repuestos/${renglonId}`);
  }

  listarCompras(ordenId?: string, estado?: string): Observable<OrdenCompraTaller[]> {
    return this.http.get<OrdenCompraTaller[]>(`${this.base}/compras`, {
      params: {
        ...(ordenId ? { orden_id: ordenId } : {}),
        ...(estado ? { estado } : {}),
      },
    });
  }

  crearCompra(datos: Cuerpo): Observable<OrdenCompraTaller> {
    return this.http.post<OrdenCompraTaller>(`${this.base}/compras`, datos);
  }

  recibirCompra(id: string, datos: Cuerpo = {}): Observable<OrdenCompraTaller> {
    return this.http.post<OrdenCompraTaller>(`${this.base}/compras/${id}/recibir`, datos);
  }

  cancelarCompra(id: string): Observable<OrdenCompraTaller> {
    return this.http.post<OrdenCompraTaller>(`${this.base}/compras/${id}/cancelar`, {});
  }

  subirFotos(id: string, archivos: File[], nota?: string, etapa?: string): Observable<OrdenAlistaje> {
    const fd = new FormData();
    archivos.forEach((a) => fd.append('fotos', a));
    if (nota) fd.append('nota', nota);
    if (etapa) fd.append('etapa', etapa);
    return this.http.post<OrdenAlistaje>(`${this.base}/ordenes/${id}/fotos`, fd);
  }

  borrarFoto(id: string, fotoId: string): Observable<OrdenAlistaje> {
    return this.http.delete<OrdenAlistaje>(`${this.base}/ordenes/${id}/fotos/${fotoId}`);
  }
}
