import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../services/auth.service';
import { ConfirmarComponent } from './confirmar.component';

describe('ConfirmarComponent', () => {
  let auth: { confirmarCuenta: jasmine.Spy; reenviarConfirmacion: jasmine.Spy };
  const armar = (token: string | null) => {
    TestBed.configureTestingModule({
      declarations: [ConfirmarComponent],
      imports: [ReactiveFormsModule, RouterTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: NotificationService, useValue: { success: jasmine.createSpy(), error: jasmine.createSpy() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => token } } } },
      ],
    });
    const f = TestBed.createComponent(ConfirmarComponent);
    f.detectChanges();
    return f;
  };

  beforeEach(() => {
    auth = { confirmarCuenta: jasmine.createSpy().and.returnValue(of({ confirmada: true })), reenviarConfirmacion: jasmine.createSpy().and.returnValue(of({ enviado: true })) };
  });

  it('con un token bueno confirma y ofrece entrar', () => {
    const f = armar('tok');
    expect(auth.confirmarCuenta).toHaveBeenCalledWith('tok');
    expect((f.nativeElement as HTMLElement).textContent).toContain('Listo, ya podés entrar');
  });

  it('con un link vencido lo explica y deja pedir otro', () => {
    auth.confirmarCuenta.and.returnValue(throwError(() => ({ error: { code: 'CONFIRMACION_INVALIDA' } })));
    const f = armar('viejo');
    expect((f.nativeElement as HTMLElement).textContent).toContain('El link no es válido o venció');
    f.componentInstance.email.setValue('ana@mail.com');
    f.componentInstance.reenviar();
    expect(auth.reenviarConfirmacion).toHaveBeenCalledWith('ana@mail.com');
  });

  it('sin token no llama al backend', () => {
    const f = armar(null);
    expect(auth.confirmarCuenta).not.toHaveBeenCalled();
    expect((f.nativeElement as HTMLElement).textContent).toContain('El link no es válido o venció');
  });
});
