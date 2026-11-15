import { NgZone, WritableSignal, signal } from '@angular/core';
import { TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { AuthStatus } from '../interfaces/auth.interface';
import { AuthService } from '../../features/auth/services/auth.service';
import { RecargaService } from './recarga.service';
import {
  CLAVE_ACTIVIDAD, CONTROL_INACTIVIDAD_MS, InactividadService, LIMITE_INACTIVIDAD_MS, THROTTLE_ACTIVIDAD_MS, limiteDeEntorno,
} from './inactividad.service';
import { environment } from '../../../environments/environment';

const MIN = 60_000;
const LIMITE = 10 * MIN;

describe('InactividadService (DAT-05)', () => {
  let estado: WritableSignal<AuthStatus>;
  let auth: { authStatus: () => AuthStatus; logout: jasmine.Spy; cerrarSesionLocal: jasmine.Spy };
  let recarga: { irDeCero: jasmine.Spy };
  let srv: InactividadService;

  beforeEach(() => {
    localStorage.removeItem(CLAVE_ACTIVIDAD);
    estado = signal(AuthStatus.checking);
    auth = { authStatus: estado, logout: jasmine.createSpy('logout'), cerrarSesionLocal: jasmine.createSpy('cerrarSesionLocal') };
    recarga = { irDeCero: jasmine.createSpy('irDeCero') };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: RecargaService, useValue: recarga },
        { provide: LIMITE_INACTIVIDAD_MS, useValue: LIMITE },
      ],
    });
    srv = TestBed.inject(InactividadService);
  });

  afterEach(() => localStorage.removeItem(CLAVE_ACTIVIDAD));

  /** Sesión confirmada: el effect prende el servicio. Dentro de NgZone, como en la app. */
  const conSesion = () => {
    estado.set(AuthStatus.authenticated);
    TestBed.inject(NgZone).run(() => TestBed.flushEffects());
  };
  const fin = () => {
    srv.ngOnDestroy();
    discardPeriodicTasks();
  };
  const mover = () => document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));

  it('el límite sale del environment: 8 h por defecto y cualquier valor raro vuelve a 8 h', () => {
    expect((environment as { inactividadHoras?: number }).inactividadHoras).toBe(8);
    expect(limiteDeEntorno()).toBe(8 * 3_600_000);
    expect(limiteDeEntorno(2)).toBe(2 * 3_600_000);
    expect(limiteDeEntorno(undefined)).toBe(8 * 3_600_000);
    expect(limiteDeEntorno('x')).toBe(8 * 3_600_000);
    expect(limiteDeEntorno(0)).toBe(8 * 3_600_000);
  });

  it('sin sesión no hace nada; con sesión anota la actividad y, pasado el límite quieto, cierra', fakeAsync(() => {
    tick(LIMITE * 2);
    expect(localStorage.getItem(CLAVE_ACTIVIDAD)).toBeNull();
    expect(auth.logout).not.toHaveBeenCalled();

    conSesion();
    expect(Number(localStorage.getItem(CLAVE_ACTIVIDAD))).toBe(Date.now());
    tick(LIMITE - MIN);
    expect(auth.logout).not.toHaveBeenCalled();
    tick(MIN + CONTROL_INACTIVIDAD_MS);
    expect(auth.logout).toHaveBeenCalledTimes(1);
    tick(LIMITE);
    expect(auth.logout).withContext('una sola vez').toHaveBeenCalledTimes(1);
    fin();
  }));

  it('moverse corre el plazo', fakeAsync(() => {
    conSesion();
    tick(LIMITE - MIN);
    mover();
    tick(5 * MIN);
    expect(auth.logout).not.toHaveBeenCalled();
    tick(LIMITE);
    expect(auth.logout).toHaveBeenCalledTimes(1);
    fin();
  }));

  it('throttle: mil movimientos seguidos escriben una vez; pasado el intervalo, otra', fakeAsync(() => {
    conSesion();
    tick(THROTTLE_ACTIVIDAD_MS);
    const escribir = spyOn(Storage.prototype, 'setItem').and.callThrough();
    for (let i = 0; i < 1000; i++) mover();
    expect(escribir).toHaveBeenCalledTimes(1);
    tick(THROTTLE_ACTIVIDAD_MS - 1);
    mover();
    expect(escribir).toHaveBeenCalledTimes(1);
    tick(1);
    mover();
    expect(escribir).toHaveBeenCalledTimes(2);
    fin();
  }));

  it('el mouse no dispara change detection: los eventos se escuchan fuera de NgZone', fakeAsync(() => {
    conSesion();
    const zona = TestBed.inject(NgZone);
    let entradas = 0;
    const sub = zona.onUnstable.subscribe(() => entradas++);
    for (let i = 0; i < 50; i++) mover();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    tick(CONTROL_INACTIVIDAD_MS * 3);
    expect(entradas).toBe(0);
    sub.unsubscribe();
    fin();
  }));

  it('al abrir la app con la última actividad ya vencida, cierra en el acto', fakeAsync(() => {
    localStorage.setItem(CLAVE_ACTIVIDAD, String(Date.now() - LIMITE - 1));
    conSesion();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    fin();
  }));

  it('al abrir la app con actividad reciente (de otra pestaña o de recién), sigue', fakeAsync(() => {
    localStorage.setItem(CLAVE_ACTIVIDAD, String(Date.now() - LIMITE + 2 * MIN));
    conSesion();
    expect(auth.logout).not.toHaveBeenCalled();
    fin();
  }));

  it('compartida entre pestañas: la actividad de otra (evento storage) también corre el plazo', fakeAsync(() => {
    conSesion();
    tick(LIMITE - MIN);
    window.dispatchEvent(new StorageEvent('storage', { key: CLAVE_ACTIVIDAD, newValue: String(Date.now()) }));
    tick(5 * MIN);
    expect(auth.logout).not.toHaveBeenCalled();
    fin();
  }));

  it('otra pestaña cerró la sesión (vació el almacenamiento o se fue el token): esta vuelve al login', fakeAsync(() => {
    conSesion();
    window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: 'otro' }));
    expect(recarga.irDeCero).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(auth.cerrarSesionLocal).toHaveBeenCalledTimes(1);
    expect(recarga.irDeCero).toHaveBeenCalledOnceWith('/auth/login');
    fin();
  }));

  it('al cerrarse la sesión se apaga: ni escucha ni controla', fakeAsync(() => {
    conSesion();
    estado.set(AuthStatus.notAuthenticated);
    TestBed.flushEffects();
    const escribir = spyOn(Storage.prototype, 'setItem').and.callThrough();
    tick(THROTTLE_ACTIVIDAD_MS);
    mover();
    tick(LIMITE * 2);
    expect(escribir).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
    fin();
  }));
});
