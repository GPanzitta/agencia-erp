import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { EmpresaComponent } from './empresa.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { EmpresaService } from '../../../../core/services/empresa.service';
import { environment } from '../../../../../environments/environment';

/**
 * Solo la sección Repuestos (spec C5 §6.9 y §2.10). Los tres pedidos del
 * arranque —billeteras, rubros y la empresa— son de otras etapas y no se
 * disparan acá: no se llama a `ngOnInit`, se instancia el componente y se
 * mira el `form`, que es lo único que esta tarea toca.
 *
 * `NotificationService` va stubeado porque inyecta `ToastrService`, que
 * necesita los providers del módulo de toasts. Es el mismo stub que usa
 * `mensajes.component.spec.ts`.
 */
describe('EmpresaComponent · sección Repuestos', () => {
  let c: EmpresaComponent;
  let http: HttpTestingController;
  let avisos: {
    success: jasmine.Spy; error: jasmine.Spy; info: jasmine.Spy; warning: jasmine.Spy;
  };

  beforeEach(() => {
    avisos = {
      success: jasmine.createSpy(), error: jasmine.createSpy(),
      info: jasmine.createSpy(), warning: jasmine.createSpy(),
    };
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: NotificationService, useValue: avisos }],
    });
    c = TestBed.runInInjectionContext(() => new EmpresaComponent());
    // Sin ngOnInit: se da por cargada, como si la lectura hubiera contestado.
    c.cargado.set(true);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('el form trae los dos campos del pañol con los rangos que valida el backend', () => {
    expect(c.form.get('margen_repuestos_porcentaje')?.value).toBe(40);
    expect(c.form.get('alerta_suba_costo_porcentaje')?.value).toBe(15);

    // 0-500 y 0-100: los mismos topes del `ActualizarEmpresaDto` (spec §5.3).
    c.form.patchValue({ margen_repuestos_porcentaje: 501 });
    expect(c.form.get('margen_repuestos_porcentaje')?.valid).toBeFalse();
    c.form.patchValue({ margen_repuestos_porcentaje: 50, alerta_suba_costo_porcentaje: 101 });
    expect(c.form.get('alerta_suba_costo_porcentaje')?.valid).toBeFalse();
  });

  it('el toggle de respaldo de compra viaja en el PATCH y arranca en true', () => {
    expect(c.form.value.exigir_oc_paga_repuestos).toBeTrue();
    c.form.patchValue({ name: 'Taller', exigir_oc_paga_repuestos: false });
    c.guardar();
    const req = http.expectOne(`${environment.apiUrl}/companies/mi-empresa`);
    expect(req.request.body.exigir_oc_paga_repuestos).toBeFalse();
    req.flush({ id: 'e1', name: 'Taller', exigir_oc_paga_repuestos: false });
  });

  it('guardar manda el margen y la alerta en el PATCH', () => {
    c.form.patchValue({
      name: 'Taller', margen_repuestos_porcentaje: 50, alerta_suba_costo_porcentaje: 20,
    });
    c.guardar();

    const req = http.expectOne(`${environment.apiUrl}/companies/mi-empresa`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.margen_repuestos_porcentaje).toBe(50);
    expect(req.request.body.alerta_suba_costo_porcentaje).toBe(20);
    req.flush({
      id: 'e1', name: 'Taller',
      margen_repuestos_porcentaje: 50, alerta_suba_costo_porcentaje: 20,
    });
    expect(c.guardando()).toBeFalse();
  });

  it('el ejemplo se calcula con el margen cargado, no con un 40 fijo', () => {
    c.form.patchValue({ margen_repuestos_porcentaje: 50 });
    expect(c.ejemploMargen()).toBe(18000);
    c.form.patchValue({ margen_repuestos_porcentaje: 40 });
    expect(c.ejemploMargen()).toBe(16800);
  });
});

/**
 * D2 (tanda 3b): la billetera de transferencias es donde entra lo que el
 * chofer cobra por transferencia en la puerta. Acá sí corre `ngOnInit`, con
 * sus tres pedidos, porque lo que se prueba es que el form la lea.
 */
describe('EmpresaComponent · billetera de transferencias (D2)', () => {
  let c: EmpresaComponent;
  let http: HttpTestingController;
  const empresaUrl = `${environment.apiUrl}/companies/mi-empresa`;

  /** Arranca la pantalla con esa empresa y resuelve los tres pedidos del inicio. */
  const cargarCon = (empresa: any) => {
    c.ngOnInit();
    http.expectOne(`${environment.apiUrl}/wallets`).flush([
      { id: 'w-mp', name: 'Mercado Pago', type: 'digital', is_active: true, is_deleted: false },
      { id: 'w-banco', name: 'Banco Galicia', type: 'bank', is_active: true, is_deleted: false },
    ]);
    http.expectOne(empresaUrl).flush({ id: 'e1', name: 'Taller', ...empresa });
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{
        provide: NotificationService,
        useValue: { success: jasmine.createSpy(), error: jasmine.createSpy(), info: jasmine.createSpy(), warning: jasmine.createSpy() },
      }],
    });
    c = TestBed.runInInjectionContext(() => new EmpresaComponent());
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lee la billetera de transferencias que tiene cargada la empresa', () => {
    cargarCon({ mp_wallet_id: 'w-mp', transferencia_wallet_id: 'w-banco' });
    expect(c.form.value.transferencia_wallet_id).toBe('w-banco');
    expect(c.form.value.mp_wallet_id).toBe('w-mp');
  });

  it('sin billetera de transferencias el selector queda en «Sin configurar»', () => {
    cargarCon({ mp_wallet_id: 'w-mp', transferencia_wallet_id: null });
    expect(c.form.value.transferencia_wallet_id).toBe('');
  });

  it('un backend que todavía no manda el campo tampoco rompe el form', () => {
    cargarCon({ mp_wallet_id: 'w-mp' });
    expect(c.form.value.transferencia_wallet_id).toBe('');
  });

  it('la manda en el PATCH, y puede ser la misma que la de Mercado Pago', () => {
    cargarCon({ mp_wallet_id: 'w-mp', transferencia_wallet_id: null });
    c.form.patchValue({ transferencia_wallet_id: 'w-mp' });
    c.guardar();
    const req = http.expectOne(empresaUrl);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.transferencia_wallet_id).toBe('w-mp');
    expect(req.request.body.mp_wallet_id).toBe('w-mp');
    req.flush({ id: 'e1', name: 'Taller', mp_wallet_id: 'w-mp', transferencia_wallet_id: 'w-mp' });
  });

  it('vacía viaja como null, que es lo que la borra en el backend', () => {
    cargarCon({ mp_wallet_id: 'w-mp', transferencia_wallet_id: 'w-banco' });
    c.form.patchValue({ transferencia_wallet_id: '' });
    c.guardar();
    const req = http.expectOne(empresaUrl);
    expect(req.request.body.transferencia_wallet_id).toBeNull();
    req.flush({ id: 'e1', name: 'Taller', transferencia_wallet_id: null });
  });
});

/**
 * #5 (tanda 4): si `mi-empresa` no contesta, el form queda con los valores
 * por defecto. Guardarlo pisaba la billetera de MP y el token con null. Sin
 * la lectura no hay form ni guardado, y hay «Reintentar».
 */
describe('EmpresaComponent · la lectura falló (#5)', () => {
  let fixture: ComponentFixture<EmpresaComponent>;
  let c: EmpresaComponent;
  let http: HttpTestingController;
  const empresaUrl = `${environment.apiUrl}/companies/mi-empresa`;
  const billeteras = [
    { id: 'w-mp', name: 'Mercado Pago', type: 'digital', is_active: true, is_deleted: false },
    { id: 'w-vieja', name: 'Vieja', type: 'bank', is_active: false, is_deleted: false },
  ];

  const arrancar = (empresa: { body: any; status?: number }) => {
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/wallets`).flush(billeteras);
    http.expectOne(empresaUrl).flush(
      empresa.body,
      empresa.status ? { status: empresa.status, statusText: 'x' } : undefined,
    );
    fixture.detectChanges();
  };
  const textoBotones = () =>
    Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .map((b) => b.textContent!.trim());

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [EmpresaComponent],
      imports: [HttpClientTestingModule, ReactiveFormsModule, FormsModule],
      providers: [{
        provide: NotificationService,
        useValue: { success: jasmine.createSpy(), error: jasmine.createSpy(), info: jasmine.createSpy(), warning: jasmine.createSpy() },
      }],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(EmpresaComponent);
    c = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('con 503 no hay form ni botón de guardar, y guardar() no manda nada', () => {
    arrancar({ body: { message: 'caído' }, status: 503 });
    expect(c.cargado()).toBeFalse();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(textoBotones()).toContain('Reintentar');
    c.guardar();
    http.expectNone(empresaUrl);
  });

  it('«Reintentar» vuelve a leer la empresa y aparece el form', () => {
    arrancar({ body: {}, status: 503 });
    const reintentar = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent!.trim() === 'Reintentar')!;
    reintentar.click();
    http.expectOne(empresaUrl).flush({ id: 'e1', name: 'Taller', mp_wallet_id: 'w-mp' });
    fixture.detectChanges();
    expect(c.cargado()).toBeTrue();
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
  });

});

/** CLI-02: el token de Mercado Pago no se muestra ni queda en la sesión. */
describe('EmpresaComponent · token de Mercado Pago', () => {
  let c: EmpresaComponent;
  let http: HttpTestingController;
  let avisos: { success: jasmine.Spy; error: jasmine.Spy; info: jasmine.Spy; warning: jasmine.Spy };
  const empresaUrl = `${environment.apiUrl}/companies/mi-empresa`;

  const cargarCon = (empresa: Record<string, unknown>) => {
    c.ngOnInit();
    http.expectOne(`${environment.apiUrl}/wallets`).flush([]);
    http.expectOne(empresaUrl).flush({ id: 'e1', name: 'Taller', ...empresa });
  };

  beforeEach(() => {
    avisos = { success: jasmine.createSpy(), error: jasmine.createSpy(), info: jasmine.createSpy(), warning: jasmine.createSpy() };
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: NotificationService, useValue: avisos }],
    });
    c = TestBed.runInInjectionContext(() => new EmpresaComponent());
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('con el backend viejo (manda el token) no lo precarga ni lo guarda en el caché', () => {
    cargarCon({ mp_access_token: 'APP_USR-secreto' });
    expect(c.mpConfigurado()).toBeTrue();
    const cache = TestBed.inject(EmpresaService).empresa() as any;
    expect(cache.mp_access_token).toBeUndefined();
    expect(cache.mp_configurado).toBeTrue();
  });

  it('con el backend nuevo (sin token) lee «configurado» y tolera que falte todo', () => {
    cargarCon({ mp_configurado: false });
    expect(c.mpConfigurado()).toBeFalse();
  });

  it('sin escribir nada, el PATCH no toca el token', () => {
    cargarCon({ mp_configurado: true });
    c.guardar();
    const req = http.expectOne(empresaUrl);
    expect('mp_access_token' in req.request.body).toBeFalse();
    req.flush({ id: 'e1', name: 'Taller', mp_configurado: true });
  });

  const mpUrl = `${environment.apiUrl}/mp`;

  it('el estado dice cómo está conectado Mercado Pago', () => {
    cargarCon({ mp_conexion: 'oauth', mp_user_id: '123', mp_cuenta: 'NANDU.TALLER' });
    expect(c.textoConexionMp()).toBe('Conectada a Mercado Pago (NANDU.TALLER)');
    c.mpCuenta.set(null);
    expect(c.textoConexionMp()).toBe('Conectada a Mercado Pago (cuenta 123)');
    c.mpConexion.set('vencida');
    expect(c.textoConexionMp()).toBe('La conexión con Mercado Pago venció: volvé a conectarla. Mientras tanto, tus clientes no pueden pagar online');
    c.mpConexion.set('manual');
    expect(c.textoConexionMp()).toBe('Token cargado a mano: conectala con el botón para que se renueve sola');
    c.mpConexion.set('demo');
    expect(c.textoConexionMp()).toBe('Modo demo: los cobros se simulan');
    c.mpConexion.set(null);
    expect(c.textoConexionMp()).toBe('Sin conectar: tus clientes no pueden pagar online');
  });

  it('«Conectar» pide la URL al backend y lleva a Mercado Pago', () => {
    const ir = spyOn(c, 'irA');
    c.conectarMp();
    http.expectOne(`${mpUrl}/oauth/iniciar`).flush({ url: 'https://auth.mercadopago.com.ar/authorization?x=1' });
    expect(ir).toHaveBeenCalledWith('https://auth.mercadopago.com.ar/authorization?x=1');
  });

  it('al volver de Mercado Pago muestra qué cuenta volvió y NO la activa sola', () => {
    c.procesarRetornoMp('?mp=abc-123&cuenta=NANDU.TALLER');
    expect(c.mpPorConfirmar()).toEqual({ pendiente: 'abc-123', cuenta: 'NANDU.TALLER' });
    http.expectNone(`${mpUrl}/oauth/confirmar`);
  });

  it('«Conectar esta cuenta» confirma el pendiente, avisa y recarga', () => {
    c.procesarRetornoMp('?mp=abc-123&cuenta=NANDU.TALLER');
    c.confirmarCuentaMp();
    const req = http.expectOne(`${mpUrl}/oauth/confirmar`);
    expect(req.request.body).toEqual({ pendiente: 'abc-123' });
    req.flush({ conectada: true });
    expect(avisos.success).toHaveBeenCalledWith('Mercado Pago conectado');
    expect(c.mpPorConfirmar()).toBeNull();
    http.expectOne(empresaUrl).flush({ id: 'e1', name: 'Taller', mp_configurado: true, mp_conexion: 'oauth', mp_user_id: '123' });
    expect(c.mpConexion()).toBe('oauth');
  });

  it('«No es esta cuenta» descarta sin tocar nada', () => {
    c.procesarRetornoMp('?mp=abc-123&cuenta=PERSONAL');
    c.descartarCuentaMp();
    expect(c.mpPorConfirmar()).toBeNull();
    http.expectNone(`${mpUrl}/oauth/confirmar`);
  });

  it('avisa cuando faltan menos de 15 días y la conexión no se renovó', () => {
    const en = (dias: number) => new Date(Date.now() + dias * 86400000).toISOString();
    c.mpConexion.set('oauth');
    c.mpVence.set(en(10));
    expect(c.avisoVencimientoMp()).toContain('no se pudo renovar');
    c.mpVence.set(en(60));
    expect(c.avisoVencimientoMp()).toBeNull();
    c.mpConexion.set('manual');
    c.mpVence.set(en(10));
    expect(c.avisoVencimientoMp()).toBeNull();
  });

  it('si vuelve con error lo muestra y no confirma nada', () => {
    c.procesarRetornoMp('?mp_error=MP_OAUTH_INVALIDO');
    expect(avisos.error).toHaveBeenCalledWith('Esa conexión con Mercado Pago no es válida o venció. Probá de nuevo.');
    http.expectNone(`${mpUrl}/oauth/confirmar`);
  });

  it('sin parámetros de Mercado Pago no hace nada', () => {
    c.procesarRetornoMp('?otra=1');
    http.expectNone(`${mpUrl}/oauth/confirmar`);
    expect(avisos.error).not.toHaveBeenCalled();
  });

  it('«Desconectar» pide confirmación antes de llamar al backend', () => {
    const confirmar = spyOn(window, 'confirm').and.returnValue(false);
    c.desconectarMp();
    http.expectNone(`${mpUrl}/conexion`);
    confirmar.and.returnValue(true);
    c.desconectarMp();
    const req = http.expectOne(`${mpUrl}/conexion`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ conectada: false });
    http.expectOne(empresaUrl).flush({ id: 'e1', name: 'Taller', mp_configurado: false, mp_conexion: null });
    expect(c.mpConexion()).toBeNull();
  });

  it('«Ver primeros pasos» vuelve a abrir la lista', () => {
    c.verPrimerosPasos();
    const req = http.expectOne(`${environment.apiUrl}/companies/primeros-pasos`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ cerrado: false });
    req.flush(null);
  });

  it('«Usar modo demo» se ofrece sólo si el entorno lo permite', () => {
    cargarCon({ mp_demo_permitida: false });
    expect(c.mpDemoPermitida()).toBeFalse();
  });

  it('con una cuenta conectada, «Usar modo demo» pide confirmación: reemplaza el token', () => {
    const confirmar = spyOn(window, 'confirm').and.returnValue(false);
    c.mpConexion.set('manual');
    c.usarDemoMp();
    expect(confirmar).toHaveBeenCalled();
    http.expectNone(empresaUrl);
  });

  it('«Usar modo demo» guarda el token de demo y recarga', () => {
    c.usarDemoMp();
    const req = http.expectOne(empresaUrl);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ mp_access_token: 'SIMULADO' });
    req.flush({ id: 'e1', name: 'Taller' });
    http.expectOne(empresaUrl).flush({ id: 'e1', name: 'Taller', mp_configurado: true, mp_conexion: 'demo' });
    expect(c.mpConexion()).toBe('demo');
  });
});

/**
 * Opción B de documentos (13/10/2026): los 14 datos legales del contrato.
 * Con un backend que todavía no corrió la migración, la sección se ve
 * deshabilitada y el PATCH no los manda (el backend rechaza campos que no
 * conoce); con la migración, viajan como los espera el DTO.
 */
describe('EmpresaComponent · datos legales y de los documentos', () => {
  let c: EmpresaComponent;
  let http: HttpTestingController;
  const empresaUrl = `${environment.apiUrl}/companies/mi-empresa`;
  const legalesDelBackend = {
    razon_social: 'García S.R.L.', condicion_iva: 'responsable_inscripto', iibb: '901-1', inicio_actividades: '2020-03-01',
    email_contacto: 'hola@garcia.com', horario_atencion: 'lunes a viernes de 9 a 18 h',
    costo_revision: '15000.00', revision_se_descuenta: true, plazo_presupuesto_dias: 2, plazo_reparacion_dias: 10,
    canon_guarda_diario: '1000.00', revision_garantia_dias: 5, factura_momento: 'al_cobrar', traslado_garantia: null,
  };

  const cargarCon = (empresa: Record<string, unknown>) => {
    c.ngOnInit();
    http.expectOne(`${environment.apiUrl}/wallets`).flush([]);
    http.expectOne(empresaUrl).flush({ id: 'e1', name: 'Taller', ...empresa });
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{
        provide: NotificationService,
        useValue: { success: jasmine.createSpy(), error: jasmine.createSpy(), info: jasmine.createSpy(), warning: jasmine.createSpy() },
      }],
    });
    c = TestBed.runInInjectionContext(() => new EmpresaComponent());
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('los decimales que llegan como string se cargan como número, en el form y en el caché', () => {
    cargarCon(legalesDelBackend);
    expect(c.datosLegalesDisponibles()).toBeTrue();
    expect(c.form.get('costo_revision')?.value).toBe(15000);
    expect(c.form.get('canon_guarda_diario')?.value).toBe(1000);
    expect(c.form.get('razon_social')?.enabled).toBeTrue();
    expect((TestBed.inject(EmpresaService).empresa() as any).costo_revision).toBe(15000);
  });

  it('valida como el DTO: plazos, montos, correo y largo del traslado', () => {
    cargarCon(legalesDelBackend);
    const invalido = (k: string, v: unknown) => {
      c.form.get(k)!.setValue(v);
      return c.form.get(k)!.invalid;
    };
    expect(invalido('plazo_presupuesto_dias', 16)).toBeTrue();
    expect(invalido('plazo_presupuesto_dias', 0)).toBeTrue();
    expect(invalido('plazo_reparacion_dias', 31)).toBeTrue();
    expect(invalido('revision_garantia_dias', 31)).toBeTrue();
    expect(invalido('costo_revision', -1)).toBeTrue();
    expect(invalido('canon_guarda_diario', 10_000_001)).toBeTrue();
    expect(invalido('email_contacto', 'no-es-correo')).toBeTrue();
    expect(invalido('traslado_garantia', 'x'.repeat(601))).toBeTrue();
    expect(invalido('razon_social', 'x'.repeat(121))).toBeTrue();
    expect(invalido('plazo_reparacion_dias', 30)).toBeFalse();
    expect(invalido('canon_guarda_diario', 0)).toBeFalse();
  });

  it('guardar los manda: vacío viaja como null y los números como número', () => {
    cargarCon(legalesDelBackend);
    c.form.patchValue({ razon_social: '  ', iibb: '', condicion_iva: 'monotributo', costo_revision: '0', factura_momento: 'al_senar' });
    c.guardar();
    const req = http.expectOne(empresaUrl);
    const b = req.request.body;
    expect(b.razon_social).toBeNull();
    expect(b.iibb).toBeNull();
    expect(b.condicion_iva).toBe('monotributo');
    expect(b.costo_revision).toBe(0);
    expect(b.canon_guarda_diario).toBe(1000);
    expect(b.factura_momento).toBe('al_senar');
    expect(b.traslado_garantia).toBeNull();
    expect(b.inicio_actividades).toBe('2020-03-01');
    req.flush({ id: 'e1', name: 'Taller', ...legalesDelBackend });
  });

  it('con un backend sin la migración, la sección queda deshabilitada y el PATCH no los manda', () => {
    cargarCon({});
    expect(c.datosLegalesDisponibles()).toBeFalse();
    expect(c.form.get('costo_revision')?.disabled).toBeTrue();
    c.guardar();
    const req = http.expectOne(empresaUrl);
    expect('razon_social' in req.request.body).toBeFalse();
    expect('costo_revision' in req.request.body).toBeFalse();
    req.flush({ id: 'e1', name: 'Taller' });
  });
});
