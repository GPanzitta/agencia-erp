import { candidatosDelBackend, claveTelefono, posiblesDuplicados } from './clientes-duplicados.util';

describe('posiblesDuplicados (CLI-03)', () => {
  const lista = [
    { id: 'c1', nombre: 'Lucía', apellido: 'Fernández', telefono: '15-3844-1251', documento: '32.456.789', email: 'Lucia@Mail.com' },
    { id: 'c2', nombre: 'Juan', apellido: 'Pérez', telefono: '01133313834', documento: null, email: null },
    { id: 'c3', nombre: 'Otro', telefono: '4444-5555', documento: '20111222', email: 'otro@mail.com' },
  ];

  it('el teléfono compara por los últimos 8 dígitos', () => {
    expect(claveTelefono('+54 9 11 3844-1251')).toBe('38441251');
    expect(claveTelefono('4555')).toBeNull();
    expect(posiblesDuplicados({ telefono: '+54 9 11 3844 1251' }, lista).map((p) => p.id)).toEqual(['c1']);
    expect(posiblesDuplicados({ telefono: '11 3331-3834' }, lista).map((p) => p.id)).toEqual(['c2']);
  });

  it('documento sin puntos y correo sin mayúsculas, con el motivo para leer', () => {
    const [p] = posiblesDuplicados({ documento: '32456789', email: ' lucia@mail.com ' }, lista);
    expect(p.id).toBe('c1');
    expect(p.motivo).toBe('mismo documento y correo');
  });

  it('el teléfono alternativo también cuenta', () => {
    expect(posiblesDuplicados({ telefono: '', telefono_alternativo: '1144445555' }, lista).map((p) => p.id)).toEqual(['c3']);
  });

  it('sin datos para comparar, o sin coincidencias, no avisa; tampoco contra sí mismo', () => {
    expect(posiblesDuplicados({ nombre: 'Lucía' }, lista)).toEqual([]);
    expect(posiblesDuplicados({ telefono: '11 9999-0000' }, lista)).toEqual([]);
    expect(posiblesDuplicados({ id: 'c1', telefono: '1538441251' }, lista)).toEqual([]);
  });
});

describe('candidatosDelBackend', () => {
  it('lee el 409 CLIENTE_POSIBLE_DUPLICADO y tolera que falten los candidatos', () => {
    const err = { status: 409, error: { code: 'CLIENTE_POSIBLE_DUPLICADO', candidatos: [{ id: 'c1', nombre: 'Lucía', motivo: 'mismo documento' }] } };
    expect(candidatosDelBackend(err)).toEqual([jasmine.objectContaining({ id: 'c1', motivo: 'mismo documento' })]);
    expect(candidatosDelBackend({ error: { code: 'CLIENTE_POSIBLE_DUPLICADO' } })).toEqual([]);
    // Contrato real (2d38af3): `motivos` en lista y `activo` (también vienen los dados de baja).
    const [real] = candidatosDelBackend({ error: { code: 'CLIENTE_POSIBLE_DUPLICADO', candidatos: [{ id: 'c9', nombre: 'Ana', motivos: ['telefono', 'email'], activo: false }] } })!;
    expect(real.motivo).toBe('mismo teléfono y correo');
    expect(real.activo).toBeFalse();
    expect(candidatosDelBackend({ error: { code: 'DATOS_INVALIDOS' } })).toBeNull();
    expect(candidatosDelBackend(null)).toBeNull();
  });
});
