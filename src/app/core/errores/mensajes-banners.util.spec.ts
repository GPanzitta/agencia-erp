import { interpretarError } from './mensajes.util';

/** Los avisos de los banners de la portada de la tienda (spec 2026-10-08 tienda-portada §4). */
describe('interpretarError — banners de la portada', () => {
  const respuesta = (body: any, status = 400) => ({ status, error: body, message: 'Http failure response' });

  it('BANNER_LINK_INVALIDO explica los dos formatos que sirven', () => {
    const m = interpretarError(respuesta({ code: 'BANNER_LINK_INVALIDO', message: 'x' }));
    expect(m.titulo).toBe('El link del banner no sirve');
    expect(m.detalle).toContain('/c/lavarropas');
    expect(m.detalle).toContain('https://');
  });

  it('BANNER_IMAGEN_FORMATO pide JPG, PNG o WebP', () => {
    const m = interpretarError(respuesta({ code: 'BANNER_IMAGEN_FORMATO', message: 'x' }));
    expect(m.titulo).toBe('Esa imagen no se puede usar');
    expect(m.detalle).toContain('JPG, PNG o WebP');
  });

  it('BANNER_IMAGEN_PESO dice el tope que mandó el backend', () => {
    const m = interpretarError(respuesta({ code: 'BANNER_IMAGEN_PESO', message: 'x', tope: 5242880 }));
    expect(m.titulo).toBe('La imagen pesa demasiado');
    expect(m.detalle).toContain('5,0 MB');
  });

  it('BANNER_IMAGEN_PESO sin tope usa 5 MB', () => {
    expect(interpretarError(respuesta({ code: 'BANNER_IMAGEN_PESO', message: 'x' })).detalle).toContain('5,0 MB');
  });

  it('BANNER_MAXIMO dice cuántos entran', () => {
    const m = interpretarError(respuesta({ code: 'BANNER_MAXIMO', message: 'x', tope: 8 }));
    expect(m.titulo).toBe('Ya hay 8 banners');
    expect(m.detalle).toContain('Borrá uno');
  });

  it('BANNER_MAXIMO sin tope usa 8', () => {
    expect(interpretarError(respuesta({ code: 'BANNER_MAXIMO', message: 'x' })).titulo).toBe('Ya hay 8 banners');
  });
});
