import { claseDias, dominioLegible, fecha, monto, plata, renglon, textoDias, urlDelSitio } from './autos.util';

describe('autos.util', () => {
  it('escribe la plata en pesos y en dólares, sin centavos si son cero', () => {
    expect(plata(18500, 'USD')).toBe('US$ 18.500');
    expect(plata(17250000, 'ARS')).toBe('$ 17.250.000');
    expect(plata(1234.5, 'USD')).toBe('US$ 1.234,50');
    expect(plata(null, 'USD')).toBe('—');
  });

  it('separa la patente en sus dos formatos', () => {
    expect(dominioLegible('AB123CD')).toBe('AB 123 CD');
    expect(dominioLegible('ABC123')).toBe('ABC 123');
    expect(dominioLegible(null)).toBe('Sin dominio');
  });

  it('arma el renglón del auto', () => {
    expect(renglon({ anio: 2019, km: 82000, transmision: 'automatica', condicion: 'usado' })).toBe('2019 · 82.000 km · Automática');
    expect(renglon({ anio: 2026, km: 0, transmision: null, condicion: '0km' })).toBe('2026 · 0 km');
  });

  it('avisa cuando una unidad lleva mucho parada', () => {
    expect(claseDias(10)).toBe('');
    expect(claseDias(61)).toBe('pronto');
    expect(claseDias(91)).toBe('vencido');
    expect(textoDias(0)).toBe('Entró hoy');
    expect(textoDias(1)).toBe('1 día en stock');
    expect(textoDias(45)).toBe('45 días en stock');
  });

  it('lee montos escritos a la argentina', () => {
    expect(monto('18.500')).toBe(18500);
    expect(monto('US$ 18.500,50')).toBe(18500.5);
    expect(monto('1500')).toBe(1500);
    expect(monto('8.5')).toBe(8.5);
    expect(monto('')).toBeNull();
    expect(monto('0')).toBeNull();
    expect(monto('abc')).toBeNull();
  });

  it('da vuelta la fecha', () => {
    expect(fecha('2026-11-12')).toBe('12/11/2026');
    expect(fecha('2026-11-12T15:00:00Z')).toBe('12/11/2026');
    expect(fecha(null)).toBe('—');
  });
});

describe('urlDelSitio', () => {
  it('pone el nombre corto de la agencia delante del dominio del sitio', () => {
    expect(urlDelSitio('http://localhost:3201', 'perez')).toBe('http://perez.localhost:3201');
    expect(urlDelSitio('https://www.fgautos.com.ar/', 'perez-autos')).toBe('https://perez-autos.fgautos.com.ar');
  });
  it('sin nombre corto o con una dirección rota devuelve lo que recibió', () => {
    expect(urlDelSitio('http://localhost:3201', null)).toBe('http://localhost:3201');
    expect(urlDelSitio('no es una url', 'perez')).toBe('no es una url');
  });
});
