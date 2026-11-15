import { abrirExterna, urlExterna } from './abrir-externa.util';

describe('abrirExterna (SEG-ERP-05)', () => {
  it('deja pasar http(s) absoluto, normalizado', () => {
    expect(urlExterna('https://wa.me/5491122334455?text=hola')).toBe('https://wa.me/5491122334455?text=hola');
    expect(urlExterna('  http://localhost:3100/uploads/a.pdf ')).toBe('http://localhost:3100/uploads/a.pdf');
  });

  it('descarta cualquier otro esquema, relativas y basura', () => {
    for (const mala of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>x</script>', 'blob:https://x/1', 'vbscript:x', '/uploads/a.pdf', '//otro.com/x', 'https://', '', null, undefined]) {
      expect(urlExterna(mala as any)).withContext(String(mala)).toBeNull();
    }
  });

  it('abre en pestaña nueva sin opener; con una URL mala no abre nada', () => {
    const abrir = spyOn(window, 'open');
    expect(abrirExterna('https://wa.me/1')).toBeTrue();
    expect(abrir).toHaveBeenCalledWith('https://wa.me/1', '_blank', 'noopener');
    abrir.calls.reset();
    expect(abrirExterna('javascript:alert(document.cookie)')).toBeFalse();
    expect(abrir).not.toHaveBeenCalled();
  });
});
