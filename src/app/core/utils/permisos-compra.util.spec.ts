import { puedeRegistrarCompra } from './permisos-compra.util';

describe('puedeRegistrarCompra', () => {
  // Los mismos dos roles que `@UserProtected(Roles.ADMIN, Roles.PANOL)` en
  // `POST /purchase-orders/directa` y `POST /purchase-orders/:id/entregas`,
  // más el superadmin, que pasa por todos los guards.
  it('dejan pagar el admin, el pañol y el superadmin', () => {
    expect(puedeRegistrarCompra('admin')).toBeTrue();
    expect(puedeRegistrarCompra('panol')).toBeTrue();
    expect(puedeRegistrarCompra('superadmin')).toBeTrue();
  });

  it('no dejan pagar el mostrador ni el técnico, que es lo que el backend ya decía', () => {
    expect(puedeRegistrarCompra('mostrador')).toBeFalse();
    expect(puedeRegistrarCompra('tecnico')).toBeFalse();
    expect(puedeRegistrarCompra('chofer')).toBeFalse();
  });

  it('sin rol resuelto todavía, no', () => {
    expect(puedeRegistrarCompra(null)).toBeFalse();
    expect(puedeRegistrarCompra(undefined)).toBeFalse();
    expect(puedeRegistrarCompra('')).toBeFalse();
  });
});
