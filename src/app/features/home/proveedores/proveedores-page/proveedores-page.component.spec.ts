import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProveedoresPageComponent } from './proveedores-page.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../auth/services/auth.service';

/** Solo la ficha (spec C §2.7): pide la URL y llena el panel. El alta/edición es plomería. */
describe('ProveedoresPageComponent · ficha', () => {
  let c: ProveedoresPageComponent;
  let http: HttpTestingController;
  const rol = signal<string | null>('admin');

  beforeEach(() => {
    rol.set('admin');
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: NotificationService, useValue: { success: () => {}, error: () => {} } },
        { provide: AuthService, useValue: { rol } },
      ],
    });
    c = TestBed.runInInjectionContext(() => new ProveedoresPageComponent());
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('verFicha pide GET /proveedores/:id/ficha y abre el panel con la respuesta', () => {
    c.verFicha({ id: 'p1' });
    expect(c.cargandoFicha()).toBeTrue();
    const req = http.expectOne(`${environment.apiUrl}/proveedores/p1/ficha`);
    expect(req.request.method).toBe('GET');
    req.flush({ proveedor: { id: 'p1', nombre: 'Centro' }, saldo: { deuda: 10, vencido: 0, a_cuenta: 0 }, ultimas_oc: [], repuestos: [], lead_time_promedio_dias: null, dias_entrega_cargado: 2 });
    expect(c.cargandoFicha()).toBeFalse();
    expect(c.fichaAbierta()?.proveedor.nombre).toBe('Centro');
    c.cerrarFicha();
    expect(c.fichaAbierta()).toBeNull();
  });

  it('SEG-51: editar y dar de baja, sólo admin, superadmin y mostrador; los demás ni abren el modal', () => {
    for (const r of ['admin', 'superadmin', 'mostrador']) {
      rol.set(r);
      expect(c.puedeEditar()).withContext(r).toBeTrue();
    }
    for (const r of ['panol', 'tecnico', 'chofer', null]) {
      rol.set(r);
      expect(c.puedeEditar()).withContext(String(r)).toBeFalse();
      c.openModal({ id: 'p1', nombre: 'Centro' });
      expect(c.showModal()).toBeFalse();
      c.pedirBaja({ id: 'p1' });
      expect(c.confirmandoBaja()).toBeNull();
    }
    // El alta sigue abierta.
    c.openModal();
    expect(c.showModal()).toBeTrue();
  });

  it('el select de IVA arranca en "no informada" y la etiqueta traduce el valor', () => {
    expect(c.form.value.condicion_iva).toBe('no_informada');
    expect(c.etiquetaIva('responsable_inscripto')).toBe('Responsable inscripto');
    expect(c.etiquetaIva(undefined)).toBe('No informada');
  });
});
