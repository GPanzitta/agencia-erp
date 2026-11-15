import { conPlantilla, paraGuardar, porGrupo, PUBLICACION_VACIA } from './publicacion.util';

describe('la publicación de un auto', () => {
  it('la plantilla suma lo que falta sin pisar lo cargado', () => {
    const l = conPlantilla([{ grupo: 'Seguridad', etiqueta: 'Airbags', valor: '6' }]);
    expect(l[0]).toEqual({ grupo: 'Seguridad', etiqueta: 'Airbags', valor: '6' });
    expect(l.filter((c) => c.etiqueta === 'Airbags').length).toBe(1);
    expect(l.some((c) => c.etiqueta === 'Frenos ABS' && c.valor === '')).toBe(true);
  });

  it('agrupa en el orden de siempre y deja los grupos propios al final', () => {
    const g = porGrupo([{ grupo: 'Off road', x: 1 }, { grupo: 'Seguridad', x: 2 }, { grupo: 'General', x: 3 }]);
    expect(g.map((x) => x.grupo)).toEqual(['General', 'Seguridad', 'Off road']);
  });

  it('al guardar descarta lo vacío y lo repetido', () => {
    const p = paraGuardar({
      ...PUBLICACION_VACIA,
      destacados: [{ nombre: '  Tapizado de cuero ', categoria: '' }, { nombre: 'tapizado de cuero', categoria: 'Tapizado' }, { nombre: '', categoria: 'Confort' }],
      caracteristicas: [{ grupo: 'Seguridad', etiqueta: 'Airbags', valor: '6' }, { grupo: 'Seguridad', etiqueta: 'Frenos ABS', valor: '' }],
      colores: [{ nombre: 'Gris plata', hex: '#A0A0A0' }, { nombre: 'Rojo', hex: 'rojo' }],
      precio_financiado: 0,
      relacionadas: ['a', 'a', 'b'],
    });
    expect(p.destacados).toEqual([{ nombre: 'tapizado de cuero', categoria: 'Tapizado' }]);
    expect(p.caracteristicas).toEqual([{ grupo: 'Seguridad', etiqueta: 'Airbags', valor: '6' }]);
    expect(p.colores).toEqual([{ nombre: 'Gris plata', hex: '#a0a0a0' }, { nombre: 'Rojo', hex: '#888888' }]);
    expect(p.precio_financiado).toBeNull();
    expect(p.relacionadas).toEqual(['a', 'b']);
  });
});
