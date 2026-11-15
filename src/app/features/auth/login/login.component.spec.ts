import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../services/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent — cuenta sin confirmar', () => {
  const armar = (login: any) => {
    const auth = { login, reenviarConfirmacion: jasmine.createSpy().and.returnValue(of({ enviado: true })) };
    TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [ReactiveFormsModule, RouterTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [{ provide: AuthService, useValue: auth }, { provide: NotificationService, useValue: { success: jasmine.createSpy(), error: jasmine.createSpy() } }],
    });
    const f = TestBed.createComponent(LoginComponent);
    f.detectChanges();
    f.componentInstance.loginForm.patchValue({ email: 'ana@mail.com', password: 'una-clave-larga' });
    return { f, auth };
  };

  it('ofrece el link para registrar un taller', () => {
    const { f } = armar(jasmine.createSpy());
    const link = (f.nativeElement as HTMLElement).querySelector('[routerLink="/auth/registro"], a[href="/auth/registro"]');
    expect(link?.textContent).toContain('Registrate');
  });

  it('ante CUENTA_SIN_CONFIRMAR ofrece reenviar el correo', () => {
    const { f, auth } = armar(jasmine.createSpy().and.returnValue(throwError(() => ({ status: 401, error: { code: 'CUENTA_SIN_CONFIRMAR' } }))));
    f.componentInstance.onSubmit();
    f.detectChanges();
    const boton = (f.nativeElement as HTMLElement).querySelector('.login-reenviar') as HTMLButtonElement;
    expect(boton).not.toBeNull();
    boton.click();
    expect(auth.reenviarConfirmacion).toHaveBeenCalledWith('ana@mail.com');
  });

  it('otro error no ofrece reenviar', () => {
    const { f } = armar(jasmine.createSpy().and.returnValue(throwError(() => ({ status: 401, error: { code: 'CREDENCIALES_INVALIDAS' } }))));
    f.componentInstance.onSubmit();
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('.login-reenviar')).toBeNull();
  });
});
