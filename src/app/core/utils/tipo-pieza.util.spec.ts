import { ETIQUETAS_TIPO_PIEZA, esTipoPieza, TIPOS_PIEZA } from './tipo-pieza.util';

describe('tipo-pieza.util (copia del backend)', () => {
  it('cada tipo es un slug que entra en la columna varchar(40)', () => {
    for (const t of TIPOS_PIEZA) {
      expect(t).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(t.length).toBeLessThanOrEqual(40);
    }
  });

  it('dos tipos no se llaman igual', () => {
    const textos = Object.values(ETIQUETAS_TIPO_PIEZA);
    expect(new Set(textos).size).toBe(textos.length);
  });

  it('esTipoPieza sólo acepta los de la lista', () => {
    expect(esTipoPieza('bomba-desagote')).toBeTrue();
    expect(esTipoPieza('toString')).toBeFalse();
    expect(esTipoPieza(null)).toBeFalse();
  });

  it('el alta ofrece las piezas del televisor y del microondas', () => {
    for (const t of [
      'botonera', 'capacitor-alta', 'control-remoto', 'diodo-alta', 'flex', 'fuente', 'fusible', 'magnetron',
      'membrana', 'mica', 'microswitch', 'modulo-wifi', 'motor-plato', 'motor-ventilador', 'pantalla', 'parlante',
      'pie', 'placa-main', 'plato', 'receptor-ir', 't-con', 'tira-led', 'transformador-alta',
    ]) {
      expect(esTipoPieza(t)).withContext(t).toBeTrue();
    }
    expect(ETIQUETAS_TIPO_PIEZA).toEqual(jasmine.objectContaining({ 't-con': 'Placa T-con', pie: 'Pie o base' }));
  });
});
