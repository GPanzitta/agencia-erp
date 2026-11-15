import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { PerfilPublicoService } from './perfil-publico.service';
import { PERFIL_VACIO } from '../models/perfil-publico.model';
import { environment } from '../../../environments/environment';
import { SIN_AVISO_DE_ERROR } from '../interceptors/error.interceptor';

/** Los cuatro endpoints, con la URL y el método exactos que espera el backend. */
describe('PerfilPublicoService', () => {
  let service: PerfilPublicoService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/companies/mi-empresa/perfil-publico`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PerfilPublicoService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('obtener: GET', () => {
    service.obtener().subscribe((p) => expect(p.color_acento).toBe('amarillo'));
    http.expectOne({ method: 'GET', url: base }).flush(PERFIL_VACIO);
  });

  it('guardar: PATCH con sólo los cambios', () => {
    service.guardar({ eslogan: 'Hola' }).subscribe();
    const req = http.expectOne({ method: 'PATCH', url: base });
    expect(req.request.body).toEqual({ eslogan: 'Hola' });
    req.flush({ ...PERFIL_VACIO, eslogan: 'Hola' });
  });

  it('guardar: el PATCH pide que el interceptor no avise (los errores los reparte la pantalla)', () => {
    service.guardar({ eslogan: 'Hola' }).subscribe();
    const req = http.expectOne({ method: 'PATCH', url: base });
    expect(req.request.context.get(SIN_AVISO_DE_ERROR)).toBeTrue();
    req.flush(PERFIL_VACIO);
  });

  it('subirImagen: POST multipart a imagenes/:campo', () => {
    const archivo = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    service.subirImagen('portada', archivo).subscribe();
    const req = http.expectOne({ method: 'POST', url: `${base}/imagenes/portada` });
    expect(req.request.body instanceof FormData).toBeTrue();
    expect((req.request.body as FormData).get('file')).toBe(archivo);
    req.flush(PERFIL_VACIO);
  });

  it('borrarTrabajo: DELETE trabajos/:indice', () => {
    service.borrarTrabajo(2).subscribe();
    http.expectOne({ method: 'DELETE', url: `${base}/trabajos/2` }).flush(PERFIL_VACIO);
  });

  it('subirVideo: POST multipart a video', () => {
    const archivo = new File(['x'], 'portada.mp4', { type: 'video/mp4' });
    service.subirVideo(archivo).subscribe();
    const req = http.expectOne({ method: 'POST', url: `${base}/video` });
    expect(req.request.body instanceof FormData).toBeTrue();
    expect((req.request.body as FormData).get('file')).toBe(archivo);
    req.flush(PERFIL_VACIO);
  });

  it('quitarVideo: DELETE video', () => {
    service.quitarVideo().subscribe();
    http.expectOne({ method: 'DELETE', url: `${base}/video` }).flush(PERFIL_VACIO);
  });

  it('probarGoogle: POST a google/probar sin avisar por el interceptor', () => {
    service.probarGoogle('ChIJxxx').subscribe((r) => expect(r.promedio).toBe(4.8));
    const req = http.expectOne({ method: 'POST', url: `${base}/google/probar` });
    expect(req.request.body).toEqual({ place_id: 'ChIJxxx' });
    expect(req.request.context.get(SIN_AVISO_DE_ERROR)).toBeTrue();
    req.flush({ promedio: 4.8, total: 132, simulada: false });
  });
});
