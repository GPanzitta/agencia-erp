import { coincideNombre, sinAcentos } from './sin-acentos.util';

/**
 * El mismo criterio que el backend para buscar personas: minúsculas y sin
 * acentos, y el nombre completo en cualquier orden. No confundir con
 * `normalizarTexto` (repuestos), que además colapsa la puntuación.
 */
describe('sinAcentos', () => {
  it('baja a minúsculas y quita acentos, diéresis, eñes y tildes portuguesas, sin tocar la puntuación', () => {
    expect(sinAcentos('Pérez Muñoz Ünal Çelik')).toBe('perez munoz unal celik');
    expect(sinAcentos('João Simões')).toBe('joao simoes');
    expect(sinAcentos('juan.perez@mail.com')).toBe('juan.perez@mail.com');
    expect(sinAcentos(null)).toBe('');
    expect(sinAcentos(undefined)).toBe('');
  });

  it('colapsa espacios repetidos, igual que el backend', () => {
    expect(sinAcentos('Juan  Perez')).toBe('juan perez');
    expect(sinAcentos(' Juan \t Perez ')).toBe(' juan perez ');
  });

  it('un acento fuera del mapa se conserva: el backend tampoco lo quita, así los dos fallan igual', () => {
    expect(sinAcentos('Łukasz')).toBe('łukasz');
  });
});

describe('coincideNombre', () => {
  it('nombre completo en los dos órdenes, una sola palabra, y sin acentos en ambos sentidos', () => {
    expect(coincideNombre('Juan', 'Pérez', 'juan perez')).toBeTrue();
    expect(coincideNombre('Juan', 'Pérez', 'perez juan')).toBeTrue();
    expect(coincideNombre('Juan', 'Perez', 'pérez')).toBeTrue();
    expect(coincideNombre('Juan', 'Pérez', 'ana')).toBeFalse();
  });

  it('un nombre cargado con espacio final («Juan ») pega igual con «juan perez»', () => {
    expect(coincideNombre('Juan ', 'Pérez', 'juan perez')).toBeTrue();
  });

  it('tolera apellido vacío o nulo (razón social) y término vacío', () => {
    expect(coincideNombre('Radio Bar', '', 'radio bar')).toBeTrue();
    expect(coincideNombre('Radio Bar', null, 'bar')).toBeTrue();
    expect(coincideNombre('Radio Bar', null, '')).toBeTrue();
  });
});
