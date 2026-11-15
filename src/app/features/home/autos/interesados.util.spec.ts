import type { Interesado } from './autos.service';
import { claseProxima, cuentas, linkWhatsapp, mensajeDeCotizacion, ordenar, resumenDeBusqueda, textoProxima } from './interesados.util';

const base = (p: Partial<Interesado> = {}): Interesado => ({
  id: 'i1', nombre: 'Pablo Pérez', telefono: '11 5555 0100', email: null, origen: 'whatsapp', etapa: 'contactado', temperatura: 'tibio',
  unidad: null, busca: null, busca_marca: null, busca_carroceria: null, precio_max: null, precio_moneda: null, tiene_usado: null,
  proxima_accion: null, proxima_nota: null, atrasado: false, toca_hoy: false, vendedor: null, seguimiento: [], motivo_perdida: null,
  sugeridas: [], fotos: [], usado: null, cotizacion: { pedida: false, pendiente: false, valor: null, moneda: null, fecha: null }, created_at: '2026-11-12T10:00:00Z', updated_at: '2026-11-12T10:00:00Z', ...p,
});

describe('interesados.util', () => {
  it('resume lo que busca en una línea', () => {
    expect(resumenDeBusqueda(base({ busca_carroceria: 'pickup', busca_marca: 'Toyota', precio_max: 36000, precio_moneda: 'USD' }))).toBe('Pickup Toyota hasta US$ 36.000');
    expect(resumenDeBusqueda(base({ precio_max: 15000000, precio_moneda: 'ARS' }))).toBe('hasta $ 15.000.000');
    expect(resumenDeBusqueda(base())).toBe('');
  });

  it('dice cuándo toca hablarle', () => {
    expect(textoProxima(base())).toBe('Sin fecha para volver a hablarle');
    expect(textoProxima(base({ proxima_accion: '2026-11-12', toca_hoy: true }))).toBe('Hablarle hoy');
    expect(textoProxima(base({ proxima_accion: '2026-11-10', atrasado: true }))).toBe('Había que hablarle el 10/11/2026');
    expect(textoProxima(base({ proxima_accion: '2026-11-20' }))).toBe('Hablarle el 20/11/2026');
    expect(textoProxima(base({ etapa: 'ganado', proxima_accion: '2026-11-20' }))).toBe('');
  });

  it('marca lo atrasado en rojo y lo de hoy o sin fecha en amarillo', () => {
    expect(claseProxima(base({ proxima_accion: '2026-11-10', atrasado: true }))).toBe('vencido');
    expect(claseProxima(base({ proxima_accion: '2026-11-12', toca_hoy: true }))).toBe('pronto');
    expect(claseProxima(base())).toBe('pronto');
    expect(claseProxima(base({ proxima_accion: '2026-11-20' }))).toBe('');
  });

  it('arma el WhatsApp con el número argentino, o nada si no es un celular completo', () => {
    expect(linkWhatsapp('11 5555 0100', 'Pablo Pérez')).toBe('https://wa.me/5491155550100?text=Hola%20Pablo%2C%20');
    expect(linkWhatsapp('+54 9 11 5555-0100', 'Pablo')).toContain('wa.me/5491155550100');
    expect(linkWhatsapp('011 5555 0100', 'Pablo')).toContain('wa.me/5491155550100');
    expect(linkWhatsapp('5555', 'Pablo')).toBeNull();
    expect(linkWhatsapp(null, 'Pablo')).toBeNull();
  });

  it('cuenta lo de hoy, lo atrasado, lo sin fecha y a quién le sirve algo del stock', () => {
    const lista = [
      base({ toca_hoy: true, proxima_accion: '2026-11-12' }),
      base({ atrasado: true, proxima_accion: '2026-11-01' }),
      base({ sugeridas: [{ id: 'u', numero: 'U-1', titulo: 'Hilux', anio: 2020, km: 1, precio: 1, moneda: 'USD', estado: 'disponible' }] }),
    ];
    expect(cuentas(lista)).toEqual({ hoy: 1, atrasados: 1, sinFecha: 1, conAutos: 1 });
  });

  it('ordena la columna: atrasado, hoy, con fecha, sin fecha', () => {
    const orden = ordenar([
      base({ id: 'sin' }),
      base({ id: 'futuro', proxima_accion: '2026-11-20' }),
      base({ id: 'hoy', proxima_accion: '2026-11-12', toca_hoy: true }),
      base({ id: 'tarde', proxima_accion: '2026-11-01', atrasado: true }),
    ]).map((i) => i.id);
    expect(orden).toEqual(['tarde', 'hoy', 'futuro', 'sin']);
  });
});

describe('cotización por WhatsApp', () => {
  it('arma el mensaje con el auto y el importe, detrás del saludo', () => {
    const m = mensajeDeCotizacion({ tiene_usado: 'Volkswagen Gol Trend 2018, 90.000 km' }, 'US$ 9.500');
    expect(m).toContain('tu Volkswagen Gol Trend 2018: US$ 9.500');
    const link = linkWhatsapp('11 4444 0177', 'Marta Prueba', m) ?? '';
    expect(decodeURIComponent(link.split('text=')[1])).toContain('Hola Marta, te pasamos la cotización');
    expect(linkWhatsapp('11 4444 0177', 'Marta Prueba')).toContain(encodeURIComponent('Hola Marta, '));
  });
});
