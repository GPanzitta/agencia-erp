import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CambiarClaveComponent } from './cambiar-clave.component';
import { AuthService } from '../../auth/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RecargaService } from '../../../core/services/recarga.service';

/** SEG-54: «Cambiar mi clave» (perfil) y el cambio obligatorio después de un reseteo. */
describe('CambiarClaveComponent (SEG-54)', () => {
  let fixture: ComponentFixture<CambiarClaveComponent>;
  let c: CambiarClaveComponent;
  let auth: { currentUser: any; cambiarClave: jasmine.Spy; logout: jasmine.Spy };
  let recarga: { irDeCero: jasmine.Spy };
  let notification: jasmine.SpyObj<NotificationService>;

  const crear = (obligatorio: boolean) => {
    auth = {
      currentUser: signal({ id: 'u1', nombre: 'Ana', email: 'ana@taller.local' }),
      cambiarClave: jasmine.createSpy('cambiarClave').and.returnValue(of(true)),
      logout: jasmine.createSpy('logout'),
    };
    recarga = { irDeCero: jasmine.createSpy('irDeCero') };
    notification = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    TestBed.configureTestingModule({
      imports: [CambiarClaveComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: RecargaService, useValue: recarga },
        { provide: NotificationService, useValue: notification },
        { provide: ActivatedRoute, useValue: { snapshot: { data: obligatorio ? { obligatorio: true } : {} } } },
      ],
    });
    fixture = TestBed.createComponent(CambiarClaveComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
  };

  const llenar = (actual: string, nueva: string, repetida: string) => c.form.setValue({ actual, nueva, repetida });

  it('desde el perfil: pide la actual y la nueva dos veces; con todo bien cambia y recarga la app', () => {
    crear(false);
    expect(c.obligatorio).toBeFalse();
    expect(fixture.nativeElement.querySelectorAll('input[type=password]').length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Cambiar mi clave');
    llenar('clave-vieja', 'una-clave-nueva', 'una-clave-nueva');
    c.guardar();
    expect(auth.cambiarClave).toHaveBeenCalledOnceWith('clave-vieja', 'una-clave-nueva');
    expect(recarga.irDeCero).toHaveBeenCalledOnceWith('/home');
  });

  it('la nueva de menos de 10, o repetida distinta, no viaja', () => {
    crear(false);
    llenar('clave-vieja', 'corta', 'corta');
    c.guardar();
    llenar('clave-vieja', 'una-clave-nueva', 'otra-clave-nueva');
    c.guardar();
    expect(c.form.hasError('distintas')).toBeTrue();
    expect(auth.cambiarClave).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('no coinciden');
  });

  it('igual a la actual: avisa y no viaja', () => {
    crear(false);
    llenar('misma-clave-10', 'misma-clave-10', 'misma-clave-10');
    c.guardar();
    expect(notification.error).toHaveBeenCalled();
    expect(auth.cambiarClave).not.toHaveBeenCalled();
  });

  it('si el backend rechaza (clave actual mal), no recarga y deja volver a intentar', () => {
    crear(false);
    auth.cambiarClave.and.returnValue(throwError(() => ({ status: 400 })));
    llenar('mal', 'una-clave-nueva', 'una-clave-nueva');
    c.guardar();
    expect(recarga.irDeCero).not.toHaveBeenCalled();
    expect(c.guardando()).toBeFalse();
  });

  it('obligatorio (después del reseteo): lo dice, pide la provisoria y ofrece salir', () => {
    crear(true);
    expect(c.obligatorio).toBeTrue();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('clave provisoria');
    expect(texto).toContain('Clave provisoria');
    c.salir();
    expect(auth.logout).toHaveBeenCalled();
  });
});
