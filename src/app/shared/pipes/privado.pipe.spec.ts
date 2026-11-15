import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { Rol } from '../../core/interfaces/auth.interface';
import { AuthService } from '../../features/auth/services/auth.service';
import { PrivadoPipe } from './privado.pipe';

describe('PrivadoPipe (DAT-02)', () => {
  let rol: WritableSignal<Rol | null>;
  let pipe: PrivadoPipe;

  beforeEach(() => {
    rol = signal<Rol | null>(Rol.TECNICO);
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { rol } }] });
    pipe = TestBed.runInInjectionContext(() => new PrivadoPipe());
  });

  it('al técnico y al chofer les tapa teléfono, correo y DNI', () => {
    expect(pipe.transform('11 5566-7788', 'telefono')).toBe('•••• 7788');
    expect(pipe.transform('juliana@gmail.com', 'email')).toBe('j•••@gmail.com');
    rol.set(Rol.CHOFER);
    expect(pipe.transform('30.123.678', 'documento')).toBe('•••• 678');
  });

  it('al mostrador se los muestra completos', () => {
    rol.set(Rol.MOSTRADOR);
    expect(pipe.transform('11 5566-7788', 'telefono')).toBe('11 5566-7788');
  });

  it('lo que el backend ya mandó tapado pasa tal cual (sin puntos de más)', () => {
    expect(pipe.transform('•••• 7788', 'telefono')).toBe('•••• 7788');
    expect(pipe.transform('j•••@gmail.com', 'email')).toBe('j•••@gmail.com');
    expect(pipe.transform('•••• 678', 'documento')).toBe('•••• 678');
  });

  it('vacío o null queda vacío', () => {
    expect(pipe.transform(null, 'telefono')).toBe('');
    expect(pipe.transform(undefined, 'email')).toBe('');
  });
});
