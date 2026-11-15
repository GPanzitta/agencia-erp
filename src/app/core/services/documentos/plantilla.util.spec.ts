import {
  chipCondicion, condicionIva, condiciones, diasHasta, documento, esc, fechaCorta, fechaLarga, firma, hero, hoja, hora, kv, lineaPie, pesos, plata,
  razonSocial, soloHttp, sumarMeses, tabla, totales,
} from './plantilla.util';

describe('plantilla.util — formato', () => {
  it('esc escapa lo que viene del usuario', () => {
    expect(esc('<b>"a" & b</b>')).toBe('&lt;b&gt;&quot;a&quot; &amp; b&lt;/b&gt;');
    expect(esc(null)).toBe('');
  });

  it("SEG-ERP-02: esc también escapa la comilla simple (atributos entre ')", () => {
    expect(esc("O'Brien")).toBe('O&#39;Brien');
  });

  it('SEG-ERP-02: soloHttp deja pasar http(s) y descarta cualquier otro esquema', () => {
    expect(soloHttp('https://res.cloudinary.com/x/logo.png')).toBe('https://res.cloudinary.com/x/logo.png');
    expect(soloHttp('  HTTP://api/x.png ')).toBe('HTTP://api/x.png');
    for (const mala of ['javascript:alert(1)', ' javascript:alert(1)', 'data:image/svg+xml,<svg onload=alert(1)>', 'vbscript:x', '//otro.com/x.png', '/uploads/x.png', '', null, undefined]) {
      expect(soloHttp(mala as any)).withContext(String(mala)).toBe('');
    }
  });

  it('plata formatea en pesos es-AR con dos decimales, y en USD a pedido', () => {
    expect(plata(1234.5)).toBe('$ 1.234,50');
    expect(plata('abc')).toBe('$ 0,00');
    expect(plata(10, true)).toBe('USD 10,00');
  });

  it('pesos (papel del cliente) no muestra «,00» en los enteros y acepta el decimal como string', () => {
    expect(pesos(450000)).toBe('$ 450.000');
    expect(pesos('15000.00')).toBe('$ 15.000');
    expect(pesos(1234.5)).toBe('$ 1.234,50');
  });

  it('fechaCorta con dos cifras; una fecha sin hora es un día local, no medianoche UTC', () => {
    // Parseada como ISO, "2026-09-08" sería el 7/9 a las 21:00 en Argentina.
    expect(fechaCorta('2026-09-08')).toBe('08/09/2026');
    expect(fechaLarga('2026-09-08')).toBe('8 de septiembre de 2026');
    expect(fechaLarga(null)).toBe('');
  });

  it('hora en 24 h', () => {
    expect(hora(new Date(2026, 8, 25, 15, 51))).toBe('15:51');
  });

  it('diasHasta cuenta días enteros de calendario, negativos si ya pasó', () => {
    const hoy = new Date(2026, 8, 8, 15, 0);
    expect(diasHasta(new Date(2026, 8, 10, 3, 0), hoy)).toBe(2);
    expect(diasHasta(new Date(2026, 8, 1), hoy)).toBe(-7);
    expect(diasHasta(null, hoy)).toBe(0);
  });

  it('sumarMeses: un día que no existe en el mes de llegada queda en el último', () => {
    expect(sumarMeses(new Date(2026, 8, 9), 6)).toEqual(new Date(2027, 2, 9));
    expect(sumarMeses(new Date(2026, 7, 31), 6)).toEqual(new Date(2027, 1, 28));
  });
});

describe('plantilla.util — identificación del prestador', () => {
  it('razón social con respaldo en el nombre del taller', () => {
    expect(razonSocial({ name: 'Taller', razon_social: 'Taller S.R.L.' })).toBe('Taller S.R.L.');
    expect(razonSocial({ name: 'Taller', razon_social: '  ' })).toBe('Taller');
    expect(razonSocial(null)).toBe('Taller');
  });

  it('condición de IVA impresa; vacía o desconocida, nada', () => {
    expect(condicionIva('responsable_inscripto')).toBe('IVA Responsable Inscripto');
    expect(condicionIva('monotributo')).toBe('Responsable Monotributo');
    expect(condicionIva('exento')).toBe('IVA Exento');
    expect(condicionIva(null)).toBe('');
  });

  it('el pie lleva sólo lo cargado, escapado', () => {
    expect(lineaPie({ name: 'T', cuit: '30-1', direccion: 'Calle <1>' })).toBe('T · CUIT 30-1 · Calle &lt;1&gt;');
    const lleno = lineaPie({ name: 'T', razon_social: 'T SRL', cuit: '30-1', condicion_iva: 'exento', iibb: '9', inicio_actividades: '2020-03-01', direccion: 'C', telefono: '11', email_contacto: 'a@b.c', domain: 't.com' });
    expect(lleno).toBe('T SRL · CUIT 30-1 · IVA Exento · IIBB 9 · Inicio de act. 01/03/2020 · C · Tel. 11 · a@b.c · t.com');
  });
});

describe('plantilla.util — piezas', () => {
  it('kv escapa y pone una raya en lo vacío', () => {
    const html = kv([['Cliente', 'Pérez <script>'], ['DNI', null]]);
    expect(html).toContain('Pérez &lt;script&gt;');
    expect(html).toContain('<div class="k">DNI</div><div>—</div>');
  });

  it('tabla alinea por columna y muestra el vacío cuando no hay filas', () => {
    const cols = [{ texto: '#', alinear: 'centro' as const }, { texto: 'Precio', alinear: 'der' as const, ancho: '20mm' }];
    expect(tabla(cols, [['1', '$ 5']])).toContain('<td style="text-align:right">$ 5</td>');
    expect(tabla(cols, [['1', '$ 5']])).toContain('width:20mm');
    expect(tabla(cols, [], 'Nada.')).toContain('Nada.');
  });

  it('chip de condición: Nuevo, USADO o raya', () => {
    expect(chipCondicion('nuevo')).toBe('<span class="chip">Nuevo</span>');
    expect(chipCondicion('usado')).toBe('<span class="chip usado">USADO</span>');
    expect(chipCondicion(null)).toBe('—');
  });

  it('totales marca la fila destacada', () => {
    const html = totales([{ rotulo: 'Repuestos', valor: '$ 1' }, { rotulo: 'Total', valor: '$ 2', destacado: true }], 'Nota');
    expect(html).toContain('<div class="k big"><span>Total</span>');
    expect(html).toContain('<div class="k"><span>Repuestos</span>');
    expect(html).toContain('Nota');
  });

  it('condiciones numeradas con el título en negrita y el texto con mayúscula', () => {
    const html = condiciones([['Retiro', 'tenés 30 días']]);
    expect(html).toContain('<div class="nn">1</div><div><b class="t">Retiro</b>Tenés 30 días</div>');
  });

  it('hero sin QR ocupa todo el ancho; con QR, lo muestra con su texto', () => {
    expect(hero({ etiqueta: 'A', grande: 'B', datos: [] })).toContain('class="hero sin-qr"');
    const con = hero({ etiqueta: 'A', grande: 'B', datos: [{ rotulo: 'X', valor: '1' }], qr: '<svg></svg>', qrTexto: 'Seguí' });
    expect(con).toContain('<div class="qrb"><svg></svg>Seguí</div>');
  });

  it('firma: la frase arriba y una línea por rótulo', () => {
    const html = firma('Acepto', ['Firma', 'DNI']);
    expect(html).toContain('<div class="acepto">Acepto</div>');
    expect(html).toContain('grid-template-columns:1fr 1fr');
  });
});

describe('plantilla.util — chasis', () => {
  const empresa = { name: 'Taller Demo', direccion: 'Av. Siempreviva 742', telefono: '11-5555', cuit: '30-1' };

  it('membrete de la empresa usuaria, título, número, leyenda X y pie con la página', () => {
    const html = documento('Presupuesto PR-1', [hoja({ titulo: 'Presupuesto', numero: 'PR-1', meta: 'Orden OR-1', cuerpo: '<p>cuerpo</p>', copia: 'Original para el cliente', pagina: '1 de 2' }, empresa)]);
    expect(html).toContain('<title>Presupuesto PR-1</title>');
    expect(html).toContain('<b>Taller Demo</b>');
    expect(html).toContain('Av. Siempreviva 742');
    expect(html).toContain('Tel. 11-5555');
    expect(html).toContain('CUIT 30-1');
    expect(html).toContain('<h1>Presupuesto</h1>');
    expect(html).toContain('N° PR-1');
    expect(html).toContain('<span class="x">X</span>DOCUMENTO NO VÁLIDO COMO FACTURA');
    expect(html).toContain('<p>cuerpo</p>');
    expect(html).toContain('Original para el cliente<br>Página 1 de 2');
    expect(html).not.toContain('24.240'); // el chasis no impone una ley: cada papel pone la suya
  });

  it('carga Montserrat y Figtree como cargaba Barlow, y mide en mm y pt', () => {
    const html = documento('X', []);
    expect(html).toContain('fonts.googleapis.com/css2?family=Montserrat');
    expect(html).toContain('family=Figtree');
    expect(html).toContain('@page { size: A4; margin: 0; }');
    expect(html).toContain('width: 210mm');
  });

  it('nada legal por debajo de 10 pt ni rótulos en gris claro', () => {
    const html = documento('X', []);
    for (const clase of ['.cond .it', '.legal', '.paso', '.card', 'table']) {
      const regla = html.slice(html.indexOf(`\n${clase} {`));
      expect(regla.slice(0, regla.indexOf('}'))).withContext(clase).toContain('font-size: 10pt');
    }
    expect(html).not.toContain('#9ca3af');
  });

  it('hoja de continuación: membrete de una línea con la referencia', () => {
    const html = hoja({ titulo: 'Presupuesto', numero: 'PR-1', continuacion: 'Orden OR-1', cuerpo: '' }, { ...empresa, razon_social: 'Demo SRL' });
    expect(html).toContain('class="mini"');
    expect(html).toContain('Presupuesto N° PR-1<span>Orden OR-1 · Demo SRL · CUIT 30-1</span>');
  });

  it('con logo lo usa; sin logo, el nombre del taller', () => {
    expect(hoja({ titulo: 'A', numero: '1', cuerpo: '' }, { ...empresa, logo_url: 'https://x/logo.png' })).toContain('<img class="logo" src="https://x/logo.png"');
    expect(hoja({ titulo: 'A', numero: '1', cuerpo: '' }, empresa)).toContain('<div class="marca">Taller Demo</div>');
  });

  it('SEG-ERP-02: un logo con esquema que no es http(s) no entra al src: sale el nombre', () => {
    const html = hoja({ titulo: 'A', numero: '1', cuerpo: '' }, { ...empresa, logo_url: 'javascript:alert(1)' });
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<div class="marca">Taller Demo</div>');
  });

  it('un papel interno cambia la X por su leyenda', () => {
    const html = hoja({ titulo: 'Hoja de ruta', numero: '1', cuerpo: '', leyenda: { interno: 'CONFIDENCIAL' } }, empresa);
    expect(html).toContain('xchip interno">CONFIDENCIAL');
    expect(html).not.toContain('NO VÁLIDO COMO FACTURA');
  });

  it('documento() arma varias hojas A4 en una sola impresión', () => {
    const html = documento('OS 1', [hoja({ titulo: 'A', numero: '1', cuerpo: 'uno' }, empresa), hoja({ titulo: 'A', numero: '1', cuerpo: 'dos' }, empresa)]);
    expect(html.split('<section class="page">').length - 1).toBe(2);
    expect(html).toContain('break-after: page');
  });

  it('sin empresa cargada igual sale un papel legible', () => {
    const html = hoja({ titulo: 'Orden de compra', numero: 'OC-1', cuerpo: '' }, null);
    expect(html).toContain('<b>Taller</b>');
  });
});
