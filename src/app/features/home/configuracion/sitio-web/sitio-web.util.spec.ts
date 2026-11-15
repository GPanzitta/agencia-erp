import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';

import { PERFIL_VACIO } from '../../../../core/models/perfil-publico.model';
import {
  armarCambios, asignarErroresBackend, colorDeAcento, hhmm, limpiarErroresBackend, nombreDeIcono,
  textoPruebaGoogle, urlDeYoutube, videosEnviables, diasAgendaSinHorario,
} from './sitio-web.util';

/**
 * Guardar manda sólo lo que cambió: el PATCH del backend es parcial y un
 * campo que viaja igual que estaba no aporta nada más que ruido en el log.
 */
describe('armarCambios', () => {
  it('sin cambios → objeto vacío', () => {
    expect(armarCambios(PERFIL_VACIO, { ...PERFIL_VACIO })).toEqual({});
  });

  it('textos y acento cambiados salen; los iguales no', () => {
    const actual = { ...PERFIL_VACIO, eslogan: 'Hola', color_acento: 'verde' as const };
    expect(armarCambios(PERFIL_VACIO, actual)).toEqual({ eslogan: 'Hola', color_acento: 'verde' });
  });

  it('un texto borrado viaja como null, no como ""', () => {
    const inicial = { ...PERFIL_VACIO, eslogan: 'Hola' };
    expect(armarCambios(inicial, { ...inicial, eslogan: '' })).toEqual({ eslogan: null });
    expect(armarCambios(inicial, { ...inicial, eslogan: '   ' })).toEqual({ eslogan: null });
  });

  it('listas: reordenar, vaciar o cambiar un elemento cuenta como cambio', () => {
    const inicial = { ...PERFIL_VACIO, marcas: ['LG', 'Samsung'] };
    expect(armarCambios(inicial, { ...inicial, marcas: ['Samsung', 'LG'] })).toEqual({ marcas: ['Samsung', 'LG'] });
    expect(armarCambios(inicial, { ...inicial, marcas: [] })).toEqual({ marcas: [] });
    expect(armarCambios(inicial, { ...inicial, marcas: ['LG', 'Samsung'] })).toEqual({});
  });

  it('cifras: los campos vacíos no viajan; garantía en blanco se saca', () => {
    const inicial = { ...PERFIL_VACIO, cifras: { reparaciones: 10, garantia_dias: 180 } };
    expect(armarCambios(inicial, { ...inicial, cifras: { reparaciones: 10, garantia_dias: undefined } })).toEqual({ cifras: { reparaciones: 10 } });
  });

  it('CLI-14 y CLI-23: la garantía y las opiniones del sitio ya no viajan; si estaban guardadas, se sacan', () => {
    const conPisada = { ...PERFIL_VACIO, cifras: { reparaciones: 10, opiniones: 130, garantia_dias: 180 } };
    expect(armarCambios(conPisada, { ...conPisada, cifras: { reparaciones: 10 } })).toEqual({ cifras: { reparaciones: 10 } });
    expect(armarCambios(PERFIL_VACIO, { ...PERFIL_VACIO, cifras: { garantia_dias: 180, opiniones: 5 } })).toEqual({});
    const limpio = { ...PERFIL_VACIO, cifras: { reparaciones: 10 } };
    expect(armarCambios(limpio, { ...limpio })).toEqual({});
  });

  it('las URLs de imagen no se mandan por el PATCH (las escribe la subida)', () => {
    expect(armarCambios(PERFIL_VACIO, { ...PERFIL_VACIO, logo_url: '/uploads/x.webp' })).toEqual({});
  });

  it('un servicio igual no cuenta como cambio aunque jsonb devuelva las claves en otro orden', () => {
    const inicial = { ...PERFIL_VACIO, servicios: [{ frase: 'x', icono: 'aire' as const, nombre: 'Aire' }] };
    const actual = { ...PERFIL_VACIO, servicios: [{ nombre: 'Aire', frase: 'x', icono: 'aire' as const }] };
    expect(armarCambios(inicial, actual)).toEqual({});
  });
});

describe('hhmm', () => {
  it('completa la hora de un dígito con un cero adelante', () => {
    expect(hhmm('9:00')).toBe('09:00');
  });
  it('deja igual una hora ya completa', () => {
    expect(hhmm('18:00')).toBe('18:00');
  });
  it('completa minutos de un solo dígito', () => {
    expect(hhmm('9:5')).toBe('09:05');
  });
  it('una hora sin minutos se completa con :00', () => {
    expect(hhmm('9')).toBe('09:00');
  });
  it('el punto como separador de minutos se normaliza', () => {
    expect(hhmm('09.00')).toBe('09:00');
  });
  it('lo que no se puede interpretar como hora devuelve vacío', () => {
    expect(hhmm('9 a 18')).toBe('');
    expect(hhmm('abc')).toBe('');
  });
});

describe('colorDeAcento / nombreDeIcono', () => {
  it('cada acento tiene fondo y tinta legible; cada ícono un nombre', () => {
    expect(colorDeAcento('amarillo')).toEqual({ fondo: '#f5c518', tinta: '#0e1620' });
    expect(colorDeAcento('rojo')).toEqual({ fondo: '#ef4444', tinta: '#0e1620' });
    // Fuego es el degradé del logo; encima va negro puro (#0B0B0B da 4,25:1 sobre el rojo).
    expect(colorDeAcento('fuego')).toEqual({ fondo: 'linear-gradient(120deg, #EB0100, #FF7801)', tinta: '#000000' });
    expect(nombreDeIcono('lavavajillas')).toBe('Lavavajillas');
  });
});

/**
 * El 400 del backend (`traducirValidacion` + `FiltroDeErrores`) trae
 * `message` con UN RENGLÓN POR CAMPO separado por `\n` y `campos[]` en el
 * mismo orden. El pareo es por índice, no por el prefijo del renglón: el
 * prefijo es el nombre VISIBLE del campo (`Nombre:` para `servicios.0.nombre`)
 * y no siempre coincide con la ruta del control.
 */
describe('asignarErroresBackend', () => {
  function formDePrueba(): FormGroup {
    return new FormGroup({
      eslogan: new FormControl('', Validators.maxLength(120)),
      redes: new FormGroup({ instagram: new FormControl('') }),
      videos: new FormArray([
        new FormGroup({ url: new FormControl('') }),
        new FormGroup({ url: new FormControl('') }),
      ]),
    });
  }

  it('cada renglón cae bajo su campo, sin el prefijo y con mayúscula inicial', () => {
    const form = formDePrueba();
    const r = asignarErroresBackend(form, {
      message: 'eslogan: es más largo de lo permitido.\nvideos.1.url: El video no permite embebido o no existe.',
      campos: ['eslogan', 'videos.1.url'],
    });
    expect(r.asignados).toEqual(['eslogan', 'videos.1.url']);
    expect(r.sueltos).toEqual([]);
    expect(form.get('eslogan')?.errors?.['backend']).toBe('Es más largo de lo permitido.');
    expect(form.get('eslogan')?.touched).toBeTrue();
    expect(form.get('videos.1.url')?.errors?.['backend']).toBe('El video no permite embebido o no existe.');
  });

  it('un campo que no existe en el formulario queda suelto, para el toast', () => {
    const form = formDePrueba();
    const r = asignarErroresBackend(form, {
      message: 'servicios: tiene que ser una lista.',
      campos: ['servicios'],
    });
    expect(r.asignados).toEqual([]);
    expect(r.sueltos).toEqual(['servicios: tiene que ser una lista.']);
  });

  // Hallazgo 1 (revisión final): `campos[i]` puede ser la ruta de un
  // FormGroup/FormArray entero (`@IsArray()`/`@IsObject()` sobre el
  // contenedor). Sin control hoja donde pintarlo, tiene que ir al toast en
  // vez de colgar en silencio de un grupo que ningún template lee.
  it('un renglón cuyo campo es un contenedor (FormGroup/FormArray) no se asigna: queda suelto', () => {
    const form = formDePrueba();
    const r = asignarErroresBackend(form, {
      message: 'videos: Hasta 6 videos.',
      campos: ['videos'],
    });
    expect(r.asignados).toEqual([]);
    expect(r.sueltos).toEqual(['videos: Hasta 6 videos.']);
    expect(form.get('videos')?.errors?.['backend']).toBeUndefined();
  });

  it('sin `campos` (o con un cuerpo vacío) no se pierde nada: todo va suelto', () => {
    const form = formDePrueba();
    expect(asignarErroresBackend(form, { message: 'Revisá los datos cargados.' }).sueltos)
      .toEqual(['Revisá los datos cargados.']);
    expect(asignarErroresBackend(form, null)).toEqual({ asignados: [], sueltos: [] });
  });

  it('limpiarErroresBackend saca el error del backend y devuelve el de validación local', () => {
    const form = formDePrueba();
    form.get('eslogan')?.setValue('x'.repeat(121));
    asignarErroresBackend(form, { message: 'eslogan: es más largo de lo permitido.', campos: ['eslogan'] });
    expect(form.get('eslogan')?.errors?.['backend']).toBeDefined();
    limpiarErroresBackend(form);
    expect(form.get('eslogan')?.errors?.['backend']).toBeUndefined();
    expect(form.get('eslogan')?.errors?.['maxlength']).toBeDefined();
    // Hallazgo 3 (revisión final): sin esto el form raíz podía quedar VALID
    // de mentira (el `onlySelf` de antes no le avisaba al ancestro que el
    // control seguía inválido por su propio validador).
    expect(form.invalid).toBeTrue();
  });

  // Hallazgo 1 (revisión final): `limpiarErroresBackend` tiene que sacar el
  // `backend` también del propio contenedor (no sólo de sus hijos), para el
  // caso de un grupo/array que lo tenga puesto directamente.
  it('limpiarErroresBackend también saca el error puesto directamente en un contenedor', () => {
    const form = formDePrueba();
    (form.get('videos') as FormArray).setErrors({ backend: 'Hasta 6 videos.' });
    (form.get('redes') as FormGroup).setErrors({ backend: 'x' });
    limpiarErroresBackend(form);
    expect(form.get('videos')?.errors).toBeNull();
    expect(form.get('redes')?.errors).toBeNull();
  });
});

/**
 * `videos` es el único campo que sale con otra forma que la que entra: el
 * backend devuelve ids con título resuelto y recibe enlaces.
 */
describe('videos de YouTube', () => {
  const video = (id: string, extra: Partial<{ titulo_personalizado: string | null; url: string }> = {}) => ({
    id, titulo: `Título de ${id}`, canal: 'Taller', titulo_personalizado: null,
    url: urlDeYoutube(id), ...extra,
  });

  it('urlDeYoutube arma el enlace canónico', () => {
    expect(urlDeYoutube('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('videosEnviables manda url y título propio; sin título propio manda sólo la url', () => {
    expect(videosEnviables([video('aaa'), video('bbb', { titulo_personalizado: '  Cómo cambiar la correa  ' })]))
      .toEqual([
        { url: 'https://www.youtube.com/watch?v=aaa' },
        { url: 'https://www.youtube.com/watch?v=bbb', titulo_personalizado: 'Cómo cambiar la correa' },
      ]);
  });

  it('videosEnviables descarta las filas sin enlace (una fila recién agregada y vacía)', () => {
    expect(videosEnviables([{ id: '', titulo: null, canal: null, titulo_personalizado: null, url: '   ' }])).toEqual([]);
  });

  it('armarCambios: recargar la pantalla no cuenta como cambio', () => {
    const inicial = { ...PERFIL_VACIO, videos: [video('aaa')] };
    expect(armarCambios(inicial, { ...inicial, videos: [video('aaa')] })).toEqual({});
  });

  it('armarCambios: reordenar, agregar un enlace o cambiar el título propio manda la lista entera', () => {
    const inicial = { ...PERFIL_VACIO, videos: [video('aaa'), video('bbb')] };
    expect(armarCambios(inicial, { ...inicial, videos: [video('bbb'), video('aaa')] })).toEqual({
      videos: [{ url: 'https://www.youtube.com/watch?v=bbb' }, { url: 'https://www.youtube.com/watch?v=aaa' }],
    });
    expect(armarCambios(inicial, { ...inicial, videos: [video('aaa', { titulo_personalizado: 'Correa' }), video('bbb')] })).toEqual({
      videos: [
        { url: 'https://www.youtube.com/watch?v=aaa', titulo_personalizado: 'Correa' },
        { url: 'https://www.youtube.com/watch?v=bbb' },
      ],
    });
    expect(armarCambios(inicial, { ...inicial, videos: [] })).toEqual({ videos: [] });
  });
});

/** Lo que dice el botón "Probar" (S1c-b §4.1). Sin `toLocaleString`: Edge headless viene con ICU reducido. */
describe('textoPruebaGoogle', () => {
  it('con clave: estrella, promedio con coma y cantidad', () => {
    expect(textoPruebaGoogle({ promedio: 4.8, total: 132, simulada: false })).toBe('★ 4,8 · 132 opiniones');
    expect(textoPruebaGoogle({ promedio: 5, total: 1, simulada: false })).toBe('★ 5 · 1 opinión');
  });

  it('sin clave: lo dice, sin nombrar a Google como si hubiera contestado', () => {
    expect(textoPruebaGoogle({ promedio: 4.8, total: 132, simulada: true }))
      .toBe('Simulado: sin clave de Google en el servidor');
  });

  it('sin promedio no inventa un número', () => {
    expect(textoPruebaGoogle({ promedio: null, total: null, simulada: false })).toBe('★ — · 0 opiniones');
  });
});

describe('diasAgendaSinHorario (CLI-21)', () => {
  it('la agenda de lunes a sábado contra un sitio de lunes a viernes avisa el sábado', () => {
    expect(diasAgendaSinHorario([{ dias: 'Lun a Vie' }], [1, 2, 3, 4, 5, 6])).toEqual(['sábado']);
    expect(diasAgendaSinHorario([{ dias: 'Lun a Vie' }, { dias: 'Sáb' }], [1, 2, 3, 4, 5, 6])).toEqual([]);
  });

  it('sin horarios o con uno escrito a mano, no avisa', () => {
    expect(diasAgendaSinHorario([], [1, 2, 3])).toEqual([]);
    expect(diasAgendaSinHorario([{ dias: 'Feriados' }], [6])).toEqual([]);
  });
});
