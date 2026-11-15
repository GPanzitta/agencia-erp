import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { environment } from '../../../environments/environment';

/**
 * SEG-ERP-03: el JWT viaja sólo al backend propio. Antes iba en el header de
 * cualquier pedido del HttpClient: una URL de Cloudinary, de Mercado Libre o
 * una que viniera en un dato se llevaba la sesión del empleado.
 */
describe('authInterceptor (SEG-ERP-03)', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  const backend = new URL(environment.apiUrl).origin;

  beforeEach(() => {
    localStorage.setItem('token', 'jwt-de-prueba');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    ctrl.verify();
    localStorage.removeItem('token');
  });

  it('lo manda a la API del backend', () => {
    http.get(`${environment.apiUrl}/auth/me`).subscribe();
    expect(ctrl.expectOne(`${environment.apiUrl}/auth/me`).request.headers.get('Authorization')).toBe('Bearer jwt-de-prueba');
  });

  it('lo manda a otra ruta del mismo origen del backend (archivos subidos)', () => {
    http.get(`${backend}/uploads/x.pdf`).subscribe();
    expect(ctrl.expectOne(`${backend}/uploads/x.pdf`).request.headers.get('Authorization')).toBe('Bearer jwt-de-prueba');
  });

  it('NO lo manda a un host ajeno', () => {
    for (const url of [
      'https://res.cloudinary.com/demo/image/upload/x.jpg',
      'https://api.mercadolibre.com/items/1',
      // El host del backend como prefijo de otro dominio no engaña al chequeo.
      `${backend}.atacante.com/x`,
      `https://atacante.com/?${backend}`,
    ]) {
      http.get(url).subscribe();
      expect(ctrl.expectOne(url).request.headers.has('Authorization')).withContext(url).toBeFalse();
    }
  });

  it('NO lo manda a una URL relativa del propio ERP (assets)', () => {
    http.get('/assets/x.json').subscribe();
    expect(ctrl.expectOne('/assets/x.json').request.headers.has('Authorization')).toBeFalse();
  });

  it('sin token, no agrega nada', () => {
    localStorage.removeItem('token');
    http.get(`${environment.apiUrl}/x`).subscribe();
    expect(ctrl.expectOne(`${environment.apiUrl}/x`).request.headers.has('Authorization')).toBeFalse();
  });
});
