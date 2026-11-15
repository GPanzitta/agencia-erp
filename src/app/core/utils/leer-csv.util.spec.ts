import { decodificarCsv, leerCsv } from './leer-csv.util';

describe('leerCsv', () => {
  it('con punto y coma, como exporta el Excel en castellano', () => {
    expect(leerCsv('Nombre;Stock\nTermostato;3\nBomba;1,5')).toEqual([{ Nombre: 'Termostato', Stock: '3' }, { Nombre: 'Bomba', Stock: '1,5' }]);
  });
  it('con coma', () => {
    expect(leerCsv('Nombre,Stock\nTermostato,3')).toEqual([{ Nombre: 'Termostato', Stock: '3' }]);
  });
  it('saca el BOM y entiende los fines de línea de Windows', () => {
    expect(leerCsv('﻿Nombre;Stock\r\nTermostato;3\r\n')).toEqual([{ Nombre: 'Termostato', Stock: '3' }]);
  });
  it('comillas con el separador y comillas dobladas adentro', () => {
    expect(leerCsv('Nombre;Nota\n"Bomba; grande";"dijo ""hola"""')).toEqual([{ Nombre: 'Bomba; grande', Nota: 'dijo "hola"' }]);
  });
  it('un salto de línea entre comillas no parte la fila', () => {
    expect(leerCsv('Nombre;Nota\nBomba;"uno\ndos"')).toEqual([{ Nombre: 'Bomba', Nota: 'uno\ndos' }]);
  });
  it('ignora los renglones vacíos, también los que sólo tienen separadores', () => {
    expect(leerCsv('Nombre;Stock\n\nTermostato;3\n;;\n')).toEqual([{ Nombre: 'Termostato', Stock: '3' }]);
  });
  it('recorta los espacios', () => {
    expect(leerCsv(' Nombre ; Stock \n Termostato ; 3 ')).toEqual([{ Nombre: 'Termostato', Stock: '3' }]);
  });
  it('sin datos, nada', () => {
    expect(leerCsv('')).toEqual([]);
    expect(leerCsv('Nombre;Stock')).toEqual([]);
  });
});

describe('decodificarCsv', () => {
  it('UTF-8 se lee tal cual', () => {
    expect(decodificarCsv(new TextEncoder().encode('Código;Señal').buffer as ArrayBuffer)).toBe('Código;Señal');
  });
  it('el CSV de Excel en Windows (latin1) no rompe los acentos', () => {
    // «Código» en windows-1252: la ó es el byte 0xF3.
    const bytes = new Uint8Array([0x43, 0xf3, 0x64, 0x69, 0x67, 0x6f]);
    expect(decodificarCsv(bytes.buffer as ArrayBuffer)).toBe('Código');
  });
});

describe('leerCsv: comillas sueltas', () => {
  it('una comilla en medio de una celda es parte del texto: no se come los renglones de abajo', () => {
    const r = leerCsv('Equipo;Falla\nTV 32" LG;No prende\nHeladera;No enfría\nMonitor 24";Sin imagen\nHorno;No calienta\n');
    expect(r.map((f) => f['Equipo'])).toEqual(['TV 32" LG', 'Heladera', 'Monitor 24"', 'Horno']);
    expect(r[0]['Falla']).toBe('No prende');
  });
  it('una celda entre comillas sigue pudiendo tener el separador y comillas dobles', () => {
    const r = leerCsv('Equipo;Falla\n"TV; 32"" LG";No prende\n');
    expect(r[0]['Equipo']).toBe('TV; 32" LG');
  });
});
