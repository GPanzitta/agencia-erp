import { precioSugerido } from './precio-sugerido.util';

/**
 * Copia del spec del backend (`src/ingredientes/precio-sugerido.util.spec.ts`).
 * Los dos archivos tienen que decir lo mismo: si el ERP propone un número y el
 * backend congela otro, el técnico ve un precio en el modal y otro en la OS.
 */
describe('precioSugerido', () => {
  it('el precio de venta cargado a mano le gana al margen', () => {
    expect(precioSugerido({ cost: 12000, precio_venta: 15000, margen_porcentaje: 40 })).toBe(15000);
  });

  it('sin precio de venta, aplica el margen sobre el costo', () => {
    expect(precioSugerido({ cost: 12000, precio_venta: null, margen_porcentaje: 40 })).toBe(16800);
  });

  it('redondea a pesos enteros', () => {
    expect(precioSugerido({ cost: 1234, precio_venta: null, margen_porcentaje: 40 })).toBe(1728);
  });

  it('un precio de venta en 0 es un precio, no un "no hay"', () => {
    expect(precioSugerido({ cost: 12000, precio_venta: 0, margen_porcentaje: 40 })).toBe(0);
  });

  it('margen 0 devuelve el costo', () => {
    expect(precioSugerido({ cost: 12000, precio_venta: null, margen_porcentaje: 0 })).toBe(12000);
  });

  it('sin costo devuelve 0: es lo que pasa con el repuesto que llega del escáner', () => {
    // `GET /ingredientes/resolver/:codigo` no devuelve `cost` (decisión 10 de
    // C5b), así que el buscador emite 0 y el precio lo tipea el operario.
    expect(precioSugerido({ cost: 0, precio_venta: null, margen_porcentaje: 40 })).toBe(0);
    expect(precioSugerido({ cost: undefined, precio_venta: null, margen_porcentaje: 40 })).toBe(0);
    expect(precioSugerido({ cost: null, precio_venta: undefined, margen_porcentaje: 40 })).toBe(0);
  });

  it('los decimales que llegan como string se resuelven como números', () => {
    expect(
      precioSugerido({ cost: '12000.00' as unknown as number, precio_venta: null, margen_porcentaje: 40 }),
    ).toBe(16800);
  });

  it('un margen que no es número cae en 0 y devuelve el costo', () => {
    expect(
      precioSugerido({ cost: 12000, precio_venta: null, margen_porcentaje: NaN }),
    ).toBe(12000);
  });
});
