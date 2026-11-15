import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AuthService, FalloDeLogin, normalizarEmail } from './auth.service';
import { SocketService } from '../../../core/services/socket.service';
import { RecargaService } from '../../../core/services/recarga.service';
import { SIN_AVISO_DE_ERROR } from '../../../core/interceptors/sin-aviso.token';
import { AuthStatus } from '../../../core/interfaces/auth.interface';
import { environment } from '../../../../environments/environment';

describe('AuthService (CLI-04, CLI-05, CLI-17)', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let socket: { disconnect: jasmine.Spy };
  let recarga: { irDeCero: jasmine.Spy };
  const url = `${environment.apiUrl}/auth`;
  const perfil = { id: 'u1', nombre: 'Ana', email: 'ana@taller.local', rol: 'mostrador', companyId: 'c1' };

  beforeEach(() => {
    localStorage.removeItem('token');
    socket = { disconnect: jasmine.createSpy('disconnect') };
    recarga = { irDeCero: jasmine.createSpy('irDeCero') };
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: { navigate: () => {} } },
        { provide: SocketService, useValue: socket },
        { provide: RecargaService, useValue: recarga },
      ],
    });
    auth = TestBed.inject(AuthService); // sin token: no pide /me al crearse
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('token');
    sessionStorage.clear();
  });

  it('normalizarEmail saca espacios y mayúsculas', () => {
    expect(normalizarEmail('  Ana.Perez@Taller.Local ')).toBe('ana.perez@taller.local');
  });

  it('el login manda el correo en minúsculas y confirma la sesión con /auth/me antes de abrirla', () => {
    let ok: boolean | undefined;
    auth.login({ email: 'ana@taller.local', password: 'x' }).subscribe((r) => (ok = r));
    const login = http.expectOne(`${url}/login`);
    expect(login.request.body.email).toBe('ana@taller.local');
    expect(login.request.context.get(SIN_AVISO_DE_ERROR)).toBeFalse();
    login.flush({ ...perfil, token: 't1' });
    expect(auth.authStatus()).not.toBe(AuthStatus.authenticated);
    http.expectOne(`${url}/me`).flush(perfil);
    expect(ok).toBeTrue();
    expect(auth.authStatus()).toBe(AuthStatus.authenticated);
    expect(localStorage.getItem('token')).toBe('t1');
  });

  it('con mayúsculas prueba primero en minúsculas, callado, y si no existe reintenta como se escribió', () => {
    auth.login({ email: 'Padri@Gusmat.com', password: 'x' }).subscribe();
    const primero = http.expectOne(`${url}/login`);
    expect(primero.request.body.email).toBe('padri@gusmat.com');
    expect(primero.request.context.get(SIN_AVISO_DE_ERROR)).toBeTrue();
    primero.flush({ code: 'CREDENCIALES_INVALIDAS' }, { status: 401, statusText: 'Unauthorized' });
    const segundo = http.expectOne(`${url}/login`);
    expect(segundo.request.body.email).toBe('Padri@Gusmat.com');
    expect(segundo.request.context.get(SIN_AVISO_DE_ERROR)).toBeFalse();
    segundo.flush({ ...perfil, token: 't2' });
    http.expectOne(`${url}/me`).flush(perfil);
    expect(auth.authStatus()).toBe(AuthStatus.authenticated);
  });

  it('si el primer intento callado falla por otra cosa, no reintenta y la pantalla lo explica', () => {
    let error: unknown;
    auth.login({ email: 'Ana@taller.local', password: 'x' }).subscribe({ error: (e) => (error = e) });
    http.expectOne(`${url}/login`).flush({ code: 'DEMASIADOS_INTENTOS' }, { status: 429, statusText: 'Too Many' });
    expect(error).toEqual(jasmine.any(FalloDeLogin));
    expect((error as FalloDeLogin).tipo).toBe('sin_aviso');
  });

  it('CLI-04: un usuario dado de baja no queda con una sesión a medias', () => {
    let error: unknown;
    auth.login({ email: 'baja@taller.local', password: 'x' }).subscribe({ error: (e) => (error = e) });
    http.expectOne(`${url}/login`).flush({ ...perfil, token: 't3' });
    const me = http.expectOne(`${url}/me`);
    expect(me.request.context.get(SIN_AVISO_DE_ERROR)).toBeTrue();
    me.flush({ code: 'SESION_VENCIDA', message: 'User is inactive' }, { status: 401, statusText: 'Unauthorized' });
    expect((error as FalloDeLogin).tipo).toBe('sesion_rechazada');
    expect(auth.authStatus()).toBe(AuthStatus.notAuthenticated);
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('cerrarSesionLocal borra el token y corta el socket (CLI-05)', () => {
    localStorage.setItem('token', 'viejo');
    auth.cerrarSesionLocal();
    expect(localStorage.getItem('token')).toBeNull();
    expect(socket.disconnect).toHaveBeenCalled();
    expect(auth.authStatus()).toBe(AuthStatus.notAuthenticated);
  });

  it('DAT-04: cerrar sesión avisa al backend, vacía localStorage y sessionStorage y recarga en el login', () => {
    localStorage.setItem('token', 'vigente');
    localStorage.setItem('gm-ultima-actividad', '123');
    sessionStorage.setItem('oc-armador-borrador', '[{"id":"r1"}]');
    auth.logout();
    expect(recarga.irDeCero).not.toHaveBeenCalled(); // espera al backend: si no, el token sigue vivo allá
    http.expectOne(`${url}/logout`).flush({});
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(socket.disconnect).toHaveBeenCalled();
    expect(auth.authStatus()).toBe(AuthStatus.notAuthenticated);
    expect(recarga.irDeCero).toHaveBeenCalledOnceWith('/auth/login');
  });

  it('DAT-04: si el backend falla al cerrar, igual limpia todo y recarga', () => {
    localStorage.setItem('token', 'vencido');
    sessionStorage.setItem('algo', '1');
    auth.logout();
    http.expectOne(`${url}/logout`).flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.length).toBe(0);
    expect(recarga.irDeCero).toHaveBeenCalledOnceWith('/auth/login');
  });

  it('SEG-54: cambiar la clave manda actual y nueva, guarda el token nuevo y apaga el flag', () => {
    let ok: boolean | undefined;
    auth.cambiarClave('vieja-clave', 'nueva-clave-10').subscribe((r) => (ok = r));
    const req = http.expectOne(`${url}/cambiar-clave`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ actual: 'vieja-clave', nueva: 'nueva-clave-10' });
    req.flush({ ...perfil, token: 'token-nuevo', debe_cambiar_clave: false });
    expect(ok).toBeTrue();
    expect(localStorage.getItem('token')).toBe('token-nuevo');
    expect(auth.debeCambiarClave()).toBeFalse();
    expect(auth.authStatus()).toBe(AuthStatus.authenticated);
  });

  it('SEG-54: el perfil con debe_cambiar_clave prende el flag; resetear pega al endpoint del admin', () => {
    localStorage.setItem('token', 't');
    auth.checkAuthStatus().subscribe();
    http.expectOne(`${url}/me`).flush({ ...perfil, debe_cambiar_clave: true });
    expect(auth.debeCambiarClave()).toBeTrue();
    auth.resetearClaveEmpleado('u7').subscribe();
    const req = http.expectOne(`${url}/usuarios/u7/resetear-clave`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'u7', nombre: 'X', email: 'x@t', rol: 'tecnico', clave_provisoria: 'abcDEF234567' });
  });

  it('el alta de un empleado manda el correo normalizado', () => {
    auth.crearEmpleado({ nombre: 'B', email: ' Beto@Taller.local', password: '123456', rol: 'tecnico' as any }).subscribe();
    expect(http.expectOne(`${url}/register`).request.body.email).toBe('beto@taller.local');
  });
});
