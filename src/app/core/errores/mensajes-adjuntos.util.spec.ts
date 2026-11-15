import { interpretarError } from './mensajes.util';

/** Los avisos de los correos con adjuntos (spec 2026-10-07 §7): dicen qué sacar o qué volver a subir. */
describe('interpretarError — adjuntos del correo', () => {
  const respuesta = (body: any, status = 400) => ({ status, error: body, message: 'Http failure response' });

  it('ARCHIVO_NO_PDF', () => {
    expect(interpretarError(respuesta({ code: 'ARCHIVO_NO_PDF', message: 'x' })).titulo).toBe('Sólo se aceptan archivos PDF');
  });

  it('DOCUMENTO_NO_DISPONIBLE nombra el documento', () => {
    const m = interpretarError(respuesta({ code: 'DOCUMENTO_NO_DISPONIBLE', message: 'x', tipo: 'acta_entrega' }));
    expect(m.titulo).toBe('Ese documento no corresponde al estado de la orden');
    expect(m.detalle).toContain('El acta de entrega todavía no se puede generar');
  });

  it('ADJUNTO_INVALIDO con y sin el nombre del archivo', () => {
    expect(interpretarError(respuesta({ code: 'ADJUNTO_INVALIDO', message: 'x', nombre: 'Factura.pdf' })).detalle).toContain('«Factura.pdf»');
    expect(interpretarError(respuesta({ code: 'ADJUNTO_INVALIDO', message: 'x' })).detalle).toContain('volvé a abrirlo desde la orden');
  });

  it('ADJUNTOS_EXCEDIDOS por cantidad y por peso', () => {
    expect(interpretarError(respuesta({ code: 'ADJUNTOS_EXCEDIDOS', message: 'x', total: 16, tope: 15, motivo: 'cantidad' })).detalle)
      .toBe('Son 16 archivos y entran hasta 15. Sacá alguno.');
    expect(interpretarError(respuesta({ code: 'ADJUNTOS_EXCEDIDOS', message: 'x', total: 22 * 1024 * 1024, tope: 20 * 1024 * 1024, motivo: 'peso' })).detalle)
      .toBe('Suman 22,0 MB y entran hasta 20,0 MB. Sacá alguno.');
  });

  it('ARCHIVO_DEMASIADO_GRANDE (413) dice el tamaño permitido', () => {
    const m = interpretarError(respuesta({ code: 'ARCHIVO_DEMASIADO_GRANDE', message: 'x' }, 413));
    expect(m.titulo).toBe('El archivo es demasiado grande');
    expect(m.detalle).toBe('El archivo pasa el tamaño permitido (10 MB para PDF).');
  });
});
