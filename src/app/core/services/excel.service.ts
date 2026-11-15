import { Injectable } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { celdaSegura } from '../utils/exportacion.util';

import { decodificarCsv, leerCsv } from '../utils/leer-csv.util';

export interface ColumnaExcel {
  clave: string;
  titulo: string;
  ancho?: number;
}

/**
 * Lectura y escritura de planillas, sobre `exceljs`.
 *
 * Reemplaza a `xlsx` (SheetJS), que arrastra dos vulnerabilidades altas **sin
 * corrección disponible**: prototype pollution (GHSA-4r6h-8v6p-xvw6) y ReDoS
 * (GHSA-5pgg-2g8v-p4x9). No era un riesgo teórico: la importación masiva de
 * clientes hace `read()` sobre un archivo que sube el usuario, así que un
 * .xlsx preparado alcanzaba para dispararlas en el navegador del empleado.
 *
 * La API se mantiene deliberadamente chica —leer a filas planas, escribir
 * desde filas planas— para que ningún componente vuelva a depender de los
 * detalles de una librería de Excel en particular.
 */
@Injectable({ providedIn: 'root' })
export class ExcelService {
  /** Un .csv o un .xlsx, con la misma forma de filas. */
  async leerArchivo(archivo: File): Promise<Record<string, string>[]> {
    if (archivo.name.toLowerCase().endsWith('.csv')) return leerCsv(decodificarCsv(await archivo.arrayBuffer()));
    return this.leerPrimeraHoja(archivo);
  }

  /**
   * Lee la primera hoja y devuelve un objeto por fila, usando la primera fila
   * como encabezado. Los valores salen como texto ya recortado: los
   * componentes venían normalizando a mano con `String(...).trim()`.
   */
  async leerPrimeraHoja(archivo: File): Promise<Record<string, string>[]> {
    const buffer = await archivo.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const hoja = wb.worksheets[0];
    if (!hoja) return [];

    const encabezados: string[] = [];
    hoja.getRow(1).eachCell({ includeEmpty: true }, (celda, col) => {
      encabezados[col] = this.aTexto(celda.value).trim();
    });

    const filas: Record<string, string>[] = [];
    hoja.eachRow({ includeEmpty: false }, (fila, nroFila) => {
      if (nroFila === 1) return; // encabezado

      const registro: Record<string, string> = {};
      let tieneAlgo = false;

      fila.eachCell({ includeEmpty: true }, (celda, col) => {
        const clave = encabezados[col];
        if (!clave) return;
        const valor = this.aTexto(celda.value).trim();
        registro[clave] = valor;
        if (valor) tieneAlgo = true;
      });

      // Las planillas suelen traer filas vacías al final; no son registros.
      if (tieneAlgo) filas.push(registro);
    });

    return filas;
  }

  /**
   * Arma el libro. DAT-01: cada texto pasa por `celdaSegura`, así una celda
   * con «=HYPERLINK(...)» que cargó un cliente no se vuelve fórmula si la
   * planilla se pasa a CSV o se reabre en otro programa.
   */
  armarLibro(nombreHoja: string, columnas: ColumnaExcel[], filas: Record<string, any>[]): ExcelJS.Workbook {
    const wb = new ExcelJS.Workbook();
    const hoja = wb.addWorksheet(nombreHoja);

    hoja.columns = columnas.map((c) => ({
      header: c.titulo,
      key: c.clave,
      width: c.ancho ?? 18,
    }));
    hoja.getRow(1).font = { bold: true };
    filas.forEach((f) => hoja.addRow(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, celdaSegura(v)]))));
    return wb;
  }

  /** Genera un .xlsx y dispara la descarga en el navegador. */
  async descargar(
    nombreArchivo: string,
    nombreHoja: string,
    columnas: ColumnaExcel[],
    filas: Record<string, any>[],
  ): Promise<void> {
    const wb = this.armarLibro(nombreHoja, columnas, filas);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Normaliza el valor de una celda a texto.
   *
   * exceljs devuelve tipos ricos: fechas como `Date`, fórmulas como
   * `{ formula, result }`, celdas con formato como `{ richText: [...] }`,
   * hipervínculos como `{ text, hyperlink }`. Sin aplanar esto, un email
   * escrito en la planilla llega como `[object Object]`.
   */
  private aTexto(valor: ExcelJS.CellValue): string {
    if (valor === null || valor === undefined) return '';
    if (valor instanceof Date) {
      // exceljs arma la fecha en UTC: leída en hora local, en Argentina daría el día anterior.
      const d = String(valor.getUTCDate()).padStart(2, '0');
      const m = String(valor.getUTCMonth() + 1).padStart(2, '0');
      return `${d}-${m}-${valor.getUTCFullYear()}`;
    }
    if (typeof valor === 'object') {
      const v: any = valor;
      if (Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join('');
      if (v.text !== undefined) return String(v.text);
      if (v.result !== undefined) return this.aTexto(v.result);
      if (v.error !== undefined) return '';
      return '';
    }
    // Con coma, como se escribe acá: «120.395» se leería como ciento veinte mil.
    if (typeof valor === 'number') return String(valor).replace('.', ',');
    return String(valor);
  }
}
