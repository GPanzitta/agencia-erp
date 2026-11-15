import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { AbonoService, RespuestaAbono } from '../../../../core/services/abono.service';
import { AuthService } from '../../../auth/services/auth.service';
import { AbonoComponent } from './abono.component';

const base: RespuestaAbono = {
  plan: 'gratis', estado: 'al_dia', vence_en: null, gracia_hasta: null, ordenes_mes: 12, tope: 30,
  precio_mensual: 25000, preapproval_estado: null, pago_simulado: false, pagos: [],
};

describe('AbonoComponent', () => {
  let f: ComponentFixture<AbonoComponent>;
  let c: AbonoComponent;
  const estado = signal<RespuestaAbono | null>(null);
  let abono: { estado: typeof estado; refrescar: jasmine.Spy; suscribir: jasmine.Spy; volverAGratis: jasmine.Spy; simularPago: jasmine.Spy };
  const el = () => f.nativeElement as HTMLElement;
  const texto = () => el().textContent ?? '';
  const boton = (t: string) => Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes(t));

  function armar(cambios: Partial<RespuestaAbono> = {}, query: Record<string, string> = {}) {
    estado.set({ ...base, ...cambios });
    TestBed.configureTestingModule({
      declarations: [AbonoComponent],
      imports: [FormsModule],
      providers: [
        { provide: AbonoService, useValue: abono },
        { provide: AuthService, useValue: { currentUser: () => ({ email: 'duenio@taller.com' }) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    f = TestBed.createComponent(AbonoComponent);
    c = f.componentInstance;
    f.detectChanges();
  }

  beforeEach(() => {
    abono = {
      estado,
      refrescar: jasmine.createSpy('refrescar').and.resolveTo(),
      suscribir: jasmine.createSpy('suscribir').and.resolveTo({ init_point: 'https://www.mercadopago.com.ar/x' }),
      volverAGratis: jasmine.createSpy('volverAGratis').and.resolveTo(),
      simularPago: jasmine.createSpy('simularPago').and.resolveTo(),
    };
  });

  it('muestra el plan, el uso del mes y el precio', () => {
    armar();
    expect(texto()).toContain('Plan gratis');
    expect(texto()).toContain('12 de 30');
    expect(texto()).toContain('$25.000');
  });

  it('el plan pago muestra hasta cuándo está pagado', () => {
    armar({ plan: 'pago', tope: null, vence_en: '2026-12-04T12:00:00.000Z', preapproval_estado: 'authorized' });
    expect(texto()).toContain('4/12/2026');
  });

  it('muestra los pagos', () => {
    armar({ pagos: [{ mp_pago_id: 'p1', monto: 25000, pagado_en: '2026-11-04T12:00:00.000Z' }] });
    expect(texto()).toContain('4/11/2026');
  });

  it('el correo sale precargado, se puede cambiar y aclara de qué cuenta tiene que ser', () => {
    armar();
    expect(c.correo()).toBe('duenio@taller.com');
    expect(texto()).toContain('el de la cuenta de Mercado Pago que va a pagar');
  });

  it('suscribirse lleva al link de Mercado Pago', fakeAsync(() => {
    armar();
    const ir = spyOn(c, 'irA');
    c.correo.set('otra@cuenta.com');
    c.suscribir();
    tick();
    expect(abono.suscribir).toHaveBeenCalledWith('otra@cuenta.com');
    expect(ir).toHaveBeenCalledWith('https://www.mercadopago.com.ar/x');
  }));

  it('sin correo no llama a nadie', fakeAsync(() => {
    armar();
    c.correo.set('  ');
    c.suscribir();
    tick();
    expect(abono.suscribir).not.toHaveBeenCalled();
  }));

  it('si falla, el botón vuelve a estar disponible (el aviso lo da el interceptor)', fakeAsync(() => {
    armar();
    abono.suscribir.and.rejectWith(new Error('x'));
    c.suscribir();
    tick();
    expect(c.ocupado()).toBeFalse();
  }));

  it('al volver de Mercado Pago, sin el pago confirmado, dice que espera y deja actualizar', () => {
    armar({}, { volver: '1' });
    expect(texto()).toContain('Estamos esperando la confirmación de Mercado Pago');
    abono.refrescar.calls.reset();
    boton('Actualizar')!.click();
    expect(abono.refrescar).toHaveBeenCalled();
  });

  it('con el pago ya confirmado no dice que espera', () => {
    armar({ plan: 'pago', tope: null, vence_en: '2026-12-04T12:00:00.000Z' }, { volver: '1' });
    expect(texto()).not.toContain('Estamos esperando');
  });

  it('en la demo aparece «Simular pago» y refresca', fakeAsync(() => {
    armar({ pago_simulado: true });
    boton('Simular pago')!.click();
    tick();
    expect(abono.simularPago).toHaveBeenCalled();
    expect(abono.refrescar).toHaveBeenCalled();
  }));

  it('fuera de la demo no aparece', () => {
    armar();
    expect(boton('Simular pago')).toBeUndefined();
  });

  it('volver al plan gratis pide confirmación y avisa lo que se pierde', fakeAsync(() => {
    armar({ plan: 'pago', tope: null, vence_en: '2026-12-04T12:00:00.000Z', preapproval_estado: 'authorized' });
    boton('Volver al plan gratis')!.click();
    f.detectChanges();
    expect(abono.volverAGratis).not.toHaveBeenCalled();
    expect(texto()).toContain('perdés lo que quede del mes pagado');
    boton('Sí, volver')!.click();
    tick();
    expect(abono.volverAGratis).toHaveBeenCalled();
  }));

  it('con la suscripción al día no ofrece suscribirse de nuevo', () => {
    armar({ plan: 'pago', tope: null, vence_en: '2099-01-01T12:00:00.000Z', preapproval_estado: 'authorized' });
    expect(boton('Suscribirme')).toBeUndefined();
  });

  it('con el cobro trabado sí deja pagar de nuevo', () => {
    armar({ plan: 'pago', estado: 'solo_lectura', tope: null, vence_en: '2020-01-01T12:00:00.000Z', preapproval_estado: 'authorized' });
    expect(boton('Suscribirme')).toBeDefined();
  });

  it('mientras espera a Mercado Pago no ofrece suscribirse de nuevo: se cobraría dos veces', () => {
    armar({ preapproval_estado: 'pending' }, { volver: '1' });
    expect(boton('Suscribirme')).toBeUndefined();
  });

  it('con el primer cobro sin salir no ofrece suscribirse, pero deja cancelar', () => {
    armar({ preapproval_estado: 'authorized' });
    expect(boton('Suscribirme')).toBeUndefined();
    expect(boton('Volver al plan gratis')).toBeDefined();
  });

  it('un plan gratis sin suscripción no ofrece volver a gratis', () => {
    armar();
    expect(boton('Volver al plan gratis')).toBeUndefined();
  });

  it('el plan interno no ofrece nada de pago', () => {
    armar({ plan: 'interno', tope: null });
    expect(texto()).toContain('no paga abono');
    expect(boton('Suscribirme')).toBeUndefined();
    expect(boton('Volver al plan gratis')).toBeUndefined();
  });
});
