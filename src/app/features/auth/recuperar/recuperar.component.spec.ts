import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NuevaClaveComponent } from '../nueva-clave/nueva-clave.component';
import { RecuperarComponent } from './recuperar.component';

describe('RecuperarComponent', () => {
  let auth: { pedirRecuperacion: jasmine.Spy };
  let c: RecuperarComponent;
  beforeEach(() => {
    auth = { pedirRecuperacion: jasmine.createSpy().and.returnValue(of({ enviado: true })) };
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }] });
    c = TestBed.runInInjectionContext(() => new RecuperarComponent());
  });

  it('un correo inválido no sale', () => {
    c.email.setValue('nada');
    c.enviar();
    expect(auth.pedirRecuperacion).not.toHaveBeenCalled();
    expect(c.enviado()).toBeFalse();
  });

  it('con un correo válido, pide el link y avisa sin decir si la cuenta existe', () => {
    c.email.setValue(' ana@mail.com ');
    c.enviar();
    expect(auth.pedirRecuperacion).toHaveBeenCalledWith('ana@mail.com');
    expect(c.enviado()).toBeTrue();
  });
});

describe('NuevaClaveComponent', () => {
  let auth: { cambiarClavePorCorreo: jasmine.Spy };
  const armar = (token: string | null) => {
    auth = { cambiarClavePorCorreo: jasmine.createSpy().and.returnValue(of({ cambiada: true })) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => token } } } },
      ],
    });
    return TestBed.runInInjectionContext(() => new NuevaClaveComponent());
  };

  it('sin token, ya dice que el link no sirve', () => {
    const c = armar(null);
    c.ngOnInit();
    expect(c.estado()).toBe('invalido');
  });

  it('una clave corta o que no coincide no sale', () => {
    const c = armar('tok');
    c.ngOnInit();
    c.form.setValue({ clave: 'corta', repetir: 'corta' });
    c.enviar();
    c.form.setValue({ clave: 'una-clave-larga-1', repetir: 'otra-clave-larga-1' });
    c.enviar();
    expect(auth.cambiarClavePorCorreo).not.toHaveBeenCalled();
    expect(c.distintas()).toBeTrue();
  });

  it('cambia la clave y ofrece entrar', () => {
    const c = armar('tok');
    c.ngOnInit();
    c.form.setValue({ clave: 'una-clave-larga-1', repetir: 'una-clave-larga-1' });
    c.enviar();
    expect(auth.cambiarClavePorCorreo).toHaveBeenCalledWith('tok', 'una-clave-larga-1');
    expect(c.estado()).toBe('ok');
  });

  it('si el link venció, lo dice y lleva a pedir otro', () => {
    const c = armar('tok');
    c.ngOnInit();
    auth.cambiarClavePorCorreo.and.returnValue(throwError(() => ({ status: 400 })));
    c.form.setValue({ clave: 'una-clave-larga-1', repetir: 'una-clave-larga-1' });
    c.enviar();
    expect(c.estado()).toBe('invalido');
  });
});
