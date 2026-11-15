import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

/**
 * Mismos valores que `AccionAuditada` del backend (`audit-log.entity.ts`),
 * todos (CLI-12): antes el ERP ofrecía 10 de 22 y el resto salía con el código
 * crudo. Sólo valores que el enum del backend acepta: uno de más es un 400.
 */
export enum AccionAuditada {
  CAJA_ABIERTA = 'caja_abierta',
  CAJA_CERRADA = 'caja_cerrada',
  MOVIMIENTO_CAJA = 'movimiento_caja',
  GASTO_APROBADO = 'gasto_aprobado',
  GASTO_RECHAZADO = 'gasto_rechazado',
  GASTO_ANULADO = 'gasto_anulado',
  PAGO_ANULADO = 'pago_anulado',
  PRESUPUESTO_APROBADO = 'presupuesto_aprobado',
  PRESUPUESTO_RECHAZADO = 'presupuesto_rechazado',
  ORDEN_ENTREGADA = 'orden_entregada',
  ORDEN_EDITADA = 'orden_editada',
  BITACORA_EDITADA = 'bitacora_editada',
  PLANTILLA_EDITADA = 'plantilla_editada',
  TURNO_AGENDADO = 'turno_agendado',
  TURNO_REPROGRAMADO = 'turno_reprogramado',
  TURNO_CANCELADO = 'turno_cancelado',
  STOCK_AJUSTADO = 'stock_ajustado',
  REPUESTO_DESACTIVADO = 'repuesto_desactivado',
  OC_EDITADA = 'oc_editada',
  OC_CERRADA_CON_FALTANTE = 'oc_cerrada_con_faltante',
  DEVOLUCION_PROVEEDOR = 'devolucion_proveedor',
  REPUESTO_FUSIONADO = 'repuesto_fusionado',
  PRECIO_MODIFICADO = 'precio_modificado',
}

/**
 * CLI-11: el filtro de fechas en el día del taller. El backend convierte
 * `2026-10-13` en la medianoche UTC (las 21 h del día anterior acá) y compara
 * `<= hasta`: «del 13 al 13» daba 0 registros. Se manda el instante exacto:
 * `desde` a las 00:00 y `hasta` a las 23:59:59,999 de la hora del navegador.
 */
export function instanteLocal(fecha: string | undefined, borde: 'inicio' | 'fin'): string | undefined {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha || undefined;
  const d = new Date(`${fecha}T${borde === 'inicio' ? '00:00:00.000' : '23:59:59.999'}`);
  return Number.isNaN(d.getTime()) ? fecha : d.toISOString();
}

export interface RegistroAuditoria {
  id: string;
  accion: AccionAuditada;
  usuario_id?: string | null;
  usuario_email?: string | null;
  usuario_rol?: string | null;
  entidad: string;
  entidad_id?: string | null;
  motivo?: string | null;
  detalle?: Record<string, unknown> | null;
  ip?: string | null;
  created_at: string;
}

export interface PaginaAuditoria {
  items: RegistroAuditoria[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface ResumenAccion {
  accion: AccionAuditada;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auditoria`;

  consultar(filtros: {
    accion?: string;
    usuario_id?: string;
    desde?: string;
    hasta?: string;
    pagina?: number;
    porPagina?: number;
  }): Observable<PaginaAuditoria> {
    let params = new HttpParams();
    const conInstantes = {
      ...filtros,
      desde: instanteLocal(filtros.desde, 'inicio'),
      hasta: instanteLocal(filtros.hasta, 'fin'),
    };
    Object.entries(conInstantes).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    });
    return this.http.get<PaginaAuditoria>(this.apiUrl, { params });
  }

  resumen(dias = 30): Observable<ResumenAccion[]> {
    return this.http.get<ResumenAccion[]>(`${this.apiUrl}/resumen?dias=${dias}`);
  }
}
