export interface Proveedor {
    id: string;
    nombre: string;
    descripcion: string;
    telefono: string;
    correo: string;
    direccion: string;
    created_at: string;
    updated_at: string | null;

    // Condiciones comerciales. El backend las tiene desde el módulo de
    // compras; el tipo del front no las declaraba.
    cuit?: string;
    /** Condición frente al IVA: define qué comprobante puede emitir. */
    condicion_iva?: 'responsable_inscripto' | 'monotributo' | 'exento' | 'consumidor_final' | 'no_informada';
    /** Días de plazo de pago acordados. Alimenta el vencimiento automático. */
    dias_pago?: number;
    /** Días que tarda en entregar. Logística, no financiación. */
    dias_entrega?: number;
    /** Tope de deuda acordado. 0 = sin límite. */
    limite_credito?: number;
}
