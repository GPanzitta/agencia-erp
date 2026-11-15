import { partirEnLotes } from './partir-en-lotes.util';

describe('partirEnLotes', () => {
  const de = (n: number, largo: number) => Array.from({ length: n }, (_, i) => ({ i, t: 'x'.repeat(largo) }));

  it('corta por cantidad cuando las filas son chicas', () => {
    expect(partirEnLotes(de(450, 1), 200, 90000).map((l) => l.length)).toEqual([200, 200, 50]);
  });
  it('corta por tamaño cuando las filas son largas, sin perder ninguna', () => {
    const lotes = partirEnLotes(de(300, 1000), 200, 90000);
    for (const l of lotes) expect(new Blob([JSON.stringify(l)]).size).toBeLessThanOrEqual(90000);
    expect(lotes.flat().length).toBe(300);
  });
  it('cuenta bytes, no letras: la ñ pesa dos', () => {
    const lotes = partirEnLotes(Array.from({ length: 10 }, () => ({ t: 'ñ'.repeat(100) })), 200, 1000);
    for (const l of lotes) expect(new Blob([JSON.stringify(l)]).size).toBeLessThanOrEqual(1000);
  });
  it('una fila más larga que el tope va sola', () => {
    expect(partirEnLotes(de(2, 5000), 200, 1000).map((l) => l.length)).toEqual([1, 1]);
  });
  it('sin filas, sin lotes', () => {
    expect(partirEnLotes([], 200, 1000)).toEqual([]);
  });
});
