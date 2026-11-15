import * as ExcelJS from 'exceljs';
import { ExcelService } from './excel.service';

describe('ExcelService (DAT-01)', () => {
  it('las celdas de texto que parecen fórmula salen neutralizadas; números y teléfonos, intactos', () => {
    const wb = new ExcelService().armarLibro('Hoja', [{ clave: 'a', titulo: 'A' }, { clave: 'b', titulo: 'B' }], [
      { a: '=HYPERLINK("http://atacante","Ver")', b: 1500 },
      { a: '+54 9 11 5555-1234', b: -15 },
    ]);
    const hoja = wb.worksheets[0];
    expect(hoja.getCell('A2').value).toBe('\'=HYPERLINK("http://atacante","Ver")');
    expect(hoja.getCell('A2').formula).toBeFalsy();
    expect(hoja.getCell('B2').value).toBe(1500);
    expect(hoja.getCell('A3').value).toBe('+54 9 11 5555-1234');
    expect(hoja.getCell('B3').value).toBe(-15);
  });
});

describe('ExcelService: lo que viene en las celdas', () => {
  const leerDe = async (valores: any[]) => {
    const wb = new ExcelJS.Workbook();
    const hoja = wb.addWorksheet('H');
    hoja.addRow(['a']);
    for (const v of valores) hoja.addRow([v]);
    const buffer = await wb.xlsx.writeBuffer();
    const archivo = new File([buffer as ArrayBuffer], 'a.xlsx');
    return (await new ExcelService().leerPrimeraHoja(archivo)).map((f) => f['a']);
  };

  it('una fecha conserva su día, también en Argentina', async () => {
    expect(await leerDe([new Date(Date.UTC(2025, 11, 31))])).toEqual(['31-12-2025']);
  });
  it('un número con decimales sale con coma: 120.395 no se confunde con ciento veinte mil', async () => {
    expect(await leerDe([120.395, 0.125, 1234.5, 1234])).toEqual(['120,395', '0,125', '1234,5', '1234']);
  });
  it('una fórmula da lo mismo que su valor', async () => {
    expect(await leerDe([{ formula: 'A1*2', result: 120.395 }, { formula: 'A1', result: new Date(Date.UTC(2025, 0, 2)) }])).toEqual(['120,395', '02-01-2025']);
  });
});
