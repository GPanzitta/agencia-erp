import { pendientesDeHoy } from './inicio.util';

const hoy = new Date('2026-11-14T12:00:00Z');
const interesado = (x: Partial<{ atrasado: boolean; toca_hoy: boolean; pendiente: boolean }> = {}) =>
  ({ atrasado: x.atrasado ?? false, toca_hoy: x.toca_hoy ?? false, cotizacion: { pendiente: x.pendiente ?? false } });

describe('lo que hay para atender hoy', () => {
  it('sin nada pendiente, la lista queda vacía', () => {
    expect(pendientesDeHoy({ stock: [], interesados: [interesado()], pedidos: [{ estado: 'confirmada' }], reservas: [], hoy })).toEqual([]);
  });

  it('cuenta cada cosa una vez y pone primero lo urgente', () => {
    const l = pendientesDeHoy({
      stock: [
        { estado: 'disponible', semaforo: 'verde', publicada: false, precio_venta: 15000, dias_en_stock: 3 },
        { estado: 'disponible', semaforo: 'rojo', publicada: true, precio_venta: 9000, dias_en_stock: 70 },
        { estado: 'disponible', semaforo: 'verde', publicada: false, precio_venta: null, dias_en_stock: 1 },
      ],
      interesados: [interesado({ atrasado: true, toca_hoy: true }), interesado({ toca_hoy: true }), interesado({ pendiente: true })],
      pedidos: [{ estado: 'pendiente' }, { estado: 'rechazada' }],
      reservas: [{ reserva_vence: '2026-11-16', vencida: false }, { reserva_vence: '2026-12-20', vencida: false }, { reserva_vence: null, vencida: true }],
      hoy,
    });
    expect(l.map((p) => [p.clave, p.cuantos])).toEqual([['senas', 1], ['atrasados', 1], ['hoy', 1], ['cotizar', 1], ['reservas', 2], ['publicar', 1], ['papeles', 1]]);
    expect(l.filter((p) => p.urgente).map((p) => p.clave)).toEqual(['senas', 'atrasados']);
    expect(l[0].texto).toBe('pedido de reserva del sitio');
    expect(l[4].texto).toBe('reservas vencidas o por vencer');
  });
});
