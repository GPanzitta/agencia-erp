import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { SitioWebComponent } from './sitio-web.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { PERFIL_VACIO } from '../../../../core/models/perfil-publico.model';
import { environment } from '../../../../../environments/environment';
import { urlDeYoutube } from './sitio-web.util';

describe('SitioWebComponent', () => {
  let fixture: ComponentFixture<SitioWebComponent>;
  let c: SitioWebComponent;
  let http: HttpTestingController;
  let notification: jasmine.SpyObj<NotificationService>;
  const base = `${environment.apiUrl}/companies/mi-empresa/perfil-publico`;
  const empresa = { id: 'e', name: 'GUSMAT', garantia_dias: 90 };

  beforeEach(() => {
    notification = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    TestBed.configureTestingModule({
      declarations: [SitioWebComponent],
      imports: [ReactiveFormsModule, FormsModule, HttpClientTestingModule],
      providers: [{ provide: NotificationService, useValue: notification }],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(SitioWebComponent);
    c = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function cargar(perfil = PERFIL_VACIO) {
    fixture.detectChanges();
    http.expectOne({ method: 'GET', url: base }).flush(perfil);
    http.expectOne({ method: 'GET', url: `${environment.apiUrl}/companies/mi-empresa` }).flush(empresa);
    fixture.detectChanges();
  }

  it('el selector de acento ofrece Fuego con su muestra en degradé', () => {
    cargar();
    const fuego: HTMLButtonElement | null = fixture.nativeElement.querySelector('.acentos button[aria-label="fuego"]');
    expect(fuego).withContext('falta el botón de fuego').not.toBeNull();
    expect(fuego!.style.background).toContain('linear-gradient');
    fuego!.click();
    fixture.detectChanges();
    expect(c.form.value.color_acento).toBe('fuego');
    expect(fuego!.getAttribute('aria-checked')).toBe('true');
  });

  it('carga los defaults y el botón Guardar arranca deshabilitado', () => {
    cargar();
    expect(c.form.value.color_acento).toBe('amarillo');
    expect(c.hayCambios()).toBeFalse();
  });

  it('guardar manda sólo lo cambiado y avisa', () => {
    cargar();
    c.form.patchValue({ eslogan: 'Lo arreglamos' });
    c.agregarMarca('LG');
    expect(c.hayCambios()).toBeTrue();
    c.guardar();
    const req = http.expectOne({ method: 'PATCH', url: base });
    expect(req.request.body).toEqual({ eslogan: 'Lo arreglamos', marcas: ['LG'] });
    req.flush({ ...PERFIL_VACIO, eslogan: 'Lo arreglamos', marcas: ['LG'] });
    expect(notification.success).toHaveBeenCalled();
    expect(c.hayCambios()).toBeFalse();
  });

  it('con 12 fotos de trabajos no se puede agregar otra', () => {
    const doce = Array.from({ length: 12 }, (_, i) => ({ url: `/uploads/${i}.webp`, miniatura: `/uploads/${i}m.webp` }));
    cargar({ ...PERFIL_VACIO, fotos_trabajos: doce });
    expect(c.galeriaLlena()).toBeTrue();
  });

  it('subir una imagen actualiza la URL sin marcar cambios pendientes', () => {
    cargar();
    const archivo = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    c.subir('portada', archivo);
    http.expectOne({ method: 'POST', url: `${base}/imagenes/portada` }).flush({ ...PERFIL_VACIO, portada_url: '/uploads/p.webp' });
    expect(c.form.value.portada_url).toBe('/uploads/p.webp');
    expect(c.hayCambios()).toBeFalse();
  });

  it('subir isotipo: POST a imagenes/isotipo y la URL nueva queda en el form', () => {
    cargar();
    c.subir('isotipo', new File(['x'], 'i.png', { type: 'image/png' }));
    const req = http.expectOne({ method: 'POST', url: `${base}/imagenes/isotipo` });
    req.flush({ ...PERFIL_VACIO, isotipo_url: '/uploads/perfil/i.webp' });
    expect(c.form.value.isotipo_url).toBe('/uploads/perfil/i.webp');
  });

  it('quitar isotipo: PATCH con isotipo_url en null', () => {
    cargar({ ...PERFIL_VACIO, isotipo_url: '/uploads/i.webp' });
    c.quitarImagen('isotipo_url');
    const req = http.expectOne({ method: 'PATCH', url: base });
    expect(req.request.body).toEqual({ isotipo_url: null });
  });

  it('servicios: tope de 8 y quitar por índice', () => {
    cargar();
    for (let i = 0; i < 8; i++) c.agregarServicio();
    expect(c.servicios.length).toBe(8);
    expect(c.serviciosLlenos()).toBeTrue();
    c.quitarServicio(0);
    expect(c.servicios.length).toBe(7);
  });

  it('un perfil sin `horarios` no deja la pantalla clavada en Cargando…', () => {
    const { horarios, ...sinHorarios } = PERFIL_VACIO;
    fixture.detectChanges();
    http.expectOne({ method: 'GET', url: base }).flush(sinHorarios as any);
    http.expectOne({ method: 'GET', url: `${environment.apiUrl}/companies/mi-empresa` }).flush(empresa);
    fixture.detectChanges();
    expect(c.cargando()).toBeFalse();
    expect(c.horarios.length).toBe(0);
  });

  // I5 (revisión final): caminos de error, antes sin ningún test.
  it('guardar: 400 con mensajes que no se identifican con un campo avisa por toast unido con " · "', () => {
    cargar();
    c.form.patchValue({ eslogan: 'Lo arreglamos' });
    c.guardar();
    const req = http.expectOne({ method: 'PATCH', url: base });
    req.flush(
      { message: ['servicios must contain no more than 8 elements', 'marcas must contain no more than 12 elements'] },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(notification.error).toHaveBeenCalledWith('servicios must contain no more than 8 elements · marcas must contain no more than 12 elements');
    expect(c.guardando()).toBeFalse();
  });

  it('subir: 400 con mensaje string avisa por toast', () => {
    cargar();
    const archivo = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    c.subir('logo', archivo);
    const req = http.expectOne({ method: 'POST', url: `${base}/imagenes/logo` });
    req.flush({ message: 'La imagen supera el tamaño máximo' }, { status: 400, statusText: 'Bad Request' });
    expect(notification.error).toHaveBeenCalledWith('La imagen supera el tamaño máximo');
    expect(c.subiendo()['logo']).toBeFalse();
  });

  it('quitar imagen: si el PATCH falla, la URL sigue en el form y en la vista previa (I3)', () => {
    cargar({ ...PERFIL_VACIO, logo_url: '/uploads/logo.webp' });
    c.quitarImagen('logo_url');
    const req = http.expectOne({ method: 'PATCH', url: base });
    expect(req.request.body).toEqual({ logo_url: null });
    req.flush({ message: 'No se pudo quitar' }, { status: 400, statusText: 'Bad Request' });
    expect(c.form.value.logo_url).toBe('/uploads/logo.webp');
    expect(c.actual().logo_url).toBe('/uploads/logo.webp');
    expect(notification.error).toHaveBeenCalledWith('No se pudo quitar la imagen');
  });

  // I1 de S1a: el backend manda `message` con `\n` y `campos[]`, no un array.
  it('400 real: el renglón de un campo conocido va bajo el campo y el resto al toast', () => {
    cargar();
    c.form.patchValue({ eslogan: 'Lo arreglamos' });
    c.guardar();
    http.expectOne({ method: 'PATCH', url: base }).flush(
      {
        statusCode: 400,
        code: 'DATOS_INVALIDOS',
        message: 'eslogan: es más largo de lo permitido.\nvideos.1.url: El video no permite embebido o no existe.',
        campos: ['eslogan', 'videos.1.url'],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(c.form.get('eslogan')?.errors?.['backend']).toBe('Es más largo de lo permitido.');
    expect(c.mensajeError(c.form.get('eslogan'), 'otro mensaje')).toBe('Es más largo de lo permitido.');
    // El bloque Videos todavía no existe en esta tarea: ese renglón no tiene
    // control al que ir, así que sale por el toast en vez de perderse.
    expect(notification.error).toHaveBeenCalledWith('videos.1.url: El video no permite embebido o no existe.');
    expect(c.guardando()).toBeFalse();
  });

  it('subir video: POST a /video y la URL queda en el form sin marcar cambios pendientes', () => {
    cargar();
    const archivo = new File(['x'], 'portada.mp4', { type: 'video/mp4' });
    c.subirVideoPortada(archivo);
    http.expectOne({ method: 'POST', url: `${base}/video` }).flush({
      ...PERFIL_VACIO, video_url: '/uploads/v.mp4', video_poster_url: null,
    });
    expect(c.form.value.video_url).toBe('/uploads/v.mp4');
    expect(c.subiendoVideo()).toBeFalse();
    expect(c.hayCambios()).toBeFalse();
  });

  it('quitar video: DELETE y las dos URLs quedan en null', () => {
    cargar({ ...PERFIL_VACIO, video_url: '/uploads/v.mp4', video_poster_url: null });
    c.quitarVideoPortada();
    http.expectOne({ method: 'DELETE', url: `${base}/video` }).flush(PERFIL_VACIO);
    expect(c.form.value.video_url).toBeNull();
    expect(c.form.value.video_poster_url).toBeNull();
  });

  it('un video de más de 25 MB se rechaza antes de salir a la red', () => {
    cargar();
    const archivo = new File(['x'], 'largo.mp4', { type: 'video/mp4' });
    // `size` es de sólo lectura: se redefine para no reservar 26 MB de veras.
    Object.defineProperty(archivo, 'size', { value: 26 * 1024 * 1024 });
    c.subirVideoPortada(archivo);
    http.expectNone({ method: 'POST', url: `${base}/video` });
    expect(notification.error).toHaveBeenCalledWith('El video no puede pasar de 25 MB.');
  });
  it('volver a guardar después de un 400 limpia el error del backend y manda el PATCH', () => {
    cargar();
    c.form.patchValue({ eslogan: 'Lo arreglamos' });
    c.guardar();
    http.expectOne({ method: 'PATCH', url: base }).flush(
      { message: 'eslogan: es más largo de lo permitido.', campos: ['eslogan'] },
      { status: 400, statusText: 'Bad Request' },
    );
    c.guardar();
    const segundo = http.expectOne({ method: 'PATCH', url: base });
    expect(segundo.request.body).toEqual({ eslogan: 'Lo arreglamos' });
    segundo.flush({ ...PERFIL_VACIO, eslogan: 'Lo arreglamos' });
    expect(c.form.get('eslogan')?.errors).toBeNull();
  });

  it('videos: agregar, mover y quitar filas, con tope de 6', () => {
    cargar();
    for (let i = 0; i < 7; i++) c.agregarVideo();
    expect(c.videos.length).toBe(6);
    expect(c.videosLlenos()).toBeTrue();
    c.videos.at(0).patchValue({ url: 'https://youtu.be/aaa' });
    c.videos.at(1).patchValue({ url: 'https://youtu.be/bbb' });
    c.moverVideo(1, -1);
    expect(c.videos.at(0).value.url).toBe('https://youtu.be/bbb');
    c.quitarVideo(0);
    expect(c.videos.length).toBe(5);
    expect(c.videos.at(0).value.url).toBe('https://youtu.be/aaa');
  });

  it('guardar manda los videos con la url reconstruida y el título propio', () => {
    cargar({
      ...PERFIL_VACIO,
      videos: [{ id: 'aaa', titulo: 'Cambio de correa', canal: 'Taller', titulo_personalizado: null, url: '' }],
    });
    expect(c.hayCambios()).toBeFalse();
    c.videos.at(0).patchValue({ titulo_personalizado: 'Cómo cambiar la correa' });
    c.guardar();
    const req = http.expectOne({ method: 'PATCH', url: base });
    expect(req.request.body).toEqual({
      videos: [{ url: urlDeYoutube('aaa'), titulo_personalizado: 'Cómo cambiar la correa' }],
    });
    req.flush(PERFIL_VACIO);
  });

  it('el 400 de un video cae bajo su fila, no en el toast', () => {
    cargar();
    c.agregarVideo();
    c.agregarVideo();
    c.videos.at(0).patchValue({ url: 'https://youtu.be/aaa' });
    c.videos.at(1).patchValue({ url: 'https://youtu.be/roto' });
    c.guardar();
    http.expectOne({ method: 'PATCH', url: base }).flush(
      {
        statusCode: 400, code: 'DATOS_INVALIDOS',
        message: 'videos.1.url: El video no permite embebido o no existe.',
        campos: ['videos.1.url'],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(c.mensajeError(c.videos.at(1).get('url'), 'otro')).toBe('El video no permite embebido o no existe.');
    expect(notification.error).not.toHaveBeenCalled();
  });

  it('Probar con clave: muestra el promedio y la cantidad', () => {
    cargar();
    c.form.patchValue({ google_place_id: 'ChIJxxx' });
    c.probarGoogle();
    http.expectOne({ method: 'POST', url: `${base}/google/probar` }).flush({ promedio: 4.8, total: 132, simulada: false });
    expect(c.pruebaGoogle()).toEqual({ ok: true, texto: '★ 4,8 · 132 opiniones' });
    expect(c.probandoGoogle()).toBeFalse();
  });

  it('cambiar el Place ID después de Probar limpia el resultado viejo', () => {
    cargar();
    c.form.patchValue({ google_place_id: 'ChIJxxx' });
    c.probarGoogle();
    http.expectOne({ method: 'POST', url: `${base}/google/probar` }).flush({ promedio: 4.8, total: 132, simulada: false });
    expect(c.pruebaGoogle()).not.toBeNull();
    c.form.patchValue({ google_place_id: 'ChIJotro' });
    expect(c.pruebaGoogle()).toBeNull();
  });

  // Hallazgo 2 (revisión final): la respuesta en vuelo no puede pisar el
  // `null` que ya dejó el `valueChanges` de arriba al editar el campo.
  it('editar el Place ID mientras Probar está en vuelo no pisa el resultado limpio', () => {
    cargar();
    c.form.patchValue({ google_place_id: 'ChIJxxx' });
    c.probarGoogle();
    const req = http.expectOne({ method: 'POST', url: `${base}/google/probar` });
    c.form.patchValue({ google_place_id: 'ChIJotro' });
    req.flush({ promedio: 4.8, total: 132, simulada: false });
    expect(c.pruebaGoogle()).toBeNull();
    expect(c.probandoGoogle()).toBeFalse();
  });

  it('Probar sin clave en el servidor: avisa que es simulado', () => {
    cargar();
    c.form.patchValue({ google_place_id: 'ChIJxxx' });
    c.probarGoogle();
    http.expectOne({ method: 'POST', url: `${base}/google/probar` }).flush({ promedio: 4.8, total: 132, simulada: true });
    expect(c.pruebaGoogle()).toEqual({ ok: true, texto: 'Simulado: sin clave de Google en el servidor' });
  });

  it('Probar con un Place ID que Google rechaza: muestra el error del backend al lado del botón', () => {
    cargar();
    c.form.patchValue({ google_place_id: 'roto' });
    c.probarGoogle();
    http.expectOne({ method: 'POST', url: `${base}/google/probar` })
      .flush({ message: 'Google rechazó el Place ID' }, { status: 400, statusText: 'Bad Request' });
    expect(c.pruebaGoogle()).toEqual({ ok: false, texto: 'Google rechazó el Place ID' });
  });

  it('Probar con el campo vacío no sale a la red', () => {
    cargar();
    c.probarGoogle();
    http.expectNone({ method: 'POST', url: `${base}/google/probar` });
  });
});
