import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { EmpleadosComponent, ordenesAbiertasDe } from './empleados.component';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../auth/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Empleado, Rol } from '../../../../core/interfaces/auth.interface';

describe('EmpleadosComponent (#2, CLI-18)', () => {
  let fixture: ComponentFixture<EmpleadosComponent>;
  let c: EmpleadosComponent;

  const lista: Empleado[] = [
    { id: 'u1', nombre: 'Dueño', email: 'admin@taller.local', rol: Rol.ADMIN, activo: true },
    { id: 'u2', nombre: 'Tito', email: 'tecnico@taller.local', rol: Rol.TECNICO, activo: true },
    { id: 'u3', nombre: 'Pía', email: 'panol@taller.local', rol: Rol.PANOL, activo: true },
    { id: 'u9', nombre: 'Admin Taller', email: 'admin@admin.com', rol: Rol.SUPERADMIN, activo: true },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EmpleadosComponent],
      imports: [CommonModule, ReactiveFormsModule, HttpClientTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: AuthService,
          useValue: {
            rol: () => Rol.ADMIN,
            currentUser: () => ({ id: 'u1', email: 'admin@taller.local', nombre: 'Dueño', rol: Rol.ADMIN }),
            listarEmpleados: () => of(lista),
            resetearClaveEmpleado: jasmine.createSpy('resetearClaveEmpleado').and.callFake((id: string) =>
              of({ id, nombre: 'Tito', email: 'tecnico@taller.local', rol: Rol.TECNICO, debe_cambiar_clave: true, clave_provisoria: 'abcDEF234567' }),
            ),
          },
        },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error']) },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EmpleadosComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
  });

  const fila = (nombre: string): HTMLElement =>
    Array.from(fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLElement>).find((tr) =>
      tr.textContent!.includes(nombre),
    )!;


  it('CLI-18: el superadmin sale como soporte, sin cambiar rol ni dar de baja', () => {
    const tr = fila('Admin Taller');
    expect(tr.textContent).toContain('Soporte de la plataforma');
    expect(tr.querySelector('select')).toBeNull();
    expect(tr.textContent).not.toContain('Dar de baja');
    expect(c.esSoporte(lista[1])).toBeFalse();
  });

  it('SEG-54: el admin resetea la clave de un empleado, confirma y ve la provisoria una sola vez', () => {
    const auth = TestBed.inject(AuthService) as any;
    expect(fila('Tito').textContent).toContain('Resetear clave');
    expect(fila('Dueño').textContent).not.toContain('Resetear clave');
    expect(fila('Admin Taller').textContent).not.toContain('Resetear clave');
    c.pedirReseteo(lista[1]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Resetear la clave de Tito');
    c.confirmarReseteo();
    expect(auth.resetearClaveEmpleado).toHaveBeenCalledOnceWith('u2');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.clave-provisoria').textContent).toContain('abcDEF234567');
    expect(fixture.nativeElement.textContent).toContain('No se vuelve a mostrar');
    c.cerrarProvisoria();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.clave-provisoria')).toBeNull();
    expect(c.claveProvisoria()).toBeNull();
  });

  it('SEG-54: ni la propia cuenta ni el soporte se resetean desde acá; el alta pide 10 caracteres', () => {
    c.pedirReseteo(lista[0]);
    c.pedirReseteo(lista[3]);
    expect(c.confirmandoReseteo()).toBeNull();
    c.empleadoForm.patchValue({ nombre: 'N', email: 'n@t.com', password: '123456789', rol: Rol.TECNICO });
    expect(c.empleadoForm.get('password')!.invalid).toBeTrue();
    c.empleadoForm.patchValue({ password: '1234567890' });
    expect(c.empleadoForm.get('password')!.valid).toBeTrue();
  });

  it('ordenesAbiertasDe ignora las entregadas y las de otros', () => {
    expect(ordenesAbiertasDe([{ numero_orden: 'A', estado: 'listo', tecnico_id: 'x' }], 'x')).toEqual(['A']);
    expect(ordenesAbiertasDe([{ numero_orden: 'B', estado: 'entregada', tecnico: { id: 'x' } }], 'x')).toEqual([]);
  });
});
