import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LOCALE_ID, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { of } from 'rxjs';
import { CuentasPorPagarComponent } from './cuentas-por-pagar.component';
import { DeudaProveedor, FinanceService } from '../services/finance.service';
import { ProveedorService } from '../../proveedores/services/proveedor.service';
import { NotificationService } from '../../../../core/services/notification.service';

/**
 * #18: la deuda es lo aprobado (lo que se puede pagar). Lo que espera una
 * firma se muestra aparte y cuenta para el aviso de límite de crédito.
 */
describe('CuentasPorPagarComponent — lo que espera firma (#18)', () => {
  let fixture: ComponentFixture<CuentasPorPagarComponent>;
  let filas: DeudaProveedor[];

  beforeAll(() => registerLocaleData(localeEsAr));

  beforeEach(() => {
    filas = [
      {
        proveedor_id: 'p1', proveedor: 'Repuestos SRL', comprobantes: 3,
        deuda: 600, vencido: 100, sin_aprobar: 500, sin_aprobar_vencido: 50,
        limite_credito: 1000, a_cuenta: 0, excede_limite: true,
      },
      {
        proveedor_id: 'p2', proveedor: 'Solo firma SA', comprobantes: 1,
        deuda: 0, vencido: 0, sin_aprobar: 200, sin_aprobar_vencido: 0,
        limite_credito: 0, a_cuenta: 0, excede_limite: false,
      },
    ];
    TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [CuentasPorPagarComponent],
      providers: [
        { provide: LOCALE_ID, useValue: 'es-AR' },
        { provide: FinanceService, useValue: { cuentasPorPagar: () => of(filas) } },
        { provide: ProveedorService, useValue: { getProveedores: () => of([]) } },
        { provide: NotificationService, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(CuentasPorPagarComponent);
    fixture.detectChanges();
  });

  const fila = (nombre: string): HTMLElement =>
    Array.from(fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLElement>)
      .find((f) => f.textContent!.includes(nombre))!;

  it('el aviso de límite usa lo que manda el backend (deuda + sin aprobar)', () => {
    const c = fixture.componentInstance;
    expect(c.excedeLimite(filas[0])).toBeTrue();
    // Sin el campo (backend viejo), se calcula igual: deuda + sin aprobar.
    expect(c.excedeLimite({ ...filas[0], excede_limite: undefined })).toBeTrue();
    expect(c.excedeLimite({ ...filas[0], excede_limite: undefined, sin_aprobar: 0 })).toBeFalse();
  });

  it('muestra lo que espera firma al lado de la deuda', () => {
    expect(fila('Repuestos SRL').textContent).toContain('esperan firma');
    expect(fila('Repuestos SRL').textContent).toContain('500');
  });

  it('un proveedor con todo sin aprobar no ofrece Pagar', () => {
    expect(fila('Solo firma SA').textContent).toContain('esperan firma');
    expect(fila('Solo firma SA').textContent).not.toContain('Pagar');
    expect(fila('Repuestos SRL').textContent).toContain('Pagar');
  });

  it('los totales separan lo exigible de lo que espera firma', () => {
    const c = fixture.componentInstance;
    expect(c.totalDeuda()).toBe(600);
    expect(c.totalSinAprobar()).toBe(700);
    expect(fixture.nativeElement.textContent).toContain('esperan firma');
  });
});
