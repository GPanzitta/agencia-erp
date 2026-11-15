import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../services/auth.service';
import { RegistroComponent } from './registro.component';

describe('RegistroComponent', () => {
  let f: ComponentFixture<RegistroComponent>;
  let c: RegistroComponent;
  let auth: { registrarTaller: jasmine.Spy; reenviarConfirmacion: jasmine.Spy };
  const avisos = { success: jasmine.createSpy(), error: jasmine.createSpy(), info: jasmine.createSpy(), warning: jasmine.createSpy() };
  const completo = { taller: 'Taller Ñandú', nombre: 'Ana Paz', email: 'ana@mail.com', telefono: '1155550000', clave: 'una-clave-larga' };
  const texto = () => (f.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    auth = { registrarTaller: jasmine.createSpy().and.returnValue(of({ enviado: true })), reenviarConfirmacion: jasmine.createSpy().and.returnValue(of({ enviado: true })) };
    TestBed.configureTestingModule({
      declarations: [RegistroComponent],
      imports: [ReactiveFormsModule, RouterTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [{ provide: AuthService, useValue: auth }, { provide: NotificationService, useValue: avisos }],
    });
    f = TestBed.createComponent(RegistroComponent);
    c = f.componentInstance;
    f.detectChanges();
  });

  it('no llama al backend si falta algo', () => {
    c.form.patchValue({ ...completo, telefono: '' });
    c.enviar();
    expect(auth.registrarTaller).not.toHaveBeenCalled();
  });

  it('exige un correo válido y una clave de 10 o más', () => {
    c.form.patchValue({ ...completo, email: 'nada' });
    expect(c.form.invalid).toBeTrue();
    c.form.patchValue({ ...completo, clave: 'corta' });
    expect(c.form.invalid).toBeTrue();
    c.form.patchValue(completo);
    expect(c.form.valid).toBeTrue();
  });

  it('manda los datos con los rubros elegidos y muestra que revise el correo', () => {
    c.form.patchValue(completo);
    c.alternarRubro('Heladeras');
    c.alternarRubro('Aires');
    c.alternarRubro('Aires');
    c.enviar();
    expect(auth.registrarTaller).toHaveBeenCalledWith(jasmine.objectContaining({ ...completo, rubros: ['Heladeras'] }));
    f.detectChanges();
    expect(texto()).toContain('Te mandamos un correo a ana@mail.com');
    expect(c.form.value.clave).toBe('');
  });

  it('si el correo no salió, lo dice y deja reenviar', () => {
    auth.registrarTaller.and.returnValue(of({ enviado: false }));
    c.form.patchValue(completo);
    c.enviar();
    f.detectChanges();
    expect(texto()).toContain('No pudimos mandar el correo');
    c.reenviar();
    expect(auth.reenviarConfirmacion).toHaveBeenCalledWith('ana@mail.com');
  });

  it('el campo trampa viaja en el cuerpo pero una persona no lo ve ni lo alcanza con el teclado', () => {
    const trampa = (f.nativeElement as HTMLElement).querySelector('input[formcontrolname="sitio_web"]') as HTMLInputElement;
    expect(trampa.tabIndex).toBe(-1);
    expect(trampa.closest('[aria-hidden="true"]')).not.toBeNull();
    c.form.patchValue({ ...completo, sitio_web: 'http://spam' });
    c.enviar();
    expect(auth.registrarTaller).toHaveBeenCalledWith(jasmine.objectContaining({ sitio_web: 'http://spam' }));
  });
});
