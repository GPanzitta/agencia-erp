import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { RecurrentesComponent } from './recurrentes.component';
import { FinanceService, Frecuencia, GastoRecurrente } from '../services/finance.service';
import { ProveedorService } from '../../proveedores/services/proveedor.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { CategoriaGasto, MetodoPagoGasto } from '../../../../core/interfaces/gastos.interface';

const plantilla = (p: Partial<GastoRecurrente>): GastoRecurrente => ({
  id: 'r1',
  descripcion: 'Alquiler',
  categoria: CategoriaGasto.SERVICIOS,
  monto: '1000',
  metodo_pago: MetodoPagoGasto.TRANSFERENCIA,
  frecuencia: Frecuencia.MENSUAL,
  dia_vencimiento: 10,
  fecha_inicio: '2026-01-10',
  fecha_fin: null,
  proveedor: null,
  proxima_generacion: '2026-11-10',
  activo: true,
  notas: null,
  ...p,
});

/** #16 y #42: gastos fijos que terminan, se extienden, se dan de baja y se reactivan. */
describe('RecurrentesComponent — estados, Reactivar y el aviso al guardar (#16 + #42)', () => {
  let fixture: ComponentFixture<RecurrentesComponent>;
  let c: RecurrentesComponent;
  let finance: jasmine.SpyObj<FinanceService>;
  let notification: jasmine.SpyObj<NotificationService>;

  const activa = plantilla({ id: 'a', descripcion: 'Internet' });
  const conFin = plantilla({ id: 'b', descripcion: 'Seguro', fecha_fin: '2027-03-31' });
  const finalizada = plantilla({ id: 'c', descripcion: 'Alquiler viejo', fecha_fin: '2026-10-31' });
  const baja = plantilla({ id: 'd', descripcion: 'Gimnasio', activo: false, proxima_generacion: '2026-07-10' });

  beforeEach(() => {
    finance = jasmine.createSpyObj<FinanceService>('FinanceService', [
      'listarRecurrentes', 'crearRecurrente', 'actualizarRecurrente', 'desactivarRecurrente',
      'generarRecurrentes', 'reactivarRecurrente',
    ]);
    finance.listarRecurrentes.and.returnValue(of([activa, conFin, finalizada, baja]));
    notification = jasmine.createSpyObj<NotificationService>('NotificationService', [
      'success', 'error', 'info', 'warning',
    ]);
    TestBed.configureTestingModule({
      imports: [CommonModule, ReactiveFormsModule],
      declarations: [RecurrentesComponent],
      providers: [
        { provide: FinanceService, useValue: finance },
        { provide: ProveedorService, useValue: { getProveedores: () => of([]) } },
        { provide: NotificationService, useValue: notification },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(RecurrentesComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
  });

  const fila = (texto: string): HTMLElement =>
    (Array.from(fixture.nativeElement.querySelectorAll('tbody tr')) as HTMLElement[]).find((f) =>
      f.textContent!.includes(texto),
    )!;

  it('estado(): activo, finalizado o baja', () => {
    expect(c.estado(activa)).toBe('activo');
    expect(c.estado(conFin)).toBe('activo');
    expect(c.estado(finalizada)).toBe('finalizado');
    expect(c.estado(baja)).toBe('baja');
  });

  it('el badge dice «Termina el», «Finalizó el» o «Dado de baja»', () => {
    expect(fila('Internet').textContent).toContain('Activo');
    expect(fila('Seguro').textContent).toContain('Termina el 31/03');
    expect(fila('Alquiler viejo').textContent).toContain('Finalizó el 31/10');
    expect(fila('Gimnasio').textContent).toContain('Dado de baja');
  });

  it('«Dar de baja» sólo en las activas y «Reactivar» sólo en las dadas de baja', () => {
    expect(fila('Internet').textContent).toContain('Dar de baja');
    expect(fila('Alquiler viejo').textContent).not.toContain('Dar de baja');
    expect(fila('Gimnasio').textContent).not.toContain('Dar de baja');
    expect(fila('Gimnasio').textContent).toContain('Reactivar');
    expect(fila('Internet').textContent).not.toContain('Reactivar');
  });

  it('el modal de Reactivar dice desde cuándo quedó pendiente y ofrece los dos modos', () => {
    c.reactivar(baja);
    fixture.detectChanges();
    const modal: HTMLElement = fixture.nativeElement.querySelector('.modal-reactivar');
    expect(modal.textContent).toContain('quedó pendiente desde el 10/07/2026');
    expect(modal.textContent).toContain('Generar desde el 10/07/2026');
    expect(modal.textContent).toContain('Retomar desde hoy');
  });

  it("«Generar desde el …» manda 'pendiente' y «Retomar desde hoy» manda 'hoy'", () => {
    finance.reactivarRecurrente.and.returnValue(of(plantilla({ id: 'd', activo: true })));
    c.reactivar(baja);
    c.confirmarReactivar('pendiente');
    expect(finance.reactivarRecurrente).toHaveBeenCalledWith('d', 'pendiente');

    c.reactivar(baja);
    c.confirmarReactivar('hoy');
    expect(finance.reactivarRecurrente).toHaveBeenCalledWith('d', 'hoy');
    expect(c.reactivarPendiente()).toBeNull();
    expect(notification.success).toHaveBeenCalled();
  });

  describe('guardar()', () => {
    it('manda Hasta, proveedor y notas en null cuando están vacíos, para poder borrarlos', () => {
      finance.actualizarRecurrente.and.returnValue(of(conFin));
      c.abrirModal(plantilla({ id: 'b', fecha_fin: '2027-03-31', proveedor: { id: 'p1', nombre: 'X' }, notas: 'n' }));
      c.form.patchValue({ fecha_fin: '', proveedor_id: '', notas: '' });
      c.guardar();
      const dto = finance.actualizarRecurrente.calls.mostRecent().args[1];
      expect(dto['fecha_fin']).toBeNull();
      expect(dto['proveedor_id']).toBeNull();
      expect(dto['notas']).toBeNull();
    });

    it('con valores, los manda tal cual', () => {
      finance.crearRecurrente.and.returnValue(of(activa));
      c.abrirModal();
      c.form.patchValue({ descripcion: 'Luz', monto: 10, fecha_fin: '2027-10-31', proveedor_id: 'p1', notas: 'n' });
      c.guardar();
      const dto = finance.crearRecurrente.calls.mostRecent().args[0];
      expect(dto['fecha_fin']).toBe('2027-10-31');
      expect(dto['proveedor_id']).toBe('p1');
      expect(dto['notas']).toBe('n');
    });

    it('si quedó finalizada, avisa que hay que extender «Hasta»', () => {
      finance.actualizarRecurrente.and.returnValue(of(finalizada));
      c.abrirModal(finalizada);
      c.guardar();
      expect(notification.warning).toHaveBeenCalledWith(jasmine.stringMatching(/extendé «Hasta»/));
    });

    it('si está dada de baja, avisa que hay que tocar Reactivar', () => {
      finance.actualizarRecurrente.and.returnValue(of(baja));
      c.abrirModal(baja);
      c.guardar();
      expect(notification.warning).toHaveBeenCalledWith(jasmine.stringMatching(/Reactivar/));
    });

    it('si sigue activa, sólo confirma', () => {
      finance.actualizarRecurrente.and.returnValue(of(activa));
      c.abrirModal(activa);
      c.guardar();
      expect(notification.success).toHaveBeenCalled();
      expect(notification.warning).not.toHaveBeenCalled();
    });
  });
});
