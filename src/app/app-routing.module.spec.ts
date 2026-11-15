import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { routes } from './app-routing.module';
import { AuthService } from './features/auth/services/auth.service';
import { AuthStatus, Rol } from './core/interfaces/auth.interface';

/**
 * SEG-ERP-04: `/admin` es la consola de la plataforma (alta de talleres,
 * todas las empresas). Tenía sólo `authGuard`: cualquier empleado logueado
 * cargaba las pantallas, y el backend recién lo frenaba con 403.
 */
describe('Rutas raíz: /admin (SEG-ERP-04)', () => {
  const navegar = jasmine.createSpy('navigate');

  const correrGuards = async (rol: Rol): Promise<boolean> => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { authStatus: signal(AuthStatus.authenticated), rol: signal(rol), debeCambiarClave: signal(false) } },
        { provide: Router, useValue: { navigate: navegar } },
      ],
    });
    const admin = routes.find((r) => r.path === 'admin')!;
    const guards = (admin.canActivate ?? []) as CanActivateFn[];
    let pasa = true;
    for (const g of guards) {
      const r = await TestBed.runInInjectionContext(() => g({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
      if (r !== true) pasa = false;
    }
    return pasa;
  };

  it('el superadmin entra', async () => {
    expect(await correrGuards(Rol.SUPERADMIN)).toBeTrue();
  });

  it('un admin de taller, un mostrador o un chofer NO cargan la consola', async () => {
    for (const rol of [Rol.ADMIN, Rol.MOSTRADOR, Rol.CHOFER]) {
      expect(await correrGuards(rol)).withContext(rol).toBeFalse();
    }
  });
});

/**
 * SEG-54: con la clave provisoria del reseteo, la pantalla de cambio va antes
 * que cualquier otra. `/cambiar-clave` queda fuera del layout de /home.
 */
describe('Rutas raíz: la clave provisoria manda a /cambiar-clave (SEG-54)', () => {
  const navegar = jasmine.createSpy('navigate');
  const guardDe = (path: string) => ((routes.find((r) => r.path === path)!.canActivate ?? []) as CanActivateFn[])[0];

  const correr = async (path: string, url: string, debe: boolean): Promise<unknown> => {
    TestBed.resetTestingModule();
    navegar.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { authStatus: signal(AuthStatus.authenticated), rol: signal(Rol.TECNICO), debeCambiarClave: signal(debe) } },
        { provide: Router, useValue: { navigate: navegar } },
      ],
    });
    return TestBed.runInInjectionContext(() => guardDe(path)({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));
  };

  it('con el flag, /home rebota a /cambiar-clave y /cambiar-clave entra', async () => {
    expect(await correr('home', '/home/ordenes', true)).toBeFalse();
    expect(navegar).toHaveBeenCalledWith(['/cambiar-clave']);
    expect(await correr('cambiar-clave', '/cambiar-clave', true)).toBeTrue();
    expect(routes.find((r) => r.path === 'cambiar-clave')!.data).toEqual({ obligatorio: true });
  });

  it('sin el flag, /home entra como siempre', async () => {
    expect(await correr('home', '/home', false)).toBeTrue();
    expect(navegar).not.toHaveBeenCalled();
  });
});
