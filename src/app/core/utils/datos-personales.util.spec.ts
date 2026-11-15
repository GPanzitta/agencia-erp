import { Rol } from '../interfaces/auth.interface';
import { datoParaRol, veDatosCompletos } from './datos-personales.util';

describe('datos personales según el puesto (DAT-02)', () => {
  it('mostrador, pañol, admin y superadmin los ven completos; técnico, chofer y sin rol, no', () => {
    for (const r of [Rol.ADMIN, Rol.MOSTRADOR, Rol.SUPERADMIN]) expect(veDatosCompletos(r)).withContext(r).toBeTrue();
    for (const r of [Rol.TECNICO, Rol.PANOL, Rol.CHOFER, null]) expect(veDatosCompletos(r)).withContext(String(r)).toBeFalse();
  });

  it('al técnico le salen tapados el teléfono, el correo y el DNI', () => {
    expect(datoParaRol('11 5566-7788', 'telefono', Rol.TECNICO)).toBe('•••• 7788');
    expect(datoParaRol('juliana@gmail.com', 'email', Rol.TECNICO)).toBe('j•••@gmail.com');
    expect(datoParaRol('30.123.678', 'documento', Rol.CHOFER)).toBe('•••• 678');
    expect(datoParaRol('123', 'telefono', Rol.CHOFER)).toBe('••••');
    expect(datoParaRol('sin-arroba', 'email', Rol.CHOFER)).toBe('••••');
  });

  it('si el backend ya lo mandó tapado, queda igual: sin perder dígitos ni duplicar los puntos', () => {
    for (const r of [Rol.TECNICO, Rol.CHOFER, Rol.MOSTRADOR]) {
      expect(datoParaRol('•••• 7788', 'telefono', r)).withContext(r).toBe('•••• 7788');
      expect(datoParaRol('j•••@gmail.com', 'email', r)).withContext(r).toBe('j•••@gmail.com');
      expect(datoParaRol('•••• 678', 'documento', r)).withContext(r).toBe('•••• 678');
      expect(datoParaRol('••••', 'telefono', r)).withContext(r).toBe('••••');
    }
    // Y tapar dos veces da lo mismo que una.
    const una = datoParaRol('11 5566-7788', 'telefono', Rol.TECNICO);
    expect(datoParaRol(una, 'telefono', Rol.TECNICO)).toBe(una);
  });

  it('al mostrador, completos; vacío sigue vacío', () => {
    expect(datoParaRol('11 5566-7788', 'telefono', Rol.MOSTRADOR)).toBe('11 5566-7788');
    expect(datoParaRol(null, 'telefono', Rol.TECNICO)).toBe('');
  });
});
