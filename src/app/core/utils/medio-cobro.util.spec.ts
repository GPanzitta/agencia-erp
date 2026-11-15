import { etiquetaMedio } from './medio-cobro.util';

describe('etiquetaMedio', () => {
  it('nombra los tres medios de la puerta como se leen en pantalla', () => {
    expect(etiquetaMedio('efectivo')).toBe('Efectivo');
    expect(etiquetaMedio('transferencia')).toBe('Transferencia');
    expect(etiquetaMedio('mercado_pago')).toBe('Mercado Pago');
  });

  it('una tarjeta cobrada antes del cambio sigue teniendo nombre', () => {
    expect(etiquetaMedio('tarjeta')).toBe('Tarjeta');
  });

  it('un medio que no conoce vuelve tal cual, y sin medio vuelve vacío', () => {
    expect(etiquetaMedio('cheque')).toBe('cheque');
    expect(etiquetaMedio('')).toBe('');
    expect(etiquetaMedio(null)).toBe('');
    expect(etiquetaMedio(undefined)).toBe('');
  });

  it('no confunde un medio con una propiedad de cualquier objeto', () => {
    expect(etiquetaMedio('toString')).toBe('toString');
    expect(etiquetaMedio('constructor')).toBe('constructor');
  });
});
