import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { VencimientosComponent } from './vencimientos.component';
import { FinanceService } from '../services/finance.service';
import { NotificationService } from '../../../../core/services/notification.service';

/** #18: lo que espera una firma se ve, pero no se ofrece pagar. */
describe('VencimientosComponent — pendientes de firma (#18)', () => {
  let fixture: ComponentFixture<VencimientosComponent>;
  const manana = new Date(Date.now() + 86_400_000).toISOString();
  const fila = (p: Record<string, unknown>) => ({
    numero_gasto: 'GST-2026-0001', descripcion: 'Luz', proveedor: null,
    fecha_vencimiento: manana, total: 100, pendiente: 100, requiere_firma: false, ...p,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [VencimientosComponent],
      providers: [
        {
          provide: FinanceService,
          useValue: {
            vencimientos: () => of({
              proximo: {
                total: 150,
                gastos: [fila({ id: 'a' }), fila({ id: 'b', descripcion: 'Gas', pendiente: 50, total: 50, requiere_firma: true })],
              },
            }),
          },
        },
        { provide: NotificationService, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(VencimientosComponent);
    fixture.detectChanges();
  });

  it('puedePagar exige saldo y que no espere firma', () => {
    const c = fixture.componentInstance;
    expect(c.puedePagar({ pendiente: 10, requiere_firma: false })).toBeTrue();
    expect(c.puedePagar({ pendiente: 10, requiere_firma: true })).toBeFalse();
    expect(c.puedePagar({ pendiente: 0 })).toBeFalse();
  });

  it('el pendiente de firma muestra el aviso y no el botón Pagar', () => {
    const filas: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('tbody tr'));
    const luz = filas.find((f) => f.textContent!.includes('Luz'))!;
    const gas = filas.find((f) => f.textContent!.includes('Gas'))!;

    expect(luz.textContent).toContain('Pagar');
    expect(luz.textContent).not.toContain('Requiere firma');
    expect(gas.textContent).toContain('Requiere firma');
    expect(gas.textContent).not.toContain('Pagar');
  });
});
