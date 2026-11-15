import { Proveedor } from './proveedor.interface';

export enum CategoriaGasto {
    INGREDIENTES = 'ingredientes',
    NOMINA = 'nomina',
    ALQUILER = 'alquiler',
    SERVICIOS = 'servicios',
    MARKETING = 'marketing',
    PACKAGING = 'packaging',
    MANTENIMIENTO = 'mantenimiento',
    IMPUESTOS = 'impuestos',
    OTRO = 'otro',
}

/**
 * Etiquetas visibles de cada categoría. Los valores del enum viajan al
 * backend y NO se tocan; acá solo se traduce lo que ve el usuario
 * ('ingredientes' es el valor heredado que en el taller significa repuestos).
 */
export const ETIQUETAS_CATEGORIA_GASTO: Record<string, string> = {
    ingredientes: 'Repuestos',
    nomina: 'Nómina',
    alquiler: 'Alquiler',
    servicios: 'Servicios',
    marketing: 'Marketing',
    packaging: 'Packaging',
    mantenimiento: 'Mantenimiento',
    impuestos: 'Impuestos',
    otro: 'Otro',
};

/**
 * Categorías que se ofrecen al crear o filtrar. 'packaging' queda fuera de
 * las opciones nuevas: el valor se conserva en el enum solo para que los
 * datos históricos sigan mostrándose bien.
 */
export const CATEGORIAS_GASTO_VISIBLES: CategoriaGasto[] =
    Object.values(CategoriaGasto).filter((c) => c !== CategoriaGasto.PACKAGING);

export enum MetodoPagoGasto {
    EFECTIVO = 'efectivo',
    TRANSFERENCIA = 'transferencia',
    TARJETA = 'tarjeta',
    DEBITO_AUTOMATICO = 'debito_automatico',
    CHEQUE = 'cheque',
}

export enum EstadoPagoGasto {
    PENDIENTE = 'pendiente',
    PARCIAL = 'parcial',
    PAGADO = 'pagado',
}

export enum EstadoAprobacionGasto {
    APROBADO = 'aprobado',
    PENDIENTE = 'pendiente',
    RECHAZADO = 'rechazado',
}

/** Comprobante recibido. Define si el IVA es crédito fiscal computable. */
export enum TipoComprobanteGasto {
    FACTURA_A = 'factura_a',
    FACTURA_B = 'factura_b',
    FACTURA_C = 'factura_c',
    FACTURA_M = 'factura_m',
    NOTA_CREDITO = 'nota_credito',
    NOTA_DEBITO = 'nota_debito',
    TICKET = 'ticket',
    REMITO = 'remito',
    SIN_COMPROBANTE = 'sin_comprobante',
}

export interface PagoGasto {
    id: string;
    monto: string | number;
    metodo_pago: MetodoPagoGasto;
    fecha_pago: string;
    referencia?: string | null;
    notas?: string | null;
    estado: boolean;
    /** El backend marca con `activo: false` los pagos anulados. */
    activo?: boolean;
    /** De qué billetera salió la plata. */
    wallet?: { id: string; name: string };
    empleado?: { id: string; nombre: string };
}

export interface Gasto {
    id: string;
    numero_gasto: string;
    fecha: string;
    categoria: CategoriaGasto;
    descripcion: string;
    monto: string | number;
    // Desglose fiscal. Los gastos sin desglose tienen neto = monto e IVA y
    // percepciones en 0. Los decimales llegan como string.
    neto?: string | number;
    iva?: string | number;
    percepciones?: string | number;
    tipo_comprobante?: TipoComprobanteGasto;
    punto_venta?: string | null;
    proveedor?: Proveedor | null;
    metodo_pago: MetodoPagoGasto;
    numero_comprobante?: string | null;
    imagen_comprobante_url?: string | null;
    empleado?: {
        id: string;
        nombre: string;
        email: string;
        telefono?: string;
        activo: boolean;
        created_at: string;
        updated_at?: string;
        role?: any;
    };
    notas?: string | null;
    estado: boolean;
    created_at: string;

    // Estado de pago y aprobación. El circuito completo ya existía en el
    // backend (umbral de aprobación, pagos parciales contra billetera) pero
    // el frontend no exponía nada de esto: un gasto se creaba y quedaba sin
    // forma de marcarse pagado ni de aprobarse desde la interfaz.
    estado_pago: EstadoPagoGasto;
    monto_pagado: string | number;
    fecha_vencimiento?: string | null;
    estado_aprobacion: EstadoAprobacionGasto;
    aprobado_por?: { id: string; nombre: string } | null;
    fecha_aprobacion?: string | null;
    motivo_rechazo?: string | null;
    pagos?: PagoGasto[];
}