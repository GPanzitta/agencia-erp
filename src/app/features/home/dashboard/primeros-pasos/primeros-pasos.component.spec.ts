import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../../../environments/environment';
import { PrimerosPasosComponent } from './primeros-pasos.component';

describe('PrimerosPasosComponent', () => {
  let f: ComponentFixture<PrimerosPasosComponent>;
  let c: PrimerosPasosComponent;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/companies/primeros-pasos`;
  const pasos = (hechos: string[] = []) =>
    ['datos', 'legales', 'logo', 'caja_dolares', 'unidad', 'publicada', 'empleados'].map((clave) => ({ clave, hecho: hechos.includes(clave) }));
  const el = () => f.nativeElement as HTMLElement;
  const cargar = (cuerpo: unknown) => { f.detectChanges(); http.expectOne(url).flush(cuerpo as object); f.detectChanges(); };

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PrimerosPasosComponent],
      imports: [HttpClientTestingModule, RouterTestingModule],
    });
    f = TestBed.createComponent(PrimerosPasosComponent);
    c = f.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('muestra los pasos con cuántos faltan y cada uno enlaza a su pantalla', () => {
    cargar({ cerrado: false, pasos: pasos(['datos']) });
    expect(el().textContent).toContain('Te faltan 6 de 7');
    const hrefs = Array.from(el().querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/home/autos');
    expect(hrefs).toContain('/home/configuracion/wallets');
    expect(hrefs).toContain('/home/configuracion/empleados');
    expect(hrefs).toContain('/home/configuracion/sitio-web');
  });

  it('lo hecho se ve tildado', () => {
    cargar({ cerrado: false, pasos: pasos(['datos']) });
    expect(el().querySelectorAll('.paso--hecho').length).toBe(1);
  });

  it('con todo hecho no aparece', () => {
    cargar({ cerrado: false, pasos: pasos(['datos', 'legales', 'logo', 'caja_dolares', 'unidad', 'publicada', 'empleados']) });
    expect(el().querySelector('.primeros-pasos')).toBeNull();
  });

  it('cerrado no aparece', () => {
    cargar({ cerrado: true, pasos: pasos() });
    expect(el().querySelector('.primeros-pasos')).toBeNull();
  });

  it('«Ocultar» lo cierra y lo guarda', () => {
    cargar({ cerrado: false, pasos: pasos() });
    c.ocultar();
    const req = http.expectOne(url);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ cerrado: true });
    req.flush(null);
    f.detectChanges();
    expect(el().querySelector('.primeros-pasos')).toBeNull();
  });

  it('abrir un paso no guarda nada: todos se tildan solos con lo que se carga', () => {
    cargar({ cerrado: false, pasos: pasos() });
    c.alAbrir('datos');
    c.alAbrir('unidad');
    http.expectNone(url);
  });

  it('si no se puede cargar, no estorba', () => {
    f.detectChanges();
    http.expectOne(url).flush({}, { status: 500, statusText: 'x' });
    f.detectChanges();
    expect(el().querySelector('.primeros-pasos')).toBeNull();
  });
});
