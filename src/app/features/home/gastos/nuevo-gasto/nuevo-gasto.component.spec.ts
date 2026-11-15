import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NuevoGastoComponent } from './nuevo-gasto.component';
import { ProveedorService } from '../../proveedores/services/proveedor.service';
import { ExpenseService } from '../services/expense.service';
import { NotificationService } from '../../../../core/services/notification.service';

/**
 * #8: al editar, el desglose se precarga solo si cierra con el total, y el
 * PATCH no manda un desglose que el operario no tocó.
 */
describe('NuevoGastoComponent — edición y desglose (#8)', () => {
  let c: NuevoGastoComponent;
  let expenses: { updateExpense: jasmine.Spy; createExpense: jasmine.Spy; uploadComprobante: jasmine.Spy };

  const gasto = (p: Record<string, unknown> = {}): any => ({
    id: 'g1',
    numero_gasto: 'GST-2026-0001',
    fecha: '2026-09-10T00:00:00.000Z',
    categoria: 'servicios',
    descripcion: 'Luz',
    monto: '121.00',
    neto: '100.00',
    iva: '21.00',
    percepciones: '0.00',
    tipo_comprobante: 'factura_a',
    punto_venta: '0003',
    metodo_pago: 'transferencia',
    notas: 'viejo',
    ...p,
  });

  /** Lo que viajó en el PATCH. */
  const payload = () => expenses.updateExpense.calls.mostRecent().args[1] as Record<string, unknown>;

  let notificacion: { warning: jasmine.Spy };

  beforeEach(() => {
    notificacion = { warning: jasmine.createSpy('warning') };
    expenses = {
      updateExpense: jasmine.createSpy('updateExpense').and.returnValue(of({})),
      createExpense: jasmine.createSpy('createExpense').and.returnValue(of({})),
      uploadComprobante: jasmine.createSpy('uploadComprobante'),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ProveedorService, useValue: { getProveedores: () => of([]) } },
        { provide: ExpenseService, useValue: expenses },
        { provide: NotificationService, useValue: notificacion },
      ],
    });
    c = TestBed.runInInjectionContext(() => new NuevoGastoComponent());
    c.ngOnInit();
  });

  it('un gasto con desglose que cierra carga con el desglose activo', () => {
    c.gastoAEditar = gasto();

    expect(c.conDesglose()).toBeTrue();
    expect(c.expenseForm.get('neto')!.value).toBe(100);
    expect(c.expenseForm.get('iva')!.value).toBe(21);
    expect(c.expenseForm.get('monto')!.disabled).toBeTrue();
    expect(c.expenseForm.get('monto')!.value).toBe(121);
    expect(c.expenseForm.get('tipo_comprobante')!.value).toBe('factura_a');
    expect(c.expenseForm.get('punto_venta')!.value).toBe('0003');
  });

  it('editar el desglose precargado manda el desglose y no el monto', () => {
    c.gastoAEditar = gasto();
    c.expenseForm.patchValue({ neto: 200, iva: 42 });

    c.onSubmit();

    expect(payload()).toEqual(jasmine.objectContaining({ neto: 200, iva: 42, percepciones: 0 }));
    expect('monto' in payload()).toBeFalse();
  });

  it('un gasto inconsistente (800 / 826,45 / 173,55) carga con el desglose apagado', () => {
    c.gastoAEditar = gasto({ monto: '800.00', neto: '826.45', iva: '173.55' });

    expect(c.conDesglose()).toBeFalse();
    expect(c.expenseForm.get('monto')!.enabled).toBeTrue();
    expect(c.expenseForm.get('monto')!.value).toBe(800);
  });

  it('y editarle solo las notas no manda desglose', () => {
    c.gastoAEditar = gasto({ monto: '800.00', neto: '826.45', iva: '173.55' });
    c.expenseForm.patchValue({ notas: 'nuevo' });

    c.onSubmit();

    expect(payload()).toEqual(jasmine.objectContaining({ monto: 800, notas: 'nuevo' }));
    expect('neto' in payload()).toBeFalse();
    expect('iva' in payload()).toBeFalse();
    expect('percepciones' in payload()).toBeFalse();
  });

  it('un IVA en «0.00» no activa el desglose', () => {
    c.gastoAEditar = gasto({ monto: '80.00', neto: '80.00', iva: '0.00' });

    expect(c.conDesglose()).toBeFalse();
    c.onSubmit();
    expect('neto' in payload()).toBeFalse();
  });

  it('destildar el desglose precargado manda el total y el desglose en 0', () => {
    c.gastoAEditar = gasto();
    c.toggleDesglose(false);
    c.expenseForm.patchValue({ monto: 150 });

    c.onSubmit();

    expect(payload()).toEqual(
      jasmine.objectContaining({ monto: 150, neto: 0, iva: 0, percepciones: 0 }),
    );
  });

  it('en el alta sin desglose no viajan neto, IVA ni percepciones', () => {
    c.showModal = true;
    c.expenseForm.patchValue({
      categoria: 'servicios', descripcion: 'Gas', monto: 50, metodo_pago: 'efectivo',
    });

    c.onSubmit();

    const body = expenses.createExpense.calls.mostRecent().args[0] as Record<string, unknown>;
    expect(body['monto']).toBe(50);
    expect('neto' in body).toBeFalse();
  });

  describe('un gasto en $0 por nota de crédito total', () => {
    const enCero = () => gasto({ monto: '0.00', neto: '0.00', iva: '0.00', percepciones: '0.00' });

    it('abre con el formulario válido y el aviso', () => {
      c.gastoAEditar = enCero();
      expect(c.expenseForm.valid).toBeTrue();
      expect(c.montoEnCero()).toBeTrue();
    });

    it('sin tocar el monto, el PATCH no manda monto ni desglose', () => {
      c.gastoAEditar = enCero();
      c.expenseForm.patchValue({ notas: 'NC total' });

      c.onSubmit();

      expect(expenses.updateExpense).toHaveBeenCalled();
      expect('monto' in payload()).toBeFalse();
      expect('neto' in payload()).toBeFalse();
      expect(payload()['notas']).toBe('NC total');
    });

    it('con un monto > 0 escrito, se manda normal', () => {
      c.gastoAEditar = enCero();
      c.expenseForm.patchValue({ monto: 300 });
      c.onSubmit();
      expect(payload()['monto']).toBe(300);
    });

    it('un gasto nuevo después vuelve a exigir monto > 0', () => {
      c.gastoAEditar = enCero();
      c.gastoAEditar = null;
      c.showModal = true;
      c.expenseForm.patchValue({ monto: 0 });
      expect(c.expenseForm.get('monto')!.valid).toBeFalse();
      expect(c.montoEnCero()).toBeFalse();
    });
  });

  it('si al subir el total el gasto vuelve a esperar firma, se avisa', () => {
    expenses.updateExpense.and.returnValue(of({ estado_aprobacion: 'pendiente' }));
    c.gastoAEditar = gasto({ estado_aprobacion: 'aprobado', neto: '121.00', iva: '0.00' });
    c.expenseForm.patchValue({ monto: 50000 });

    c.onSubmit();

    expect(notificacion.warning).toHaveBeenCalled();
    expect(notificacion.warning.calls.mostRecent().args[0]).toContain('firma');
  });

  it('si sigue aprobado, no avisa nada', () => {
    expenses.updateExpense.and.returnValue(of({ estado_aprobacion: 'aprobado' }));
    c.gastoAEditar = gasto({ estado_aprobacion: 'aprobado' });
    c.onSubmit();
    expect(notificacion.warning).not.toHaveBeenCalled();
  });
});
