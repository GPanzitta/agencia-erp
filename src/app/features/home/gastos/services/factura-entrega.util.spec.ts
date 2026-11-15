import { importeAPagar, ivaExcedido, netoDifiere } from './factura-entrega.util';

/**
 * La misma regla que `recepcion-importe.util.ts` del backend: lo que el ERP
 * muestra en el botón tiene que ser lo que después egresa la billetera.
 */
describe('factura-entrega.util', () => {
  describe('importeAPagar', () => {
    it('sin factura son los renglones', () => {
      expect(importeAPagar({}, 90000)).toBe(90000);
    });

    it('Factura A: neto + IVA, no solo el neto', () => {
      expect(importeAPagar({ neto: 90000, iva: 18900 }, 90000)).toBe(108900);
    });

    it('suma las percepciones', () => {
      expect(importeAPagar({ neto: 1000, iva: 210, percepciones: 30 }, 1000)).toBe(1240);
    });

    it('una bonificación manda la factura, aunque sea menor que los renglones', () => {
      expect(importeAPagar({ neto: 90000 }, 100000)).toBe(90000);
    });

    it('neto null o 0 cuenta como sin factura (y el IVA suelto no suma)', () => {
      expect(importeAPagar({ neto: null, iva: 210 }, 1000)).toBe(1000);
      expect(importeAPagar({ neto: 0, iva: 210 }, 1000)).toBe(1000);
    });

    it('redondea a centavos', () => {
      expect(importeAPagar({ neto: 0.1, iva: 0.2 }, 0)).toBe(0.3);
      expect(importeAPagar({}, 0.1 + 0.2)).toBe(0.3);
    });
  });

  describe('netoDifiere', () => {
    it('neto distinto de los renglones por más de $1', () => {
      expect(netoDifiere(500, 1500)).toBeTrue();
      expect(netoDifiere(1000, 1001.5)).toBeTrue();
    });

    it('hasta $1 es redondeo del proveedor, no diferencia', () => {
      expect(netoDifiere(1000, 1000.4)).toBeFalse();
      expect(netoDifiere(1000, 999)).toBeFalse();
    });

    it('sin factura no hay nada que comparar', () => {
      expect(netoDifiere(null, 1500)).toBeFalse();
      expect(netoDifiere(0, 1500)).toBeFalse();
    });
  });

  describe('ivaExcedido', () => {
    it('arriba del 27% del neto (más $1 de redondeo) es un error de tipeo', () => {
      expect(ivaExcedido(1000, 2100)).toBeTrue();
      expect(ivaExcedido(1000, 271.5)).toBeTrue();
    });

    it('el 27% con redondeo pasa, y sin factura no se mira', () => {
      expect(ivaExcedido(1000, 270)).toBeFalse();
      expect(ivaExcedido(1000, 271)).toBeFalse();
      expect(ivaExcedido(null, 5000)).toBeFalse();
      expect(ivaExcedido(1000, null)).toBeFalse();
    });
  });
});
