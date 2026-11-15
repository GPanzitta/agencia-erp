import { linkWhatsappArgentino, whatsappArgentino } from './whatsapp.util';

/** Los mismos casos que `taller-backend/src/common/whatsapp.util.spec.ts`. */
describe('whatsappArgentino (CLI-13)', () => {
  const casos: [string, string][] = [
    ['1133313834', '5491133313834'],
    ['11 3331-3834', '5491133313834'],
    ['011 3331-3834', '5491133313834'],
    ['011 15 3331-3834', '5491133313834'],
    ['+54 9 11 3331-3834', '5491133313834'],
    ['5491133313834', '5491133313834'],
    ['+54 11 3331-3834', '5491133313834'],
    ['0054 11 3331 3834', '5491133313834'],
    ['54 011 15 3331 3834', '5491133313834'],
    ['02944 15-123456', '5492944123456'],
    ['0351 155 123456', '5493515123456'],
    // Los dos de la auditoría.
    ['1144445555', '5491144445555'],
    ['01133313834', '5491133313834'],
  ];
  for (const [entrada, salida] of casos) {
    it(`${entrada} → ${salida}`, () => expect(whatsappArgentino(entrada)).toBe(salida));
  }

  it('lo que no es un número argentino reconocible sale como vino, sólo dígitos', () => {
    expect(whatsappArgentino('4555-1234')).toBe('45551234');
    expect(whatsappArgentino('+1 (305) 555-0100')).toBe('13055550100');
  });

  it('vacío o nulo → null', () => {
    expect(whatsappArgentino(null)).toBeNull();
    expect(whatsappArgentino(undefined)).toBeNull();
    expect(whatsappArgentino('  -  ')).toBeNull();
  });

  it('el link lleva el texto codificado', () => {
    expect(linkWhatsappArgentino('11 3331-3834', 'Hola & chau')).toBe('https://wa.me/5491133313834?text=Hola%20%26%20chau');
    expect(linkWhatsappArgentino('')).toBeNull();
  });
});
