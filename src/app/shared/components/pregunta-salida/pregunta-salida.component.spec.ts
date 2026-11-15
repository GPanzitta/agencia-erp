import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreguntaSalidaComponent } from './pregunta-salida.component';
import { EleccionSalida } from '../../utils/pregunta-salida';

/** El diálogo «Tenés cambios sin guardar»: foco en lo seguro, Tab atrapado, Escape = seguir. */
describe('PreguntaSalidaComponent', () => {
  let fixture: ComponentFixture<PreguntaSalidaComponent>;
  let elegidas: EleccionSalida[];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PreguntaSalidaComponent] });
    fixture = TestBed.createComponent(PreguntaSalidaComponent);
    fixture.componentRef.setInput('detalle', 'teléfono, correo');
    elegidas = [];
    fixture.componentInstance.elegir.subscribe((e) => elegidas.push(e));
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  const el = (sel: string): HTMLButtonElement => fixture.nativeElement.querySelector(sel);

  it('dice qué se perdería, es un diálogo modal y arranca con el foco en «Seguir editando»', () => {
    expect(fixture.nativeElement.textContent).toContain('Cambios sin guardar: teléfono, correo');
    expect(fixture.nativeElement.querySelector('.ps-dialogo[role="dialog"][aria-modal="true"]')).not.toBeNull();
    expect(document.activeElement).toBe(el('.ps-seguir'));
  });

  it('cada botón avisa su elección', () => {
    el('.ps-seguir').click();
    el('.ps-descartar').click();
    el('.ps-guardar').click();
    expect(elegidas).toEqual(['seguir', 'descartar', 'guardar']);
  });

  it('Escape es «Seguir editando»', () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(elegidas).toEqual(['seguir']);
  });

  it('Tab da la vuelta adentro del diálogo y trae el foco si se escapó', () => {
    const seguir = el('.ps-seguir');
    const guardar = el('.ps-guardar');
    guardar.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    guardar.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(seguir);
    seguir.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(guardar);
    guardar.blur();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(fixture.nativeElement.contains(document.activeElement)).toBeTrue();
  });
});
