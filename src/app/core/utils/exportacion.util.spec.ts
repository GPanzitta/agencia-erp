import { celdaSegura, confirmarExportacion } from './exportacion.util';

describe('exportaciones (DAT-01)', () => {
  it('neutraliza lo que una planilla tomaría como fórmula', () => {
    for (const malo of ['=HYPERLINK("http://x","clic")', '@SUM(A1)', '+cmd|"/c calc"!A0', '-2+3+cmd|x', '\t=1', '\r=1']) {
      expect(celdaSegura(malo)).withContext(malo).toBe(`'${malo}`);
    }
  });

  it('no toca números, teléfonos, montos negativos ni texto común', () => {
    for (const bueno of ['+54 9 11 5555-1234', '-15', '-1.234,50', 'Juan Pérez', 'Correa A-33', '']) {
      expect(celdaSegura(bueno)).withContext(bueno).toBe(bueno);
    }
    expect(celdaSegura(1500)).toBe(1500);
    expect(celdaSegura(null)).toBeNull();
  });

  it('pide confirmación con la cantidad; sin registros no exporta', () => {
    const preguntar = jasmine.createSpy('preguntar').and.returnValue(true);
    expect(confirmarExportacion(12, 'gastos', preguntar)).toBeTrue();
    expect(preguntar.calls.mostRecent().args[0]).toContain('12 registros de gastos');
    expect(confirmarExportacion(1, 'gastos', () => false)).toBeFalse();
    preguntar.calls.reset();
    expect(confirmarExportacion(0, 'gastos', preguntar)).toBeFalse();
    expect(preguntar).not.toHaveBeenCalled();
  });
});
