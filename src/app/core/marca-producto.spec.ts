import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { LoginComponent } from '../features/auth/login/login.component';
import { AuthService } from '../features/auth/services/auth.service';
import { Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { AppNavComponent } from '../features/home/app-nav/app-nav.component';
import { AutosService } from '../features/home/autos/autos.service';
import { NotificationService } from './services/notification.service';
import { INICIALES_PRODUCTO, NOMBRE_PRODUCTO } from './marca-producto';

/** El producto se llama FG autos: GUSMAT es un taller más (spec 2026-10-28 §11.1). */
describe('La marca del producto', () => {
  const avisos = { success: jasmine.createSpy(), error: jasmine.createSpy(), info: jasmine.createSpy(), warning: jasmine.createSpy() };

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [ReactiveFormsModule, RouterTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: AuthService, useValue: { currentUser: () => ({ nombre: 'Prueba' }) } },
        { provide: NotificationService, useValue: avisos },
      ],
    });
    TestBed.inject(Router);
  });

  it('se llama FG autos', () => {
    expect(NOMBRE_PRODUCTO).toBe('FG autos');
    expect(INICIALES_PRODUCTO).toBe('FG');
  });

  it('el login muestra el producto y no GUSMAT', () => {
    const f = TestBed.createComponent(LoginComponent);
    f.detectChanges();
    const texto = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('FG autos');
    expect((f.nativeElement as HTMLElement).querySelector('.login-tile')?.textContent?.trim()).toBe('FG');
    expect(texto).not.toContain('GUSMAT');
  });

  it('el menú muestra el producto y no GUSMAT', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { rol: () => null, currentUser: () => null, logout: () => undefined } },
        { provide: Router, useValue: { url: '/home', events: EMPTY } },
        { provide: AutosService, useValue: { pedidosDeReserva: () => EMPTY } },
      ],
    });
    const menu = TestBed.runInInjectionContext(() => new AppNavComponent());
    expect(menu.marca).toBe('FG autos');
    expect(menu.iniciales).toBe('FG');
  });
});
