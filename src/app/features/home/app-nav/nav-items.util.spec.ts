import { armarGruposNav, linkActivo } from './nav-items.util';

const rotulos = (p: { esAdmin: boolean; esVendedor: boolean }) => armarGruposNav(p).flatMap((g) => g.items.map((i) => i.rotulo));

describe('menú de la agencia', () => {
  it('el dueño ve todo', () => {
    expect(rotulos({ esAdmin: true, esVendedor: false })).toEqual([
      'Inicio', 'Stock', 'Comparar precios', 'Interesados', 'Ventas y reservas', 'Cajas', 'Gastos', 'Proveedores', 'Configuración', 'Vendedores', 'Auditoría',
    ]);
  });

  it('el vendedor ve los autos, sus ventas y las cajas, pero no los gastos ni la configuración', () => {
    expect(rotulos({ esAdmin: false, esVendedor: true })).toEqual(['Inicio', 'Stock', 'Comparar precios', 'Interesados', 'Ventas y reservas', 'Cajas']);
  });

  it('cualquier otro puesto sólo mira el stock', () => {
    expect(rotulos({ esAdmin: false, esVendedor: false })).toEqual(['Inicio', 'Stock']);
  });

  it('no queda nada del taller en el menú', () => {
    const links = armarGruposNav({ esAdmin: true, esVendedor: false }).flatMap((g) => g.items.map((i) => i.link)).join(' ');
    expect(links).not.toMatch(/ordenes|inventario|ruta|analitica|ventas\b/);
  });

  it('prende la entrada que corresponde a cada dirección', () => {
    const items = armarGruposNav({ esAdmin: true, esVendedor: false }).flatMap((g) => g.items);
    expect(linkActivo('/home', items)).toBe('/home');
    expect(linkActivo('/home/autos/unidad/abc', items)).toBe('/home/autos');
    expect(linkActivo('/home/autos/nueva?tomar=x', items)).toBe('/home/autos');
    expect(linkActivo('/home/autos/precios', items)).toBe('/home/autos/precios');
    expect(linkActivo('/home/configuracion/empleados', items)).toBe('/home/configuracion/empleados');
    expect(linkActivo('/home/configuracion/empresa', items)).toBe('/home/configuracion');
  });
});
