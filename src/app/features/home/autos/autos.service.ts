import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Publicacion } from './publicacion.util';
import { environment } from '../../../../environments/environment';

export type Moneda = 'ARS' | 'USD';
export type EstadoUnidad = 'ingreso' | 'alistaje' | 'disponible' | 'reservada' | 'vendida' | 'devuelta' | 'baja';
export type OrigenUnidad = 'compra' | 'toma' | 'consignacion';
export type EstadoPapel = 'falta' | 'en_tramite' | 'ok';
export type Semaforo = 'rojo' | 'amarillo' | 'verde';
export type VistaStock = 'stock' | 'disponibles' | 'reservadas' | 'vendidas' | 'cerradas';
export type MedioPago = 'efectivo' | 'transferencia' | 'cheque' | 'credito' | 'usado' | 'otro';

export interface Papel { tipo: string; nombre: string; estado: EstadoPapel; vence: string | null; nota: string | null; bloquea: boolean; vencido: boolean }

/** Un auto de la agencia tal como lo devuelve el backend (diseño del 12/11/2026). */
export interface Unidad {
  id: string; numero: string; titulo: string; dominio: string | null;
  marca: string; modelo: string; version: string | null; anio: number; km: number;
  color: string | null; combustible: string | null; transmision: string | null; carroceria: string | null;
  nro_motor: string | null; nro_chasis: string | null;
  condicion: 'usado' | '0km'; origen: OrigenUnidad; estado: EstadoUnidad; moneda: Moneda;
  costo_adquisicion: number | null; precio_piso: number | null; precio_venta: number | null;
  gastos: { id: string; descripcion: string; monto: number; moneda: Moneda; tipo_cambio: number | null; fecha: string }[];
  total_gastos: number | null; costo_total: number | null; margen: number | null; dias_en_stock: number;
  papeles: Papel[]; semaforo: Semaforo; bloqueantes: string[];
  publicada: boolean;
  fotos: { id: string; url: string; url_miniatura: string; orden: number }[];
  portada: string | null;
  titular_nombre: string | null; titular_telefono: string | null; titular_documento: string | null;
  descripcion: string | null; ubicacion: string | null; notas: string | null;
  /** Lo que la publicación del sitio muestra además de los datos básicos. */
  publicacion?: Publicacion | null;
  fecha_ingreso: string; fecha_venta: string | null;
  operacion: { id: string; numero: string; estado: string; cliente_nombre: string } | null;
  acciones: { editar: boolean; gastos: boolean; publicar: boolean; reservar: boolean; mover: boolean };
}

export interface PagoOperacion {
  id: string; medio: MedioPago; monto: number; moneda: Moneda; tipo_cambio: number | null; equivalente: number;
  billetera: string | null; toma: { id: string; numero: string; titulo: string } | null; detalle: string | null; fecha: string;
}

export interface FotoOperacion {
  id: string;
  url: string;
  url_miniatura: string;
  nota: string | null;
  etapa: string;
  autor: string | null;
  fecha: string;
}

export interface Operacion {
  id: string; numero: string; estado: 'reservada' | 'vendida' | 'anulada';
  unidad: { id: string; numero: string; titulo: string; dominio: string | null; anio: number };
  cliente_nombre: string; cliente_telefono: string | null; cliente_documento: string | null;
  precio: number; moneda: Moneda; pagos: PagoOperacion[]; pagado: number; saldo: number; saldada: boolean;
  reserva_vence: string | null; vencida: boolean; vendedor: { id: string; nombre: string } | null; comision: number | null; comision_sugerida: number | null; comision_pagada_at: string | null;
  bloqueantes: string[]; fotos: FotoOperacion[]; notas: string | null; anulada_motivo: string | null; created_at: string; cerrada_at: string | null;
  acciones: { pagar: boolean; cerrar: boolean; anular: boolean };
}

export interface ResumenStock {
  en_stock: number; disponibles: number; reservadas: number; publicadas: number; papeles_en_rojo: number;
  dias_promedio: number; mas_de_60_dias: number; valor_stock: Record<Moneda, number>; vendidas_mes: number; margen_mes: Record<Moneda, number>;
}

export type EtapaInteresado = 'nuevo' | 'contactado' | 'visita' | 'negociando' | 'ganado' | 'perdido';
export interface UnidadSugerida { id: string; numero: string; titulo: string; anio: number; km: number; precio: number | null; moneda: string; estado: string }

/** Alguien que consultó o que busca un auto (tanda de la demo, 12/11/2026). */
export interface Interesado {
  id: string; nombre: string; telefono: string | null; email: string | null; origen: string; etapa: EtapaInteresado; temperatura: string;
  unidad: UnidadSugerida | null; busca: string | null; busca_marca: string | null; busca_carroceria: string | null;
  precio_max: number | null; precio_moneda: string | null; tiene_usado: string | null;
  proxima_accion: string | null; proxima_nota: string | null; atrasado: boolean; toca_hoy: boolean;
  vendedor: { id: string; nombre: string } | null; seguimiento: { fecha: string; texto: string; autor: string | null }[];
  motivo_perdida: string | null; sugeridas: UnidadSugerida[]; created_at: string; updated_at: string;
  /** Las fotos de su auto que mandó desde el sitio. */
  fotos: { url: string; url_miniatura: string }[];
  usado: UsadoDelInteresado | null;
  /** La cotización de su auto: si la pidió desde el sitio y qué se le ofreció. */
  cotizacion: { pedida: boolean; pendiente: boolean; valor: number | null; moneda: Moneda | null; fecha: string | null };
}

export interface Financiacion { anticipo_minimo_pct: number; plazos: number[]; tna_ars: number | null; tna_usd: number | null }
export interface ReservaDelSitio { monto: number; moneda: Moneda; horas: number; dias: number; alias: string; titular: string }
export interface SitioDeAgencia { slug: string; muestra_papeles: boolean; financiacion: Financiacion | null; reserva: ReservaDelSitio | null }
/** Un pedido de reserva hecho desde el sitio: el cliente transfiere la seña y la agencia la confirma. */
export interface PedidoDeReserva {
  id: string; estado: 'pendiente' | 'confirmada' | 'rechazada' | 'vencida';
  unidad: { id: string; numero: string; titulo: string; anio: number; moneda: Moneda; disponible: boolean };
  cliente_nombre: string; cliente_telefono: string; cliente_documento: string | null;
  monto: number; moneda: Moneda; vence_at: string; dias: number;
  operacion: { id: string; numero: string } | null; motivo: string | null; created_at: string;
}
export type PorMoneda = { ARS: number; USD: number };
export interface ComisionesDeVendedor {
  id: string | null; nombre: string; pct: number | null;
  ventas: number; vendido: PorMoneda; comision: PorMoneda; pendiente: PorMoneda;
  operaciones: { id: string; numero: string; unidad_id: string; unidad: string; cliente: string; cerrada_at: string | null; precio: number; moneda: Moneda; comision: number | null; pagada_at: string | null }[];
}
export interface Comisiones { desde: string; hasta: string; vendedores: ComisionesDeVendedor[] }
export interface GuiaDelUsado {
  uso: string | null;
  guardado: string | null;
  motivo_venta: string | null;
  ultimo_service: string | null;
  ultima_vtv: string | null;
  mantenimiento: string | null;
  neumaticos: string | null;
  transferencia: string | null;
  agregados: string | null;
  paneles_choques: string | null;
  reparaciones: string | null;
}
/** El auto del interesado en datos sueltos, como lo cargó en «Cotizá tu auto». */
export interface UsadoDelInteresado {
  tipo_vehiculo?: string | null;
  carroceria?: string | null;
  dominio?: string | null;
  marca: string;
  modelo: string;
  version: string | null;
  anio: number;
  km: number | null;
  combustible: string | null;
  transmision: string | null;
  seguro_cuota?: number | null;
  seguro_cobertura?: string | null;
  seguro_compania?: string | null;
  costo_patente?: number | null;
  radicacion?: string | null;
  descripcion?: string | null;
  guia?: GuiaDelUsado | null;
}
export interface AutoAjeno { titulo: string; marca: string | null; anio: number | null; km: number | null; precio: number; moneda: Moneda; url: string | null; fuente: string; detalle?: string | null }
export type Veredicto = 'sin_precio' | 'sin_comparables' | 'falta_dolar' | 'buen_precio' | 'en_precio' | 'caro_pero_mejor' | 'caro';
export interface ComparacionDeUnidad {
  unidad: { id: string; numero: string; marca: string; modelo: string; version: string | null; anio: number; km: number; precio: number | null; moneda: Moneda };
  /** `nivel`: 2 = misma versión, 1 = mismo motor y caja, 0 = sólo el modelo. `medido`: entró en la cuenta. */
  comparables: (AutoAjeno & { precio_en_mi_moneda: number | null; nivel: 0 | 1 | 2; medido: boolean })[];
  /** Contra qué se midió. */
  base: 'misma_version' | 'mismo_motor' | 'mismo_modelo';
  /** Lo que esos avisos dicen que vale un auto con mis km y mi año; null si no alcanzan para estimarlo. */
  esperado: number | null;
  /** Cómo se movió el precio del medio de ese modelo. */
  tendencia: { antes: number; ahora: number; variacion_pct: number; dias: number } | null;
  referencia: number | null; diferencia_pct: number | null; veredicto: Veredicto; motivo: string;
}
export interface OtroVendedor { id: string; nombre: string; url: string; autos: number; leida_at: string | null; error: string | null; leyendo: boolean }
export interface NovedadDeAviso {
  tipo: 'bajo' | 'subio' | 'nuevo' | 'salio'; titulo: string; anio: number | null; km: number | null; detalle: string | null; url: string | null; moneda: Moneda;
  precio: number; precio_anterior: number | null; variacion_pct: number | null; dias_publicado: number | null; fecha: string; fuente: string;
}
export interface ComparacionDePrecios { competidores: OtroVendedor[]; dolar: number | null; mios: ComparacionDeUnidad[]; solo_ellos: AutoAjeno[]; novedades: NovedadDeAviso[] }
export interface Billetera { id: string; name: string; moneda: Moneda }
type Cuerpo = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class AutosService {
  private http = inject(HttpClient);
  private u = `${environment.apiUrl}/unidades`;
  private o = `${environment.apiUrl}/operaciones`;

  listar(vista: VistaStock, q?: string): Observable<Unidad[]> {
    return this.http.get<Unidad[]>(this.u, { params: { vista, ...(q ? { q } : {}) } });
  }
  /** La dirección del sitio de esta agencia (el backend le asigna una la primera vez). */
  sitio(): Observable<SitioDeAgencia> { return this.http.get<SitioDeAgencia>(`${this.u}/sitio`); }
  /** Qué muestra el sitio de esta agencia (sólo el dueño). */
  configurarSitio(datos: Cuerpo): Observable<SitioDeAgencia> { return this.http.put<SitioDeAgencia>(`${this.u}/sitio`, datos); }
  resumen(): Observable<ResumenStock> { return this.http.get<ResumenStock>(`${this.u}/resumen`); }
  obtener(id: string): Observable<Unidad> { return this.http.get<Unidad>(`${this.u}/${id}`); }
  crear(datos: Cuerpo): Observable<Unidad> { return this.http.post<Unidad>(this.u, datos); }
  leerSitioParaImportar(url: string): Observable<{
    dominio: string;
    marca: string;
    modelo: string;
    version: string | null;
    anio: number;
    km: number;
    moneda: Moneda;
    precio_venta: number;
  }[]> {
    return this.http.post<{
      dominio: string;
      marca: string;
      modelo: string;
      version: string | null;
      anio: number;
      km: number;
      moneda: Moneda;
      precio_venta: number;
    }[]>(`${this.u}/leer-sitio`, { url });
  }
  editar(id: string, datos: Cuerpo): Observable<Unidad> { return this.http.patch<Unidad>(`${this.u}/${id}`, datos); }
  cambiarEstado(id: string, estado: EstadoUnidad, motivo?: string): Observable<Unidad> {
    return this.http.post<Unidad>(`${this.u}/${id}/estado`, { estado, ...(motivo ? { motivo } : {}) });
  }
  publicar(id: string, publicada: boolean): Observable<Unidad> { return this.http.post<Unidad>(`${this.u}/${id}/publicar`, { publicada }); }
  guardarPublicacion(id: string, datos: Publicacion): Observable<Unidad> { return this.http.put<Unidad>(`${this.u}/${id}/publicacion`, datos); }
  agregarGasto(id: string, datos: Cuerpo): Observable<Unidad> { return this.http.post<Unidad>(`${this.u}/${id}/gastos`, datos); }
  quitarGasto(id: string, gastoId: string): Observable<Unidad> { return this.http.delete<Unidad>(`${this.u}/${id}/gastos/${gastoId}`); }
  papel(id: string, tipo: string, datos: Cuerpo): Observable<Unidad> { return this.http.put<Unidad>(`${this.u}/${id}/papeles/${tipo}`, datos); }
  subirFoto(id: string, archivo: File): Observable<Unidad> {
    const fd = new FormData();
    fd.append('file', archivo);
    return this.http.post<Unidad>(`${this.u}/${id}/fotos`, fd);
  }
  portada(id: string, fotoId: string): Observable<Unidad> { return this.http.post<Unidad>(`${this.u}/${id}/fotos/${fotoId}/portada`, {}); }
  borrarFoto(id: string, fotoId: string): Observable<Unidad> { return this.http.delete<Unidad>(`${this.u}/${id}/fotos/${fotoId}`); }

  operaciones(vista: 'reservas' | 'vendidas' | 'anuladas'): Observable<Operacion[]> {
    return this.http.get<Operacion[]>(this.o, { params: { vista } });
  }
  operacion(id: string): Observable<Operacion> { return this.http.get<Operacion>(`${this.o}/${id}`); }
  reservar(datos: Cuerpo): Observable<Operacion> { return this.http.post<Operacion>(this.o, datos); }
  pagar(id: string, datos: Cuerpo): Observable<Operacion> { return this.http.post<Operacion>(`${this.o}/${id}/pagos`, datos); }
  quitarPago(id: string, pagoId: string): Observable<Operacion> { return this.http.delete<Operacion>(`${this.o}/${id}/pagos/${pagoId}`); }
  cerrar(id: string, comision: number | null): Observable<Operacion> {
    return this.http.post<Operacion>(`${this.o}/${id}/cerrar`, comision === null ? {} : { comision });
  }
  anular(id: string, motivo: string): Observable<Operacion> { return this.http.post<Operacion>(`${this.o}/${id}/anular`, { motivo }); }
  subirFotosOperacion(id: string, archivos: File[], nota?: string, etapa?: string): Observable<Operacion> {
    const fd = new FormData();
    archivos.forEach((a) => fd.append('fotos', a));
    if (nota) fd.append('nota', nota);
    if (etapa) fd.append('etapa', etapa);
    return this.http.post<Operacion>(`${this.o}/${id}/fotos`, fd);
  }
  borrarFotoOperacion(id: string, fotoId: string): Observable<Operacion> {
    return this.http.delete<Operacion>(`${this.o}/${id}/fotos/${fotoId}`);
  }
  private r = `${environment.apiUrl}/reservas-web`;
  pedidosDeReserva(): Observable<PedidoDeReserva[]> { return this.http.get<PedidoDeReserva[]>(this.r); }
  confirmarReserva(id: string, datos: Cuerpo): Observable<PedidoDeReserva> { return this.http.post<PedidoDeReserva>(`${this.r}/${id}/confirmar`, datos); }
  rechazarReserva(id: string, motivo: string): Observable<PedidoDeReserva> { return this.http.post<PedidoDeReserva>(`${this.r}/${id}/rechazar`, motivo ? { motivo } : {}); }
  comisiones(desde: string, hasta: string): Observable<Comisiones> {
    return this.http.get<Comisiones>(`${this.o}/comisiones`, { params: { ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}) } });
  }
  ajustarComision(id: string, datos: Cuerpo): Observable<Operacion> { return this.http.post<Operacion>(`${this.o}/${id}/comision`, datos); }
  porcentajeDeVendedor(id: string, pct: number | null): Observable<{ id: string; pct: number | null }> {
    return this.http.put<{ id: string; pct: number | null }>(`${this.o}/comisiones/vendedores/${id}`, { pct });
  }
  private i = `${environment.apiUrl}/interesados`;
  interesados(vista: 'activos' | 'ganados' | 'perdidos'): Observable<Interesado[]> { return this.http.get<Interesado[]>(this.i, { params: { vista } }); }
  interesadosDeUnidad(unidadId: string): Observable<{ consultaron: Interesado[]; coinciden: Interesado[] }> {
    return this.http.get<{ consultaron: Interesado[]; coinciden: Interesado[] }>(`${this.i}/de-unidad/${unidadId}`);
  }
  crearInteresado(datos: Cuerpo): Observable<Interesado> { return this.http.post<Interesado>(this.i, datos); }
  editarInteresado(id: string, datos: Cuerpo): Observable<Interesado> { return this.http.patch<Interesado>(`${this.i}/${id}`, datos); }
  moverInteresado(id: string, etapa: EtapaInteresado, motivo?: string): Observable<Interesado> {
    return this.http.post<Interesado>(`${this.i}/${id}/etapa`, { etapa, ...(motivo ? { motivo } : {}) });
  }
  cotizarInteresado(id: string, datos: Cuerpo): Observable<Interesado> { return this.http.post<Interesado>(`${this.i}/${id}/cotizacion`, datos); }
  anotarInteresado(id: string, datos: Cuerpo): Observable<Interesado> { return this.http.post<Interesado>(`${this.i}/${id}/notas`, datos); }
  subirFotosInteresado(id: string, archivos: File[]): Observable<Interesado> {
    const fd = new FormData();
    archivos.forEach((a) => fd.append('fotos', a));
    return this.http.post<Interesado>(`${this.i}/${id}/fotos`, fd);
  }
  borrarFotoInteresado(id: string, indice: number): Observable<Interesado> {
    return this.http.delete<Interesado>(`${this.i}/${id}/fotos/${indice}`);
  }

  private c = `${environment.apiUrl}/competencia`;
  /** El dólar lo guarda el servidor por agencia: no hace falta mandarlo. */
  compararPrecios(): Observable<ComparacionDePrecios> { return this.http.get<ComparacionDePrecios>(this.c); }
  guardarDolar(dolar: number | null): Observable<{ dolar: number | null }> { return this.http.put<{ dolar: number | null }>(`${this.c}/dolar`, { dolar }); }
  agregarVendedor(url: string, nombre: string): Observable<OtroVendedor> { return this.http.post<OtroVendedor>(this.c, { url, ...(nombre ? { nombre } : {}) }); }
  releerVendedor(id: string): Observable<OtroVendedor> { return this.http.post<OtroVendedor>(`${this.c}/${id}/leer`, {}); }
  quitarVendedor(id: string): Observable<{ ok: true }> { return this.http.delete<{ ok: true }>(`${this.c}/${id}`); }

  billeteras(): Observable<Billetera[]> { return this.http.get<Billetera[]>(`${environment.apiUrl}/wallets/active`); }
}
