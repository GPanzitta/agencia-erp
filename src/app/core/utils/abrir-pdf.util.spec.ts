import { of, throwError } from 'rxjs';
import { abrirPdfEnPestana } from './abrir-pdf.util';

describe('abrirPdfEnPestana', () => {
  it('abre la pestaña en el clic y le carga el PDF cuando llega', () => {
    const ventana = { location: { href: '' }, close: jasmine.createSpy('close') };
    spyOn(window, 'open').and.returnValue(ventana as any);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:pdf-1');
    abrirPdfEnPestana(of(new Blob(['%PDF-'], { type: 'application/pdf' })));
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(ventana.location.href).toBe('blob:pdf-1');
  });

  it('SEG-ERP-06: la pestaña recibe siempre un PDF, aunque la respuesta diga text/html', () => {
    const ventana = { location: { href: '' }, close: jasmine.createSpy('close') };
    spyOn(window, 'open').and.returnValue(ventana as any);
    const crear = spyOn(URL, 'createObjectURL').and.returnValue('blob:pdf-2');
    abrirPdfEnPestana(of(new Blob(['<script>alert(1)</script>'], { type: 'text/html' })));
    expect((crear.calls.mostRecent().args[0] as Blob).type).toBe('application/pdf');
  });

  it('si el pedido falla, cierra la pestaña vacía', () => {
    const ventana = { location: { href: '' }, close: jasmine.createSpy('close') };
    spyOn(window, 'open').and.returnValue(ventana as any);
    abrirPdfEnPestana(throwError(() => new Error('403')));
    expect(ventana.close).toHaveBeenCalled();
  });
});
