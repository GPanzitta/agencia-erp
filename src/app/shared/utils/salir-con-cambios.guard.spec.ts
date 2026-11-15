import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ConCambiosSinGuardar, salirConCambiosGuard } from './salir-con-cambios.guard';

describe('salirConCambiosGuard', () => {
  const correr = (pantalla: ConCambiosSinGuardar) =>
    TestBed.runInInjectionContext(() =>
      salirConCambiosGuard(pantalla, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot),
    );

  it('sin cambios sin guardar deja salir en el acto', () => {
    expect(correr({ puedeSalir: () => true })).toBeTrue();
  });

  it('con cambios espera lo que elija la persona', async () => {
    await expectAsync(correr({ puedeSalir: () => Promise.resolve(false) }) as Promise<boolean>).toBeResolvedTo(false);
  });
});
