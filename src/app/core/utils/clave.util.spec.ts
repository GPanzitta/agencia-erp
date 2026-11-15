import { FormControl, FormGroup } from '@angular/forms';
import { clavesIguales, LARGO_MAXIMO_CLAVE, LARGO_MINIMO_CLAVE } from './clave.util';

describe('clave.util (SEG-54)', () => {
  it('los mismos largos que el backend', () => {
    expect([LARGO_MINIMO_CLAVE, LARGO_MAXIMO_CLAVE]).toEqual([10, 72]);
  });

  it('clavesIguales: distintas da error; iguales o sin repetir todavía, no', () => {
    const g = (nueva: string, repetida: string) => new FormGroup({ nueva: new FormControl(nueva), repetida: new FormControl(repetida) });
    expect(clavesIguales(g('una-clave-larga', 'otra-clave-larga'))).toEqual({ distintas: true });
    expect(clavesIguales(g('una-clave-larga', 'una-clave-larga'))).toBeNull();
    expect(clavesIguales(g('una-clave-larga', ''))).toBeNull();
  });
});
