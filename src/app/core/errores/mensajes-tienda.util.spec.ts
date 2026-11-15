import { interpretarError } from './mensajes.util';

/** Los avisos de la capa comercial de la tienda que llegan al ERP (spec 2026-10-07 tienda §8). */
describe('interpretarError — tienda', () => {
  const respuesta = (body: any, status = 400) => ({ status, error: body, message: 'Http failure response' });

  it('TRANSFERENCIA_INCOMPLETA dice qué falta', () => {
    const m = interpretarError(respuesta({ code: 'TRANSFERENCIA_INCOMPLETA', message: 'x', faltan: ['titular', 'caja'] }));
    expect(m.titulo).toBe('Faltan datos para cobrar por transferencia');
    expect(m.detalle).toBe('Cargá el titular y la caja de transferencias (Configuración → Empresa), y volvé a guardar.');
  });

  it('TRANSFERENCIA_INCOMPLETA sin la lista igual explica', () => {
    expect(interpretarError(respuesta({ code: 'TRANSFERENCIA_INCOMPLETA', message: 'x' })).detalle).toContain('el CBU o el alias');
  });

  it('ZONA_RANGO_INVALIDO', () => {
    const m = interpretarError(respuesta({ code: 'ZONA_RANGO_INVALIDO', message: 'x' }));
    expect(m.titulo).toBe('Revisá los rangos de código postal');
    expect(m.detalle).toContain('1000-1499');
  });
});
