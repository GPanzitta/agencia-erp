import { puedeArchivarOPublicarRepuesto } from './permisos-repuesto.util';

describe('puedeArchivarOPublicarRepuesto (SEG-52)', () => {
  it('admin, mostrador y superadmin sí; pañol, técnico, chofer y sin rol no', () => {
    expect(['admin', 'mostrador', 'superadmin'].map(puedeArchivarOPublicarRepuesto)).toEqual([true, true, true]);
    expect(['panol', 'tecnico', 'chofer', null, undefined].map(puedeArchivarOPublicarRepuesto)).toEqual([false, false, false, false, false]);
  });
});
