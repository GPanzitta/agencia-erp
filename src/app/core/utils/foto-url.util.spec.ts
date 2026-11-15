import { descargarFoto, nombreDeArchivo, urlFoto } from './foto-url.util';
import { environment } from '../../../environments/environment';

describe('foto-url.util', () => {
  it('urlFoto apunta al origen del backend', () => {
    expect(urlFoto('/uploads/x.webp')).toBe(environment.apiUrl.replace(/\/api$/, '') + '/uploads/x.webp');
  });

  it('urlFoto deja pasar una URL absoluta (las fotos en Cloudinary vienen con https://)', () => {
    expect(urlFoto('https://res.cloudinary.com/demo/image/upload/v1/ordenes/o1/x.webp'))
      .toBe('https://res.cloudinary.com/demo/image/upload/v1/ordenes/o1/x.webp');
  });

  it('SEG-08: un valor relativo raro no cambia de host', () => {
    const origen = environment.apiUrl.replace(/\/api$/, '');
    const u = new URL(urlFoto('@dominio-ajeno.com/x.webp'));
    expect(u.origin).toBe(new URL(origen).origin);
    expect(urlFoto('uploads/x.webp')).toBe(origen + '/uploads/x.webp');
  });

  it('nombreDeArchivo saca acentos y símbolos', () => {
    expect(nombreDeArchivo('Correa A-33 / 2')).toBe('correa-a-33-2');
    expect(nombreDeArchivo('OR-2026-9011 · Diagnóstico')).toBe('or-2026-9011-diagnostico');
    expect(nombreDeArchivo('   ')).toBe('foto');
  });

  describe('descargarFoto', () => {
    let click: jasmine.Spy;
    beforeEach(() => {
      click = spyOn(HTMLAnchorElement.prototype, 'click');
      spyOn(URL, 'createObjectURL').and.returnValue('blob:x');
      spyOn(URL, 'revokeObjectURL');
      spyOn(window, 'open');
    });

    it('baja la foto a blob y la guarda con nombre propio y la extensión del archivo', async () => {
      spyOn(window, 'fetch').and.resolveTo(new Response(new Blob(['x']), { status: 200 }));
      const ok = await descargarFoto('/uploads/repuestos/r1/a.webp?v=1', 'Correa A-33 1');
      expect(ok).toBeTrue();
      expect(window.fetch).toHaveBeenCalledWith(urlFoto('/uploads/repuestos/r1/a.webp?v=1'));
      const enlace = click.calls.first().object as HTMLAnchorElement;
      expect(enlace.download).toBe('correa-a-33-1.webp');
      expect(enlace.href).toContain('blob:');
      expect(window.open).not.toHaveBeenCalled();
    });

    it('si el fetch falla, abre la foto en otra pestaña', async () => {
      spyOn(window, 'fetch').and.rejectWith(new Error('red'));
      const ok = await descargarFoto('http://backend/uploads/a.jpg', 'x');
      expect(ok).toBeFalse();
      expect(click).not.toHaveBeenCalled();
      expect(window.open).toHaveBeenCalledWith('http://backend/uploads/a.jpg', '_blank', 'noopener');
    });
  });
});
