import { HttpContext, HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActiveToast, ToastrService } from 'ngx-toastr';
import { Subject, throwError } from 'rxjs';

import { SIN_AVISO_DE_ERROR, errorInterceptor } from './error.interceptor';
import { AuthService } from '../../features/auth/services/auth.service';
import { AuthStatus } from '../interfaces/auth.interface';

describe('errorInterceptor', () => {
  let toastr: jasmine.SpyObj<ToastrService>;
  let router: jasmine.SpyObj<Router>;
  let onTap: Subject<undefined>;

  beforeEach(() => {
    onTap = new Subject<undefined>();
    toastr = jasmine.createSpyObj('ToastrService', ['error']);
    // Un spy sin returnValue da `undefined`: el interceptor nunca llega a
    // suscribirse a `onTap` y ningún test detecta si esa suscripción se
    // rompe. ngx-toastr sí devuelve un ActiveToast real desde `.error()`,
    // así que lo simulamos con un `onTap` de verdad para poder emitirlo.
    toastr.error.and.returnValue({ onTap } as unknown as ActiveToast<unknown>);
    router = jasmine.createSpyObj('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({
      providers: [
        { provide: ToastrService, useValue: toastr },
        { provide: Router, useValue: router },
      ],
    });
  });

  function correr(body: any, status = 400, context?: HttpContext) {
    const req = new HttpRequest('GET', '/api/x', context ? { context } : undefined);
    const next: HttpHandlerFn = () =>
      throwError(() => new HttpErrorResponse({ status, error: body }));
    let errorRecibido: unknown;
    TestBed.runInInjectionContext(() => {
      errorInterceptor(req, next).subscribe({ next: () => {}, error: (e) => (errorRecibido = e) });
    });
    return errorRecibido;
  }

  it('muestra el título traducido, no el mensaje crudo del backend', () => {
    correr({ code: 'CAJA_CERRADA', message: 'No hay una caja abierta: abrí un turno...' });
    const [detalle, titulo] = toastr.error.calls.mostRecent().args;
    expect(titulo).toBe('No hay una caja abierta');
    expect(detalle).toContain('turno de caja abierto');
  });

  // CAJA_CERRADA y SIN_RESPALDO_DE_COMPRA tienen accion; CUPO_COMPLETO no.
  it('cuando hay acción, el detalle invita a tocar el aviso', () => {
    correr({ code: 'SIN_RESPALDO_DE_COMPRA', message: 'x' });
    const [detalle] = toastr.error.calls.mostRecent().args;
    expect(detalle).toContain('Tocá este aviso');
    expect(detalle).toContain('ir a compras');
  });

  it('no invita a tocar cuando el código no tiene acción', () => {
    correr({ code: 'CUPO_COMPLETO', message: 'x' });
    const [detalle] = toastr.error.calls.mostRecent().args;
    expect(detalle).not.toContain('Tocá este aviso');
  });

  it('un código desconocido igual muestra algo entendible', () => {
    correr({ code: 'LO_QUE_SEA', message: 'Algo pasó' });
    const [detalle, titulo] = toastr.error.calls.mostRecent().args;
    expect(titulo).toBe('No se pudo completar');
    expect(detalle).toContain('LO_QUE_SEA');
  });

  it('al tocar un toast con acción, navega a la ruta de esa acción', () => {
    correr({ code: 'SIN_RESPALDO_DE_COMPRA', message: 'x' });
    expect(router.navigateByUrl).not.toHaveBeenCalled();

    onTap.next(undefined);

    expect(router.navigateByUrl).toHaveBeenCalledWith('/home/gastos/purchase-orders');
  });

  it('el toast queda configurado para cerrarse solo al tocarlo (tapToDismiss)', () => {
    correr({ code: 'SIN_RESPALDO_DE_COMPRA', message: 'x' });
    const opciones = toastr.error.calls.mostRecent().args[2] as { tapToDismiss?: boolean };
    // ngx-toastr solo remueve el toast en tapToast() cuando tapToDismiss es
    // true (toast.component.mjs). En false, el aviso sobrevive a la
    // navegación que él mismo dispara y queda flotando encima.
    expect(opciones.tapToDismiss).toBe(true);
  });

  it('no tocar un toast sin acción no navega a ningún lado', () => {
    correr({ code: 'CUPO_COMPLETO', message: 'x' });

    onTap.next(undefined);

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('SEG-54: un 403 DEBE_CAMBIAR_CLAVE va a /cambiar-clave sin toast (serían uno por pedido)', () => {
    const e = correr({ code: 'DEBE_CAMBIAR_CLAVE', message: 'Tenés que cambiar la clave provisoria' }, 403);
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/cambiar-clave');
    expect(toastr.error).not.toHaveBeenCalled();
    expect(e).toEqual(jasmine.any(HttpErrorResponse));
  });

  it('SEG-54: la clave actual mal se explica con su título', () => {
    correr({ code: 'CLAVE_ACTUAL_INCORRECTA', message: 'La clave actual no es esa.' });
    expect(toastr.error.calls.mostRecent().args[1]).toBe('La clave actual no es esa');
  });

  it('propaga el error para que quien hizo el pedido pueda manejarlo', () => {
    const errorRecibido = correr({ code: 'CAJA_CERRADA', message: 'x' }, 409);
    expect(errorRecibido).toBeInstanceOf(HttpErrorResponse);
    expect((errorRecibido as HttpErrorResponse).status).toBe(409);
  });

  // Los PDF se piden con responseType 'blob': si el backend contesta un error, el
  // cuerpo (JSON con el code) llega como Blob y hay que leerlo para traducirlo.
  describe('cuando el cuerpo del error es un Blob', () => {
    function correrBlob(texto: string, status = 409): Promise<unknown> {
      const req = new HttpRequest('GET', '/api/x');
      const next: HttpHandlerFn = () =>
        throwError(() => new HttpErrorResponse({ status, error: new Blob([texto], { type: 'application/json' }) }));
      return new Promise((resolve) => {
        TestBed.runInInjectionContext(() => {
          errorInterceptor(req, next).subscribe({ next: () => {}, error: (e) => resolve(e) });
        });
      });
    }

    it('lee el JSON del Blob y muestra el mensaje traducido del code', async () => {
      await correrBlob(JSON.stringify({ code: 'DOCUMENTO_NO_DISPONIBLE', message: 'x', tipo: 'acta_entrega' }));
      const [detalle, titulo] = toastr.error.calls.mostRecent().args;
      expect(titulo).toBe('Ese documento no corresponde al estado de la orden');
      expect(detalle).toContain('El acta de entrega');
      expect(toastr.error).toHaveBeenCalledTimes(1);
    });

    it('propaga el error con el cuerpo ya leído', async () => {
      const e = (await correrBlob(JSON.stringify({ code: 'DOCUMENTO_NO_DISPONIBLE', tipo: 'presupuesto' }))) as HttpErrorResponse;
      expect(e.status).toBe(409);
      expect(e.error.code).toBe('DOCUMENTO_NO_DISPONIBLE');
    });

    it('un Blob que no es JSON cae en el aviso genérico, sin romper', async () => {
      await correrBlob('<html>502 Bad Gateway</html>', 502);
      expect(toastr.error).toHaveBeenCalledTimes(1);
      const [, titulo] = toastr.error.calls.mostRecent().args;
      expect(titulo).toBeTruthy();
    });
  });

  // Ruling 8: algunos pedidos manejan su propio error (p. ej.
  // `registrarEnvio` de mensajes.service.ts, donde WhatsApp ya se abrió) y no
  // quieren que el interceptor les tape la pantalla con un toast.
  it('con el token SIN_AVISO_DE_ERROR no muestra ningún toast', () => {
    const contexto = new HttpContext().set(SIN_AVISO_DE_ERROR, true);
    correr({ code: 'CAJA_CERRADA', message: 'x' }, 500, contexto);
    expect(toastr.error).not.toHaveBeenCalled();
  });

  it('con el token SIN_AVISO_DE_ERROR el error igual llega a quien hizo el pedido', () => {
    const contexto = new HttpContext().set(SIN_AVISO_DE_ERROR, true);
    const errorRecibido = correr({ code: 'CAJA_CERRADA', message: 'x' }, 500, contexto);
    expect(errorRecibido).toBeInstanceOf(HttpErrorResponse);
    expect((errorRecibido as HttpErrorResponse).status).toBe(500);
  });

  describe('CLI-04: un 401 fuera del login cierra la sesión del navegador', () => {
    let estado: AuthStatus;
    let auth: { authStatus: () => AuthStatus; cerrarSesionLocal: jasmine.Spy };

    const correrEn = (url: string, status = 401, body: any = { code: 'SESION_VENCIDA', message: 'User is inactive' }) => {
      const req = new HttpRequest('GET', url);
      const next: HttpHandlerFn = () => throwError(() => new HttpErrorResponse({ status, error: body }));
      TestBed.runInInjectionContext(() => {
        errorInterceptor(req, next).subscribe({ error: () => {} });
      });
    };

    beforeEach(() => {
      estado = AuthStatus.authenticated;
      auth = {
        authStatus: () => estado,
        cerrarSesionLocal: jasmine.createSpy('cerrarSesionLocal').and.callFake(() => (estado = AuthStatus.notAuthenticated)),
      };
      TestBed.overrideProvider(AuthService, { useValue: auth });
    });

    it('limpia la sesión, va al login y avisa una sola vez aunque fallen varios pedidos', () => {
      correrEn('/api/repair-orders');
      correrEn('/api/customers');
      expect(auth.cerrarSesionLocal).toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/auth/login');
      expect(toastr.error).toHaveBeenCalledTimes(1);
      expect(toastr.error.calls.mostRecent().args[1]).toBe('Tu sesión venció');
    });

    it('un usuario dado de baja lo lee así', () => {
      correrEn('/api/repair-orders', 401, { code: 'USUARIO_DADO_DE_BAJA', message: 'x' });
      expect(toastr.error.calls.mostRecent().args[1]).toBe('Tu usuario está dado de baja');
    });

    it('el 401 del login no toca la sesión: es «usuario o contraseña incorrectos»', () => {
      correrEn('/api/auth/login', 401, { code: 'CREDENCIALES_INVALIDAS', message: 'x' });
      expect(auth.cerrarSesionLocal).not.toHaveBeenCalled();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
      expect(toastr.error.calls.mostRecent().args[1]).toBe('Usuario o contraseña incorrectos');
    });

    it('un 403 no cierra la sesión', () => {
      correrEn('/api/wallets', 403, { code: 'SIN_PERMISO', message: 'x' });
      expect(auth.cerrarSesionLocal).not.toHaveBeenCalled();
    });
  });
});
