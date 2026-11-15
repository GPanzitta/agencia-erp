import { fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { EditorConCambios, PreguntaDeSalida } from './pregunta-salida';

/**
 * La pregunta «Tenés cambios sin guardar», sin plantilla: la usan la ficha de
 * órdenes y la de clientes. El editor es un doble con lo que la pregunta lee.
 */
describe('PreguntaDeSalida', () => {
  let cambios: boolean;
  let guardando: boolean;
  let descartar: jasmine.Spy;
  let guardar: jasmine.Spy;
  let esperarGuardado: jasmine.Spy;
  let s: PreguntaDeSalida;

  beforeEach(() => {
    cambios = true;
    guardando = false;
    descartar = jasmine.createSpy('descartar').and.callFake(() => { cambios = false; });
    guardar = jasmine.createSpy('guardar').and.resolveTo(true);
    esperarGuardado = jasmine.createSpy('esperarGuardado').and.callFake(async () => {
      guardando = false;
      cambios = false;
    });
    const editor: EditorConCambios = {
      hayCambios: () => cambios,
      guardando: () => guardando,
      esperarGuardado: () => esperarGuardado(),
      descartar: () => descartar(),
      guardar: () => guardar(),
    };
    s = new PreguntaDeSalida(() => editor);
  });

  it('sin cambios deja salir en el acto y la acción corre sin preguntar', () => {
    cambios = false;
    expect(s.puedeSalir()).toBeTrue();
    const accion = jasmine.createSpy('accion');
    s.conConfirmacion(accion);
    expect(accion).toHaveBeenCalled();
    expect(s.abierta()).toBeNull();
  });

  it('sin editor (la ficha todavía no montó) también deja salir', () => {
    expect(new PreguntaDeSalida(() => undefined).puedeSalir()).toBeTrue();
  });

  it('con cambios pregunta; «Seguir editando» se queda', async () => {
    const r = s.puedeSalir() as Promise<boolean>;
    expect(s.abierta()).not.toBeNull();
    s.elegir('seguir');
    await expectAsync(r).toBeResolvedTo(false);
    expect(s.abierta()).toBeNull();
    expect(descartar).not.toHaveBeenCalled();
  });

  it('«Descartar» descarta y deja seguir', async () => {
    const r = s.confirmar();
    s.elegir('descartar');
    await expectAsync(r).toBeResolvedTo(true);
    expect(descartar).toHaveBeenCalled();
  });

  it('«Guardar» resuelve con lo que diga el guardado', async () => {
    guardar.and.resolveTo(false);
    const r = s.confirmar();
    s.elegir('guardar');
    await expectAsync(r).toBeResolvedTo(false);
    expect(guardar).toHaveBeenCalled();
  });

  it('conConfirmacion corre la acción después de elegir, y no si se sigue editando', fakeAsync(() => {
    const accion = jasmine.createSpy('accion');
    s.conConfirmacion(accion);
    s.elegir('seguir');
    flushMicrotasks();
    expect(accion).not.toHaveBeenCalled();
    s.conConfirmacion(accion);
    s.elegir('descartar');
    flushMicrotasks();
    expect(accion).toHaveBeenCalledTimes(1);
  }));

  it('con un guardado en curso no pregunta: espera y, si quedó todo guardado, deja seguir', async () => {
    guardando = true;
    const r = s.confirmar();
    expect(s.abierta()).toBeNull();
    await expectAsync(r).toBeResolvedTo(true);
    expect(esperarGuardado).toHaveBeenCalled();
  });

  it('mientras espera un guardado, un segundo pedido no se encola', async () => {
    guardando = true;
    let terminar!: () => void;
    esperarGuardado.and.returnValue(new Promise<void>((r) => (terminar = r)));
    const primero = s.confirmar();
    await expectAsync(s.confirmar()).toBeResolvedTo(false);
    guardando = false;
    cambios = false;
    terminar();
    await expectAsync(primero).toBeResolvedTo(true);
  });

  it('una pregunta nueva da por «Seguir editando» a la anterior', async () => {
    const vieja = s.confirmar();
    const nueva = s.confirmar();
    await expectAsync(vieja).toBeResolvedTo(false);
    expect(s.abierta()).not.toBeNull();
    s.elegir('descartar');
    await expectAsync(nueva).toBeResolvedTo(true);
    expect(s.abierta()).toBeNull();
  });

  it('al cerrarse devuelve el foco adonde estaba', async () => {
    const boton = document.createElement('button');
    document.body.appendChild(boton);
    boton.focus();
    const r = s.confirmar();
    boton.blur();
    s.elegir('seguir');
    await r;
    expect(document.activeElement).toBe(boton);
    boton.remove();
  });
});
