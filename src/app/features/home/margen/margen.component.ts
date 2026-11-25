import { Component, OnInit, inject, signal } from '@angular/core';

import { ExcelService } from '../../../core/services/excel.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AutosService } from '../autos/autos.service';
import { dominioLegible, plata } from '../autos/autos.util';
import {
  FilaOrigen,
  FilaVendedor,
  Moneda,
  MotivoRiesgo,
  PorMoneda,
  Riesgo,
  Tramo,
  UnidadParada,
  VistaMargen,
} from './margen.interface';
import { MargenService } from './margen.service';

const ROTULO_ORIGEN: Record<string, string> = {
  compra: 'Compra directa',
  toma: 'Toma en parte de pago',
  consignacion: 'Consignación',
};

const MOTIVOS_TEXTO: Record<MotivoRiesgo, { rotulo: string; desc: string }> = {
  perdida: { rotulo: 'Pérdida esperada', desc: 'El precio esperado no cubre los costos y alistaje' },
  papeles: { rotulo: 'Papeles trabados', desc: 'Más de 10 días en la playa con papeles en rojo' },
  parado: { rotulo: 'Stock parado', desc: 'Lleva más de 60 días sin venderse' },
  margen_flaco: { rotulo: 'Margen bajo (<8%)', desc: 'Lleva más de 30 días con margen muy ajustado' },
  sin_precio: { rotulo: 'Sin precio fijado', desc: 'Lleva más de 7 días ingresado sin precio de venta' },
};

@Component({
  selector: 'app-margen',
  standalone: false,
  templateUrl: './margen.component.html',
  styleUrls: ['./margen.component.scss'],
})
export class MargenComponent implements OnInit {
  private api = inject(MargenService);
  private autos = inject(AutosService);
  private excel = inject(ExcelService);
  private notification = inject(NotificationService);

  readonly plata = plata;
  readonly dominio = dominioLegible;
  readonly rotuloOrigen = ROTULO_ORIGEN;
  readonly motivosTexto = MOTIVOS_TEXTO;

  cargando = signal(true);
  datos = signal<VistaMargen | null>(null);

  desde = signal<string>('');
  hasta = signal<string>('');
  presetActivo = signal<'mes_actual' | 'mes_anterior' | 'ultimos_90' | 'este_anio'>('mes_actual');

  ngOnInit(): void {
    this.aplicarPreset('mes_actual');
  }

  aplicarPreset(preset: 'mes_actual' | 'mes_anterior' | 'ultimos_90' | 'este_anio'): void {
    this.presetActivo.set(preset);
    const hoy = new Date();
    const formato = (d: Date) => d.toISOString().slice(0, 10);

    let dDesde: Date;
    let dHasta: Date = hoy;

    if (preset === 'mes_actual') {
      dDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    } else if (preset === 'mes_anterior') {
      dDesde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      dHasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    } else if (preset === 'ultimos_90') {
      dDesde = new Date(hoy.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else {
      // este_anio
      dDesde = new Date(hoy.getFullYear(), 0, 1);
    }

    this.desde.set(formato(dDesde));
    this.hasta.set(formato(dHasta));
    this.consultar();
  }

  consultar(): void {
    this.cargando.set(true);
    this.api.tablero(this.desde(), this.hasta()).subscribe({
      next: (res) => {
        this.datos.set(res);
        this.cargando.set(false);
      },
      error: () => {
        this.notification.error('No se pudo cargar el tablero de rentabilidad.');
        this.cargando.set(false);
      },
    });
  }

  formatearDobleMoneda(p: PorMoneda | undefined): string {
    if (!p) return '—';
    const partes: string[] = [];
    if (p.USD > 0 || (p.USD === 0 && p.ARS === 0)) partes.push(plata(p.USD, 'USD'));
    if (p.ARS > 0) partes.push(plata(p.ARS, 'ARS'));
    return partes.join(' + ');
  }

  pct(val: number | null | undefined): string {
    if (val === null || val === undefined) return '—';
    return `${val}%`;
  }

  severidadClase(s: number): string {
    return s === 3 ? 'critica' : s === 2 ? 'media' : 'baja';
  }

  /**
   * Precio sugerido por antigüedad en stock (45d: -3%, 60d: -5%, 90d+: -8%),
   * cuidando no perforar el costo total de la unidad si hoy tiene margen positivo.
   */
  precioSugerido(p: { dias: number; costo: number; precio: number | null }): number | null {
    if (p.precio === null || p.dias < 45 || p.precio <= p.costo) return null;
    const factor = p.dias >= 90 ? 0.92 : p.dias >= 60 ? 0.95 : 0.97;
    const paso = p.precio >= 1_000_000 ? 50_000 : 100;
    const rebajado = Math.round((p.precio * factor) / paso) * paso;
    const piso = Math.ceil((p.costo * 1.02) / paso) * paso;
    const sugerido = Math.max(rebajado, piso);
    return sugerido < p.precio ? sugerido : null;
  }

  aplicarRebaja(p: UnidadParada | Riesgo): void {
    const nuevo = this.precioSugerido(p);
    if (nuevo === null) return;
    const texto = `¿Querés rebajar ${p.titulo} (${p.dias} días en stock) de ${plata(p.precio, p.moneda)} a ${plata(nuevo, p.moneda)}?`;
    if (!window.confirm(texto)) return;
    this.autos.editar(p.id, { precio_venta: nuevo }).subscribe({
      next: () => {
        this.notification.success(`Precio actualizado a ${plata(nuevo, p.moneda)}`);
        this.consultar();
      },
      error: () => this.notification.error('No se pudo actualizar el precio.'),
    });
  }

  trackPorId(_: number, item: { id: string | null }): string {
    return item.id ?? 'sin-id';
  }

  trackTramo(_: number, t: Tramo): string {
    return t.rotulo;
  }

  exportarExcel(): void {
    const d = this.datos();
    if (!d) return;
    const filas: Record<string, unknown>[] = [
      ...d.por_vendedor.map((v) => ({
        seccion: 'Vendedor',
        concepto: v.nombre,
        operaciones: v.operaciones,
        facturado_usd: v.facturado.USD,
        facturado_ars: v.facturado.ARS,
        descuento_usd: v.descuento.USD,
        descuento_ars: v.descuento.ARS,
        comision_usd: v.comisiones.USD,
        comision_ars: v.comisiones.ARS,
        neto_usd: v.neto.USD,
        neto_ars: v.neto.ARS,
        dias_promedio: v.dias_promedio,
      })),
      ...d.por_origen.map((o) => ({
        seccion: 'Por origen',
        concepto: this.rotuloOrigen[o.origen] ?? o.origen,
        operaciones: o.operaciones,
        facturado_usd: o.facturado.USD,
        facturado_ars: o.facturado.ARS,
        descuento_usd: o.descuento.USD,
        descuento_ars: o.descuento.ARS,
        comision_usd: o.comisiones.USD,
        comision_ars: o.comisiones.ARS,
        neto_usd: o.neto.USD,
        neto_ars: o.neto.ARS,
        dias_promedio: o.dias_promedio,
      })),
    ];
    void this.excel.descargar(
      `rentabilidad-${d.desde}-a-${d.hasta}.xlsx`,
      'Rentabilidad',
      [
        { clave: 'seccion', titulo: 'Categoría', ancho: 16 },
        { clave: 'concepto', titulo: 'Vendedor / Origen', ancho: 24 },
        { clave: 'operaciones', titulo: 'Ventas', ancho: 10 },
        { clave: 'facturado_usd', titulo: 'Facturado USD', ancho: 16 },
        { clave: 'facturado_ars', titulo: 'Facturado ARS', ancho: 16 },
        { clave: 'descuento_usd', titulo: 'Descuento USD', ancho: 16 },
        { clave: 'descuento_ars', titulo: 'Descuento ARS', ancho: 16 },
        { clave: 'comision_usd', titulo: 'Comisiones USD', ancho: 16 },
        { clave: 'comision_ars', titulo: 'Comisiones ARS', ancho: 16 },
        { clave: 'neto_usd', titulo: 'Margen Neto USD', ancho: 18 },
        { clave: 'neto_ars', titulo: 'Margen Neto ARS', ancho: 18 },
        { clave: 'dias_promedio', titulo: 'Días prom.', ancho: 12 },
      ],
      filas,
    );
  }
}
