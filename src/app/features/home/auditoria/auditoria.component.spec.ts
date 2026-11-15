import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuditoriaComponent } from './auditoria.component';
import { AccionAuditada, AuditoriaService, instanteLocal } from './auditoria.service';
import { NotificationService } from '../../../core/services/notification.service';

/**
 * Solo `detalleLegible`: es lo único de esta pantalla que decide qué se lee.
 * El resto (filtros, paginado) es plomería sobre el servicio.
 */
describe('AuditoriaComponent · detalleLegible', () => {
  let c: AuditoriaComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      // El real arrastra ngx-toastr, que esta pantalla no necesita para leer
      // un detalle.
      providers: [{ provide: NotificationService, useValue: { success: () => {}, error: () => {} } }],
    });
    // Sin `createComponent`: acá no se mira nada del DOM, solo el método que
    // arma el texto. Se instancia dentro del contexto de inyección porque el
    // componente resuelve sus servicios con `inject()` (molde de
    // `ubicacion-modal.component.spec.ts`).
    c = TestBed.runInInjectionContext(() => new AuditoriaComponent());
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('un detalle de escalares se lee como pares, igual que siempre', () => {
    expect(c.detalleLegible({ monto: 100, estado: 'entregada' })).toBe('monto: 100 · estado: entregada');
  });

  it('sin detalle devuelve vacío', () => {
    expect(c.detalleLegible(null)).toBe('');
    expect(c.detalleLegible(undefined)).toBe('');
  });

  /**
   * `orden_editada` y `bitacora_editada` guardan TODO lo útil dentro de
   * `cambios`, que es una lista de objetos: interpolada con un template string
   * la pantalla mostraba `cambios: [object Object]` y el respaldo del texto
   * anterior de un comentario quedaba sin ninguna superficie de lectura.
   */
  it('la lista de cambios se lee campo por campo, con el rótulo y la flecha', () => {
    const texto = c.detalleLegible({
      cambios: [
        { campo: 'marca', rotulo: 'Marca', antes: 'Drean', despues: 'Whirlpool' },
        { campo: 'numero_serie', rotulo: 'N° de serie', antes: null, despues: 'AB123' },
      ],
    });
    expect(texto).toContain('Marca: Drean → Whirlpool');
    expect(texto).toContain('N° de serie: — → AB123');
    expect(texto).not.toContain('[object Object]');
  });

  it('sin rótulo cae al nombre del campo', () => {
    const texto = c.detalleLegible({ cambios: [{ campo: 'texto', antes: 'viejo', despues: 'nuevo' }] });
    expect(texto).toContain('texto: viejo → nuevo');
  });

  it('cualquier otra estructura sale como JSON, no como [object Object]', () => {
    const texto = c.detalleLegible({ tipo: 'raro', extra: { a: 1 } });
    expect(texto).toContain('{"a":1}');
    expect(texto).not.toContain('[object Object]');
  });
});

describe('Auditoría · filtro por día (CLI-11) y acciones (CLI-12)', () => {
  let http: HttpTestingController;
  let servicio: AuditoriaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: NotificationService, useValue: { success: () => {}, error: () => {} } }],
    });
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(AuditoriaService);
  });

  afterEach(() => http.verify());

  it('«del 13 al 13» viaja como el día entero en la hora del taller', () => {
    expect(instanteLocal('2026-10-13', 'inicio')).toBe(new Date(2026, 9, 13, 0, 0, 0, 0).toISOString());
    expect(instanteLocal('2026-10-13', 'fin')).toBe(new Date(2026, 9, 13, 23, 59, 59, 999).toISOString());
    expect(instanteLocal('', 'inicio')).toBeUndefined();

    servicio.consultar({ desde: '2026-10-13', hasta: '2026-10-13', pagina: 1 }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/auditoria'));
    expect(req.request.params.get('desde')).toBe(new Date(2026, 9, 13, 0, 0, 0, 0).toISOString());
    expect(req.request.params.get('hasta')).toBe(new Date(2026, 9, 13, 23, 59, 59, 999).toISOString());
    req.flush({ items: [], total: 0, pagina: 1, porPagina: 50 });
  });

  it('el filtro ofrece las 23 acciones del backend y una nueva se lee sin el código crudo', () => {
    const c = TestBed.runInInjectionContext(() => new AuditoriaComponent());
    expect(c.acciones).toContain(AccionAuditada.PRECIO_MODIFICADO);
    expect(c.acciones.length).toBe(23);
    expect(c.etiqueta('stock_ajustado')).toBe('Stock ajustado');
    expect(c.etiqueta('algo_que_no_conozco')).toBe('Algo que no conozco');
  });
});
