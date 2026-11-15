import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { EMPTY, of } from 'rxjs';

import { Rol } from '../../../core/interfaces/auth.interface';
import { AuthService } from '../../auth/services/auth.service';
import { AutosService } from '../autos/autos.service';
import { GlobalHeaderComponent } from './global-header.component';

/**
 * La barra de arriba: dice en qué pantalla estás y su buscador lleva al stock
 * con el término en la dirección. Los servicios se reemplazan por objetos mínimos.
 */
describe('GlobalHeaderComponent', () => {
  let navigate: jasmine.Spy;

  const armar = (rol: Rol, url: string) => {
    navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { rol: () => rol } },
        { provide: Router, useValue: { navigate, url, events: EMPTY } },
        { provide: AutosService, useValue: { sitio: () => of({ slug: 'demo' }) } },
      ],
    });
    return TestBed.runInInjectionContext(() => new GlobalHeaderComponent());
  };

  it('el buscador lleva al stock con el término recortado', () => {
    const c = armar(Rol.ADMIN, '/home');
    c.buscar('  hilux ');
    expect(navigate).toHaveBeenCalledWith(['/home/autos'], { queryParams: { q: 'hilux' } });
  });

  it('vacío muestra el stock entero', () => {
    const c = armar(Rol.ADMIN, '/home');
    c.buscar('   ');
    expect(navigate).toHaveBeenCalledWith(['/home/autos'], { queryParams: {} });
  });

  it('nombra la pantalla en la que estás', () => {
    expect(armar(Rol.ADMIN, '/home/autos/unidad/abc').donde()).toBe('Stock');
    TestBed.resetTestingModule();
    expect(armar(Rol.ADMIN, '/home/perfil').donde()).toBe('Mi perfil');
  });

  it('el botón de cargar un auto es del dueño y del vendedor', () => {
    expect(armar(Rol.MOSTRADOR, '/home').puedeCargar()).toBe(true);
    TestBed.resetTestingModule();
    expect(armar(Rol.TECNICO, '/home').puedeCargar()).toBe(false);
  });
});
