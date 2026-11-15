export enum CanalVenta {
    MESA = 'mesa',
    MOSTRADOR = 'mostrador',
    PEDIDOSYA = 'pedidosya',
    RAPPI = 'rappi',
}

export enum MetodoPago {
    EFECTIVO = 'efectivo',
    TARJETA_DEBITO = 'tarjeta_debito',
    TARJETA_CREDITO = 'tarjeta_credito',
    TRANSFERENCIA = 'transferencia',
    MERCADOPAGO = 'mercadopago',
    CUENTA_CORRIENTE = 'cuenta_corriente',
}

export enum EstadoVenta {
    COBRADO = 'cobrado',
    CANCELADO = 'cancelado',
    DEVUELTO = 'devuelto',
}

export enum EstadoCocina {
    PENDIENTE = 'pendiente',
    PREPARANDO = 'preparando',
    LISTO = 'listo',
    ENTREGADO = 'entregado',
}

export interface Discount {
    id?: string;
    descripcion: string;
    unidad: '%' | '$';
    valor: number;
}

export interface SaleItem {
    id: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    notas_item?: string;
    product?: {
        id: string;
        nombre: string;
        precio: number;
    };
}

export interface Sale {
    id: string;
    numero_venta: string;
    fecha_hora: string;
    canal: CanalVenta;
    mesa_referencia?: string;
    /** Id real de la mesa. `mesa_referencia` es solo el numero para mostrar. */
    tableId?: string;
    mesa?: { id: string; number: number };
    subtotal: number;
    discounts?: Discount[];
    total: number;
    metodo_pago: MetodoPago;
    estado: EstadoVenta;
    estado_cocina: EstadoCocina;
    monto_recibido?: number;
    vuelto?: number;
    comision_porcentaje: number;
    comision_monto: number;
    ingreso_neto: number;
    motivo_cancelacion?: string;
    notas?: string;
    cliente?: {
        id: string;
        nombre: string;
        email?: string;
        telefono?: string;
    };
    empleado: {
        id: string;
        nombre: string;
        email: string;
    };
    items: SaleItem[];
    created_at: string;
}
