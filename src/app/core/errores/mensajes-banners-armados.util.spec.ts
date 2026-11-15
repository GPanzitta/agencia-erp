import { interpretarError } from './mensajes.util';

/** Los avisos de los banners armados (spec 2026-10-08 banners armados). */
describe('interpretarError — banners armados', () => {
  const respuesta = (body: any, status = 400) => ({ status, error: body, message: 'Http failure response' });

  it('BANNER_PRODUCTO_INVALIDO pide un repuesto publicado', () => {
    const m = interpretarError(respuesta({ code: 'BANNER_PRODUCTO_INVALIDO', message: 'x' }));
    expect(m.titulo).toBe('Ese repuesto no se puede usar en el banner');
    expect(m.detalle).toContain('publicado');
  });

  it('BANNER_TITULO_REQUERIDO pide el título del armado', () => {
    const m = interpretarError(respuesta({ code: 'BANNER_TITULO_REQUERIDO', message: 'x' }));
    expect(m.titulo).toBe('Falta el título del banner');
    expect(m.detalle).toContain('Imagen terminada');
  });
});
