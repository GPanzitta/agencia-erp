export type Moneda = 'ARS' | 'USD';
export type PorMoneda = { ARS: number; USD: number };
export type PorMonedaPct = { ARS: number | null; USD: number | null };

export interface ResumenStock {
  unidades: number;
  con_precio: number;
  capital: PorMoneda;
  venta: PorMoneda;
  margen: PorMoneda;
  margen_pct: PorMonedaPct;
  dias_promedio: number;
  parados: { cuantos: number; capital: PorMoneda };
  papeles_en_rojo: { cuantos: number; capital: PorMoneda };
  sin_precio: { cuantos: number; capital: PorMoneda };
}

export interface ResumenVentas {
  operaciones: number;
  facturado: PorMoneda;
  costo: PorMoneda;
  margen: PorMoneda;
  comisiones: PorMoneda;
  neto: PorMoneda;
  descuento: PorMoneda;
  descuento_pct: PorMonedaPct;
  margen_pct: PorMonedaPct;
  ticket: PorMoneda;
  dias_promedio: number;
}

export interface FilaOrigen extends ResumenVentas {
  origen: 'compra' | 'toma' | 'consignacion';
}

export interface FilaVendedor extends ResumenVentas {
  id: string | null;
  nombre: string;
}

export interface Tramo {
  rotulo: string;
  desde: number;
  hasta: number | null;
  cuantos: number;
  capital: PorMoneda;
}

export type MotivoRiesgo = 'perdida' | 'papeles' | 'parado' | 'margen_flaco' | 'sin_precio';

export interface Riesgo {
  id: string;
  numero: string;
  titulo: string;
  dominio: string | null;
  moneda: Moneda;
  dias: number;
  costo: number;
  precio: number | null;
  margen: number | null;
  margen_pct: number | null;
  motivos: MotivoRiesgo[];
  severidad: 1 | 2 | 3;
}

export interface UnidadParada {
  id: string;
  numero: string;
  titulo: string;
  dominio: string | null;
  estado: string;
  moneda: Moneda;
  dias: number;
  costo: number;
  precio: number | null;
  margen: number | null;
  margen_pct: number | null;
}

export interface VistaMargen {
  desde: string;
  hasta: string;
  stock: ResumenStock;
  ventas: ResumenVentas;
  por_origen: FilaOrigen[];
  por_vendedor: FilaVendedor[];
  antiguedad: Tramo[];
  riesgos: Riesgo[];
  mas_parados: UnidadParada[];
}
