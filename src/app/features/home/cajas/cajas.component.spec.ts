import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CajasComponent } from './cajas.component';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../auth/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Rol } from '../../../core/interfaces/auth.interface';

/**
 * La pantalla de Cajas: los saldos (de solo lectura para todos) y el turno
 * (solo mostrador y admin; cerrar solo admin). El saldo llega como string
 * (decimal de Postgres) y hay que tratarlo como número o "-120.00" < 0 queda a
 * merced de la coerción de JavaScript.
 */
describe('CajasComponent', () => {
  let c: CajasComponent;
  let http: HttpTestingController;
  const rol = signal<Rol | null>(Rol.ADMIN);
  const notification = jasmine.createSpyObj('NotificationService', ['success', 'error']);
  const api = environment.apiUrl;

  const caja = (p: Record<string, unknown> = {}): any => ({
    id: 'w1', name: 'Caja mostrador', type: 'cash', current_balance: '15000.00', ...p,
  });

  const turnoAbierto = (): any => ({
    id: 't1', turno_numero: 'T-2026-10-21-001', fecha_apertura: '2026-10-21T12:00:00Z', estado: 'abierta',
    empleado: { nombre: 'Marina' },
    walletBalances: [
      { id: 'b1', walletId: 'w1', wallet: { id: 'w1', name: 'Caja mostrador' }, opening_amount: '15000.00', expected_amount: '16000.00' },
      { id: 'b2', walletId: 'w2', wallet: { id: 'w2', name: 'Banco' }, opening_amount: '500.00', expected_amount: '500.00' },
    ],
    movimientos: [
      { id: 'm1', tipo: 'ingreso', monto: '100', motivo: 'viejo', fecha: '2026-10-21T12:10:00Z' },
      { id: 'm2', tipo: 'retiro', monto: '50', motivo: 'nuevo', fecha: '2026-10-21T13:10:00Z' },
    ],
  });

  /** Contesta los tres GET que dispara cargar(). */
  function responderCarga(opciones: { cajas?: any[]; turno?: any; historial?: any[] } = {}) {
    http.expectOne(`${api}/wallets/active`).flush(opciones.cajas ?? [caja()]);
    if (rol() === Rol.ADMIN || rol() === Rol.MOSTRADOR) {
      http.expectOne(`${api}/cash-register/active`).flush(opciones.turno ?? null);
      http.expectOne(`${api}/cash-register/history?limit=10`).flush(opciones.historial ?? []);
    }
  }

  function iniciar(opciones: { cajas?: any[]; turno?: any; historial?: any[] } = {}) {
    c.ngOnInit();
    responderCarga(opciones);
  }

  beforeEach(() => {
    rol.set(Rol.ADMIN);
    notification.success.calls.reset();
    notification.error.calls.reset();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: { rol } },
        { provide: NotificationService, useValue: notification },
      ],
    });
    c = TestBed.runInInjectionContext(() => new CajasComponent());
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('saldos', () => {
    it('pide las billeteras activas y no el libro de movimientos de ninguna', () => {
      c.ngOnInit();
      const req = http.expectOne(`${api}/wallets/active`);
      expect(req.request.method).toBe('GET');
      req.flush([caja(), caja({ id: 'w2', name: 'Banco', type: 'bank', current_balance: '-120.50' })]);
      http.expectOne(`${api}/cash-register/active`).flush(null);
      http.expectOne(`${api}/cash-register/history?limit=10`).flush([]);

      expect(c.cargando()).toBeFalse();
      expect(c.hayCajas()).toBeTrue();
      expect(c.cajas().length).toBe(2);
      // Ni un solo GET a /wallets/:id/movimientos: el libro es del dueño.
      http.expectNone((r) => r.url.includes('/movimientos'));
    });

    it('el saldo se normaliza a número: el decimal viaja como string', () => {
      iniciar({ cajas: [caja(), caja({ id: 'w2', current_balance: '-120.50' }), caja({ id: 'w3', current_balance: null })] });
      expect(c.saldo(c.cajas()[0])).toBe(15000);
      expect(c.saldo(c.cajas()[1])).toBe(-120.5);
      expect(c.saldo(c.cajas()[2])).toBe(0);
    });

    it('marca en rojo sólo la caja con saldo negativo', () => {
      iniciar({ cajas: [caja(), caja({ id: 'w2', current_balance: '-0.01' }), caja({ id: 'w3', current_balance: '0.00' })] });
      expect(c.cajas().map((w) => c.enRojo(w))).toEqual([false, true, false]);
    });

    it('si el GET no llega lo dice, en vez de dibujar una lista vacía', () => {
      c.ngOnInit();
      http.expectOne(`${api}/wallets/active`).error(new ProgressEvent('error'));
      http.expectOne(`${api}/cash-register/active`).flush(null);
      http.expectOne(`${api}/cash-register/history?limit=10`).flush([]);
      expect(c.fallo()).toBeTrue();
      expect(c.cargando()).toBeFalse();
      expect(c.hayCajas()).toBeFalse();
    });

    it('traduce el tipo de billetera y le pone su ícono', () => {
      expect(c.tipoBilletera('cash')).toBe('Efectivo');
      expect(c.tipoBilletera('bank')).toBe('Banco');
      expect(c.tipoBilletera('digital')).toBe('Digital');
      expect(c.tipoBilletera(undefined)).toBe('');
      expect(c.iconoBilletera('cash')).toBe('caja');
      expect(c.iconoBilletera('bank')).toBe('dinero');
    });
  });

  describe('permisos', () => {
    it('técnico y pañol no piden el turno: el backend les diría 403', () => {
      rol.set(Rol.TECNICO);
      c.ngOnInit();
      http.expectOne(`${api}/wallets/active`).flush([caja()]);
      http.expectNone(`${api}/cash-register/active`);
      http.expectNone((r) => r.url.includes('/cash-register/history'));
      expect(c.puedeOperar()).toBeFalse();
    });

    it('el mostrador opera caja pero no cierra', () => {
      rol.set(Rol.MOSTRADOR);
      iniciar({ turno: turnoAbierto() });
      expect(c.puedeOperar()).toBeTrue();
      expect(c.esAdmin()).toBeFalse();
      c.abrirModalCierre();
      expect(c.modal()).toBeNull();
    });

    it('el admin puede cerrar', () => {
      iniciar({ turno: turnoAbierto() });
      c.abrirModalCierre();
      http.expectOne(`${api}/cash-register/active`).flush(turnoAbierto());
      expect(c.modal()).toBe('cerrar');
    });
  });

  describe('abrir turno', () => {
    it('precarga una fila por billetera activa con el saldo del sistema', () => {
      iniciar({ cajas: [caja(), caja({ id: 'w2', name: 'Banco', current_balance: '500.50' })] });
      c.abrirModalApertura();
      expect(c.modal()).toBe('abrir');
      expect(c.filas().map((f) => [f.wallet_id, f.declarado, f.esperado])).toEqual([
        ['w1', 15000, 15000], ['w2', 500.5, 500.5],
      ]);
    });

    it('manda lo contado, muestra las diferencias de apertura y recarga', () => {
      iniciar({ cajas: [caja()] });
      c.abrirModalApertura();
      c.contar(0, '14900');
      c.confirmarApertura();

      const req = http.expectOne(`${api}/cash-register/open`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ wallet_amounts: [{ wallet_id: 'w1', amount: 14900 }] });
      req.flush({
        ...turnoAbierto(),
        diferencias_apertura: [{ wallet_id: 'w1', billetera: 'Caja mostrador', contado: 14900, segun_sistema: 15000, diferencia: -100 }],
      });

      expect(c.modal()).toBeNull();
      expect(c.diferenciasApertura().length).toBe(1);
      expect(notification.success).toHaveBeenCalled();
      responderCarga({ turno: turnoAbierto() });
    });

    it('un saldo negativo del sistema se precarga en cero y se marca la fila', () => {
      iniciar({ cajas: [caja({ current_balance: '-120.50' }), caja({ id: 'w2', current_balance: '300' })] });
      c.abrirModalApertura();
      expect(c.filas().map((f) => [f.declarado, f.saldoNegativo])).toEqual([[0, true], [300, false]]);
      expect(c.puedeAbrir()).toBeTrue();
    });

    it('si la recarga de después falla, el turno y las diferencias de apertura no se pierden', () => {
      iniciar({ cajas: [caja()] });
      c.abrirModalApertura();
      c.confirmarApertura();
      http.expectOne(`${api}/cash-register/open`).flush({
        ...turnoAbierto(),
        diferencias_apertura: [{ wallet_id: 'w1', billetera: 'Caja mostrador', contado: 1, segun_sistema: 2, diferencia: -1 }],
      });
      expect(c.turno()?.id).toBe('t1');
      http.expectOne(`${api}/wallets/active`).flush([caja()]);
      http.expectOne(`${api}/cash-register/active`).error(new ProgressEvent('error'));
      http.expectOne(`${api}/cash-register/history?limit=10`).flush([]);
      expect(c.diferenciasApertura().length).toBe(1);
    });

    it('si el backend rechaza, el modal queda abierto y no avisa nada propio', () => {
      iniciar();
      c.abrirModalApertura();
      c.confirmarApertura();
      http.expectOne(`${api}/cash-register/open`).flush(
        { code: 'CAJA_YA_ABIERTA', message: 'x' }, { status: 409, statusText: 'Conflict' },
      );
      expect(c.modal()).toBe('abrir');
      expect(c.enviando()).toBeFalse();
      expect(notification.error).not.toHaveBeenCalled();
    });
  });

  describe('turno abierto', () => {
    it('lo trae con lo de cada billetera y los movimientos, el más nuevo primero', () => {
      iniciar({ turno: turnoAbierto() });
      expect(c.turno()?.turno_numero).toBe('T-2026-10-21-001');
      expect(c.movimientosDelTurno().map((m) => m.id)).toEqual(['m2', 'm1']);
    });

    it('un movimiento pide monto positivo, motivo y billetera', () => {
      iniciar({ turno: turnoAbierto() });
      c.abrirModalMovimiento('retiro');
      expect(c.modal()).toBe('movimiento');
      expect(c.movWalletId()).toBe('w1');
      expect(c.puedeMover()).toBeFalse();
      c.movMonto.set(200);
      expect(c.puedeMover()).toBeFalse(); // falta el motivo
      c.movMotivo.set('  ');
      expect(c.puedeMover()).toBeFalse();
      c.movMotivo.set('Pago al cadete');
      expect(c.puedeMover()).toBeTrue();
      c.movMonto.set(0);
      expect(c.puedeMover()).toBeFalse();
    });

    it('registra el retiro contra el turno y recarga', () => {
      iniciar({ turno: turnoAbierto() });
      c.abrirModalMovimiento('retiro');
      c.movMonto.set(200);
      c.movMotivo.set(' Pago al cadete ');
      c.confirmarMovimiento();

      const req = http.expectOne(`${api}/cash-register/t1/movement`);
      expect(req.request.body).toEqual({ tipo: 'retiro', monto: 200, motivo: 'Pago al cadete', wallet_id: 'w1' });
      req.flush({});
      expect(c.modal()).toBeNull();
      responderCarga({ turno: turnoAbierto() });
    });
  });

  describe('cerrar turno', () => {
    beforeEach(() => {
      iniciar({ turno: turnoAbierto() });
      c.abrirModalCierre();
      http.expectOne(`${api}/cash-register/active`).flush(turnoAbierto());
    });

    it('arma el conteo con el esperado recién traído, no con el de cuando se cargó la pantalla', () => {
      c.cerrarModal();
      c.abrirModalCierre();
      const nuevo = turnoAbierto();
      nuevo.walletBalances[0].expected_amount = '17000.00';
      http.expectOne(`${api}/cash-register/active`).flush(nuevo);
      expect(c.filas()[0].esperado).toBe(17000);
    });

    it('arranca sin contar: no se puede cerrar hasta declarar todas las billeteras', () => {
      expect(c.filas().map((f) => f.declarado)).toEqual([null, null]);
      expect(c.puedeCerrar()).toBeFalse();
      c.contar(0, '16000');
      expect(c.puedeCerrar()).toBeFalse();
      c.contar(1, '500');
      expect(c.puedeCerrar()).toBeTrue();
    });

    it('calcula la diferencia en vivo por billetera y en total', () => {
      c.contar(0, '15900');
      c.contar(1, '520');
      expect(c.diferenciaFila(c.filas()[0])).toBe(-100);
      expect(c.diferenciaFila(c.filas()[1])).toBe(20);
      expect(c.totalEsperadoConteo()).toBe(16500);
      expect(c.totalDeclaradoConteo()).toBe(16420);
      expect(c.totalDiferenciaConteo()).toBe(-80);
    });

    it('con diferencia exige motivo; sin diferencia no', () => {
      c.contar(0, '15900');
      c.contar(1, '500');
      expect(c.conDiferencia()).toBeTrue();
      expect(c.puedeCerrar()).toBeFalse();
      c.notas.set('   ');
      expect(c.puedeCerrar()).toBeFalse();
      c.notas.set('Faltó vuelto');
      expect(c.puedeCerrar()).toBeTrue();

      c.contar(0, '16000');
      c.notas.set('');
      expect(c.conDiferencia()).toBeFalse();
      expect(c.puedeCerrar()).toBeTrue();
    });

    it('manda lo declarado y las notas, y recarga', () => {
      c.contar(0, '15900');
      c.contar(1, '500');
      c.notas.set(' Faltó vuelto ');
      c.confirmarCierre();

      const req = http.expectOne(`${api}/cash-register/t1/close`);
      expect(req.request.body).toEqual({
        wallet_declared_amounts: [
          { wallet_id: 'w1', declared_amount: 15900 }, { wallet_id: 'w2', declared_amount: 500 },
        ],
        notas: 'Faltó vuelto',
      });
      req.flush({});
      expect(c.modal()).toBeNull();
      responderCarga({ turno: null });
      expect(c.turno()).toBeNull();
    });

    it('si el backend pide el motivo (MOTIVO_REQUERIDO) el modal sigue abierto', () => {
      c.contar(0, '16000');
      c.contar(1, '500');
      c.confirmarCierre();
      http.expectOne(`${api}/cash-register/t1/close`).flush(
        { code: 'MOTIVO_REQUERIDO', message: 'x' }, { status: 400, statusText: 'Bad Request' },
      );
      expect(c.modal()).toBe('cerrar');
      expect(c.enviando()).toBeFalse();
    });

    it('un campo vacío vuelve a "sin contar", no a cero', () => {
      c.contar(0, '100');
      c.contar(0, '');
      expect(c.filas()[0].declarado).toBeNull();
    });
  });

  describe('historial', () => {
    it('despliega y pliega el detalle por billetera', () => {
      iniciar({ historial: [{ id: 'h1', turno_numero: 'T-1', walletBalances: [] }] });
      expect(c.historial().length).toBe(1);
      expect(c.estaExpandido('h1')).toBeFalse();
      c.alternarDetalle('h1');
      expect(c.estaExpandido('h1')).toBeTrue();
      c.alternarDetalle('h1');
      expect(c.estaExpandido('h1')).toBeFalse();
    });
  });
});
