/**
 * Lee un CSV (spec 2026-10-28 §6). El Excel en castellano lo exporta con `;` y
 * con BOM; otros programas, con `,`. El separador se decide por el encabezado.
 * Devuelve un objeto por fila, con los valores recortados.
 */
export function leerCsv(contenido: string): Record<string, string>[] {
  const texto = contenido.replace(/^﻿/, '');
  const primera = texto.split(/\r?\n/, 1)[0] ?? '';
  const separador = primera.includes(';') ? ';' : ',';

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;
  const cerrarCelda = () => { fila.push(celda.trim()); celda = ''; };
  const cerrarFila = () => { cerrarCelda(); filas.push(fila); fila = []; };

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else celda += c;
    // Sólo abre comillas al empezar la celda: en «TV 32" LG» es parte del texto.
    } else if (c === '"' && !celda.trim()) { celda = ''; entreComillas = true; }
    else if (c === separador) cerrarCelda();
    else if (c === '\n') cerrarFila();
    else if (c !== '\r') celda += c;
  }
  if (celda || fila.length) cerrarFila();

  const [encabezados, ...datos] = filas;
  if (!encabezados) return [];
  return datos
    .filter((f) => f.some((v) => v))
    .map((f) => Object.fromEntries(encabezados.map((e, i) => [e, f[i] ?? '']).filter(([e]) => e)));
}

/** Excel en Windows guarda el CSV en windows-1252 si no se le pide otra cosa. */
export function decodificarCsv(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
