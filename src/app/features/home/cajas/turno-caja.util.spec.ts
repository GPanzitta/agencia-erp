import {
  FilaConteo, aNumero, conteoCompleto, diferenciaDeFila, hayDiferencia, montosDeApertura,
  montosDeCierre, totalDeclarado, totalDiferencia, totalEsperado,
} from './turno-caja.util';

const fila = (p: Partial<FilaConteo> = {}): FilaConteo => ({
  wallet_id: 'w1', nombre: 'Efectivo', esperado: 1000, declarado: 1000, ...p,
});

describe('turno-caja.util', () => {
  it('aNumero normaliza strings de Postgres y valores basura', () => {
    expect(aNumero('15000.00')).toBe(15000);
    expect(aNumero('-120.50')).toBe(-120.5);
    expect(aNumero(null)).toBe(0);
    expect(aNumero('abc')).toBe(0);
  });

  it('la diferencia es contado menos esperado, redondeada a centavos', () => {
    expect(diferenciaDeFila(fila({ declarado: 900 }))).toBe(-100);
    expect(diferenciaDeFila(fila({ declarado: 1000.1, esperado: 1000.05 }))).toBe(0.05);
    expect(diferenciaDeFila(fila({ declarado: 0.3, esperado: 0.1 }))).toBe(0.2);
  });

  it('sin contar no hay diferencia (null), no es cero', () => {
    expect(diferenciaDeFila(fila({ declarado: null }))).toBeNull();
  });

  it('totaliza esperado, declarado y diferencia; lo sin contar no suma', () => {
    const filas = [
      fila({ wallet_id: 'a', esperado: 1000, declarado: 950 }),
      fila({ wallet_id: 'b', esperado: 500, declarado: 520 }),
      fila({ wallet_id: 'c', esperado: 200, declarado: null }),
    ];
    expect(totalEsperado(filas)).toBe(1700);
    expect(totalDeclarado(filas)).toBe(1470);
    expect(totalDiferencia(filas)).toBe(-30);
  });

  it('hayDiferencia: solo si alguna fila contada no da con lo esperado', () => {
    expect(hayDiferencia([fila(), fila({ wallet_id: 'b' })])).toBeFalse();
    expect(hayDiferencia([fila(), fila({ wallet_id: 'b', declarado: 1 })])).toBeTrue();
    expect(hayDiferencia([fila({ declarado: null })])).toBeFalse();
    // Dos diferencias que se anulan igual son diferencia por billetera.
    expect(hayDiferencia([fila({ declarado: 900 }), fila({ wallet_id: 'b', declarado: 1100 })])).toBeTrue();
  });

  it('conteoCompleto exige todas las filas con un monto válido', () => {
    expect(conteoCompleto([])).toBeFalse();
    expect(conteoCompleto([fila()])).toBeTrue();
    expect(conteoCompleto([fila({ declarado: 0 })])).toBeTrue();
    expect(conteoCompleto([fila(), fila({ wallet_id: 'b', declarado: null })])).toBeFalse();
    expect(conteoCompleto([fila({ declarado: -5 })])).toBeFalse();
  });

  it('arma los cuerpos de abrir y cerrar con números', () => {
    const filas = [fila({ wallet_id: 'a', declarado: 10.5 }), fila({ wallet_id: 'b', declarado: 0 })];
    expect(montosDeApertura(filas)).toEqual([
      { wallet_id: 'a', amount: 10.5 }, { wallet_id: 'b', amount: 0 },
    ]);
    expect(montosDeCierre(filas)).toEqual([
      { wallet_id: 'a', declared_amount: 10.5 }, { wallet_id: 'b', declared_amount: 0 },
    ]);
  });
});
