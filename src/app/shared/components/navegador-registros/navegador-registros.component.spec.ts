import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DireccionRegistro, NavegadorRegistrosComponent } from './navegador-registros.component';

/** El navegador de registros de las fichas: dibuja y avisa; quien lo usa decide. */
describe('NavegadorRegistrosComponent', () => {
  let fixture: ComponentFixture<NavegadorRegistrosComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NavegadorRegistrosComponent] });
    fixture = TestBed.createComponent(NavegadorRegistrosComponent);
  });

  const boton = (rotulo: string): HTMLButtonElement =>
    fixture.nativeElement.querySelector(`button[aria-label^="${rotulo}"]`);

  it('muestra el título y la posición, y cada botón avisa su dirección', () => {
    fixture.componentRef.setInput('titulo', 'Marta López');
    fixture.componentRef.setInput('posicion', '2 de 5');
    for (const k of ['puedePrimera', 'puedeAnterior', 'puedeSiguiente', 'puedeUltima']) fixture.componentRef.setInput(k, true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.nr-titulo').textContent.trim()).toBe('Marta López');
    expect(fixture.nativeElement.querySelector('.nr-pos').textContent.trim()).toBe('2 de 5');
    const dirs: DireccionRegistro[] = [];
    fixture.componentInstance.ir.subscribe((d) => dirs.push(d));
    for (const r of ['Primera', 'Anterior', 'Siguiente', 'Última']) boton(r).click();
    expect(dirs).toEqual(['primera', 'anterior', 'siguiente', 'ultima']);
  });

  it('lo que no se puede queda apagado; los extremos aceptan un rótulo más preciso', () => {
    fixture.componentRef.setInput('rotuloPrimera', 'Primera (la última cargada)');
    fixture.componentRef.setInput('puedeSiguiente', true);
    fixture.detectChanges();
    expect(boton('Primera').getAttribute('aria-label')).toBe('Primera (la última cargada)');
    expect(boton('Primera').disabled).toBeTrue();
    expect(boton('Anterior').disabled).toBeTrue();
    expect(boton('Siguiente').disabled).toBeFalse();
    expect(fixture.nativeElement.querySelector('.nr-ayuda')).toBeNull();
  });

  it('la ayuda del teclado aparece si se la pasa', () => {
    fixture.componentRef.setInput('ayuda', '← → del teclado');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.nr-ayuda').textContent.trim()).toBe('← → del teclado');
  });
});
