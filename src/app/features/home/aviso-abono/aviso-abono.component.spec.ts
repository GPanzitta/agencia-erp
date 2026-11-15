import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AbonoService, RespuestaAbono } from '../../../core/services/abono.service';
import { Rol } from '../../../core/interfaces/auth.interface';
import { AuthService } from '../../auth/services/auth.service';
import { AvisoAbonoComponent } from './aviso-abono.component';

const base: RespuestaAbono = {
  plan: 'gratis', estado: 'al_dia', vence_en: null, gracia_hasta: null, ordenes_mes: 3, tope: 30,
  precio_mensual: 25000, preapproval_estado: null, pago_simulado: false,
};

describe('AvisoAbonoComponent', () => {
  let f: ComponentFixture<AvisoAbonoComponent>;
  let refrescar: jasmine.Spy;
  const estado = signal<RespuestaAbono | null>(null);
  const rol = signal<Rol | null>(Rol.ADMIN);
  const texto = () => (f.nativeElement as HTMLElement).textContent ?? '';
  const boton = () => (f.nativeElement as HTMLElement).querySelector('a');

  function mostrar(cambios: Partial<RespuestaAbono>) {
    estado.set({ ...base, ...cambios });
    f.detectChanges();
  }

  beforeEach(() => {
    estado.set(null);
    rol.set(Rol.ADMIN);
    refrescar = jasmine.createSpy('refrescar').and.resolveTo();
    TestBed.configureTestingModule({
      declarations: [AvisoAbonoComponent],
      imports: [RouterTestingModule],
      providers: [
        { provide: AbonoService, useValue: { estado, refrescar } },
        { provide: AuthService, useValue: { rol } },
      ],
    });
    f = TestBed.createComponent(AvisoAbonoComponent);
  });

  it('al día, sin tope cerca, no muestra nada', () => {
    mostrar({});
    expect(texto().trim()).toBe('');
  });

  it('vencido dice hasta qué fecha hay tiempo', () => {
    mostrar({ plan: 'pago', estado: 'vencida', vence_en: '2026-11-01T12:00:00.000Z', gracia_hasta: '2026-11-08T12:00:00.000Z' });
    expect(texto()).toContain('venció el 1/11/2026');
    expect(texto()).toContain('hasta el 8/11/2026');
  });

  it('en sólo lectura dice qué se puede hacer y que el cliente no se entera', () => {
    mostrar({ plan: 'pago', estado: 'solo_lectura' });
    expect(texto()).toContain('Podés ver y exportar todo, pero no cargar nada nuevo');
    expect(texto()).toContain('Tus clientes no se enteran');
  });

  it('con 25 de 30 unidades en stock avisa cuánto lugar queda', () => {
    mostrar({ ordenes_mes: 25 });
    expect(texto()).toContain('Te queda lugar para 5 unidades más');
  });

  it('con 24 de 30 todavía no molesta', () => {
    mostrar({ ordenes_mes: 24 });
    expect(texto().trim()).toBe('');
  });

  it('con lugar para una sola lo dice en singular', () => {
    mostrar({ ordenes_mes: 29 });
    expect(texto()).toContain('Te queda lugar para 1 unidad más');
  });

  it('en el tope dice cómo seguir ingresando', () => {
    mostrar({ ordenes_mes: 30 });
    expect(texto()).toContain('Llegaste a las 30 unidades en stock');
  });

  it('el plan interno, sin tope, no avisa aunque tenga muchas unidades', () => {
    mostrar({ plan: 'interno', tope: null, ordenes_mes: 900 });
    expect(texto().trim()).toBe('');
  });

  it('el admin ve el camino a la pantalla de abono', () => {
    mostrar({ plan: 'pago', estado: 'solo_lectura' });
    expect(boton()?.getAttribute('href')).toBe('/home/configuracion/abono');
  });

  it('un empleado lee que le avise al dueño y no ve el botón de pagar', () => {
    rol.set(Rol.MOSTRADOR);
    mostrar({ plan: 'pago', estado: 'solo_lectura' });
    expect(texto()).toContain('Avisale al dueño de la agencia');
    expect(boton()).toBeNull();
  });

  it('pide el estado al entrar', () => {
    f.detectChanges();
    expect(refrescar).toHaveBeenCalled();
  });

  it('el superadmin, sin taller, no lo pide', () => {
    rol.set(Rol.SUPERADMIN);
    f.detectChanges();
    expect(refrescar).not.toHaveBeenCalled();
  });
});
