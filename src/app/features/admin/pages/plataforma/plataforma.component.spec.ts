import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminService, TallerDePlataforma } from '../../services/admin.service';
import { PlataformaComponent } from './plataforma.component';

const DIA = 86400000;
const hace = (dias: number) => new Date(Date.now() - dias * DIA).toISOString();
const taller = (p: Partial<TallerDePlataforma>): TallerDePlataforma => ({
  id: 'a', nombre: 'Taller A', plan: 'gratis', estado: 'al_dia', vence_en: null,
  ultima_actividad: hace(1), ordenes_mes: 4, creado_en: hace(100), ...p,
});
const config = { precio_mensual: 25000, tope_ordenes_gratis: 30, dias_gracia: 7 };

describe('PlataformaComponent', () => {
  let f: ComponentFixture<PlataformaComponent>;
  let c: PlataformaComponent;
  let admin: Record<string, jasmine.Spy>;
  const el = () => f.nativeElement as HTMLElement;
  const texto = () => el().textContent ?? '';
  const filas = () => Array.from(el().querySelectorAll('tbody tr'));

  function armar(lista: TallerDePlataforma[]) {
    admin = {
      talleresPlataforma: jasmine.createSpy().and.returnValue(of(lista)),
      configPlataforma: jasmine.createSpy().and.returnValue(of(config)),
      cambiarPlanTaller: jasmine.createSpy().and.returnValue(of(undefined)),
      guardarConfigPlataforma: jasmine.createSpy().and.returnValue(of(config)),
    };
    TestBed.configureTestingModule({
      imports: [PlataformaComponent],
      providers: [{ provide: AdminService, useValue: admin }],
    });
    f = TestBed.createComponent(PlataformaComponent);
    c = f.componentInstance;
    f.detectChanges();
  }

  it('la tabla muestra taller, plan, estado, última actividad y órdenes del mes', () => {
    armar([taller({ plan: 'pago', estado: 'vencida', vence_en: '2026-11-01T12:00:00.000Z', ordenes_mes: 17 })]);
    const fila = filas()[0].textContent ?? '';
    expect(fila).toContain('Taller A');
    expect(fila).toContain('Pago');
    expect(fila).toContain('Vencida');
    expect(fila).toContain('1/11/2026');
    expect(fila).toContain('17');
  });

  it('los más inactivos van primero', () => {
    armar([taller({ id: '1', nombre: 'Reciente', ultima_actividad: hace(1) }), taller({ id: '2', nombre: 'Dormido', ultima_actividad: hace(40) })]);
    expect(filas()[0].textContent).toContain('Dormido');
  });

  it('marca a quien lleva 30 días o más sin actividad', () => {
    armar([taller({ id: '1', ultima_actividad: hace(31) }), taller({ id: '2', ultima_actividad: hace(29) })]);
    const marcadas = el().querySelectorAll('tr.inactivo');
    expect(marcadas.length).toBe(1);
    expect(marcadas[0].textContent).toContain('Sin actividad');
  });

  it('cambiar a pago exige fecha', () => {
    armar([taller({})]);
    c.editar(taller({}));
    c.planElegido.set('pago');
    c.fechaElegida.set('');
    c.guardarPlan();
    expect(admin['cambiarPlanTaller']).not.toHaveBeenCalled();
    expect(c.aviso()).toContain('fecha');
  });

  it('guarda el plan pago hasta el final de ese día, en hora argentina', () => {
    armar([taller({})]);
    c.editar(taller({}));
    c.planElegido.set('pago');
    c.fechaElegida.set('2026-12-01');
    c.guardarPlan();
    expect(admin['cambiarPlanTaller']).toHaveBeenCalledWith('a', { plan: 'pago', vence_en: '2026-12-01T23:59:59-03:00' });
    expect(admin['talleresPlataforma']).toHaveBeenCalledTimes(2);
  });

  it('los otros planes no mandan fecha', () => {
    armar([taller({ plan: 'pago' })]);
    c.editar(taller({ plan: 'pago' }));
    c.planElegido.set('interno');
    c.guardarPlan();
    expect(admin['cambiarPlanTaller']).toHaveBeenCalledWith('a', { plan: 'interno' });
  });

  it('si el backend rechaza el cambio, la fila sigue abierta para corregir', fakeAsync(() => {
    armar([taller({})]);
    admin['cambiarPlanTaller'].and.returnValue(throwError(() => new Error('x')));
    c.editar(taller({}));
    c.planElegido.set('gratis');
    c.guardarPlan();
    tick();
    expect(c.editando()).toBe('a');
  }));

  it('el formulario guarda los tres valores y aclara a qué suscripciones afecta el precio', () => {
    armar([]);
    expect(texto()).toContain('Vale para las suscripciones nuevas');
    c.precio.set(30000);
    c.tope.set(20);
    c.gracia.set(5);
    c.guardarConfig();
    expect(admin['guardarConfigPlataforma']).toHaveBeenCalledWith({ precio_mensual: 30000, tope_ordenes_gratis: 20, dias_gracia: 5 });
  });

  it('precarga los valores actuales', () => {
    armar([]);
    expect([c.precio(), c.tope(), c.gracia()]).toEqual([25000, 30, 7]);
  });
});
