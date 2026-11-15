import { normalizarCodigo, normalizarTexto, tokenizar } from './normalizar-texto.util';

/**
 * Copia del spec del backend (`src/ingredientes/normalizar-texto.util.spec.ts`).
 * Los dos archivos tienen que decir lo mismo: si el front normaliza distinto
 * al backend, el front decide "esto ya lo busqué" sobre un texto que para el
 * backend es otra consulta.
 */
describe('normalizarTexto', () => {
  it('saca los acentos sin romper la letra', () => {
    expect(normalizarTexto('Capacitor 30 µF')).toBe('capacitor 30 f');
    expect(normalizarTexto('Válvula')).toBe('valvula');
    expect(normalizarTexto('MAÑANA')).toBe('manana');
  });

  it('colapsa todo lo que no es alfanumérico en un espacio', () => {
    expect(normalizarTexto('PL-100')).toBe('pl 100');
    expect(normalizarTexto('B32332/A4306')).toBe('b32332 a4306');
    expect(normalizarTexto('  doble   espacio  ')).toBe('doble espacio');
  });

  it('un valor vacío o nulo es cadena vacía, no "null"', () => {
    expect(normalizarTexto(null)).toBe('');
    expect(normalizarTexto(undefined)).toBe('');
    expect(normalizarTexto('   ')).toBe('');
  });
});

describe('normalizarCodigo', () => {
  it('CAP-30, cap 30 y CAP30 son el mismo código', () => {
    expect(normalizarCodigo('CAP-30')).toBe('cap30');
    expect(normalizarCodigo('cap 30')).toBe('cap30');
    expect(normalizarCodigo('CAP30')).toBe('cap30');
  });

  it('30UF450V y 30 UF 450 V son el mismo código', () => {
    expect(normalizarCodigo('30UF450V')).toBe('30uf450v');
    expect(normalizarCodigo('30 UF 450 V')).toBe('30uf450v');
  });
});

describe('tokenizar', () => {
  it('parte por espacio y descarta los tokens de un solo carácter', () => {
    expect(tokenizar('Capacitor 30 µF')).toEqual(['capacitor', '30']);
    expect(tokenizar('Correa A lavarropas')).toEqual(['correa', 'lavarropas']);
  });

  it('un texto sin tokens útiles devuelve lista vacía', () => {
    expect(tokenizar('a')).toEqual([]);
    expect(tokenizar('')).toEqual([]);
  });
});
