import {
  Acento, CambiosPerfil, Cifras, IconoServicio, PerfilPublico, PruebaGoogle, VideoEnviable, VideoPerfil,
} from '../../../../core/models/perfil-publico.model';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

/**
 * Opciones cerradas de `horarios[].dias`: el portal arma el JSON-LD de
 * horario de atención a partir de estas claves, así que no puede ser texto
 * libre. Un perfil viejo puede traer otra cosa; el componente la agrega
 * como opción extra para no perderla (ver `agregarDiaSiHaceFalta`).
 */
export const DIAS_HORARIO: { valor: string; etiqueta: string }[] = [
  { valor: 'Lun a Vie', etiqueta: 'Lunes a viernes' },
  { valor: 'Lun a Sáb', etiqueta: 'Lunes a sábado' },
  { valor: 'Lun a Dom', etiqueta: 'Todos los días' },
  { valor: 'Lun a Jue', etiqueta: 'Lunes a jueves' },
  { valor: 'Lun', etiqueta: 'Lunes' },
  { valor: 'Mar', etiqueta: 'Martes' },
  { valor: 'Mié', etiqueta: 'Miércoles' },
  { valor: 'Jue', etiqueta: 'Jueves' },
  { valor: 'Vie', etiqueta: 'Viernes' },
  { valor: 'Sáb', etiqueta: 'Sábado' },
  { valor: 'Dom', etiqueta: 'Domingo' },
  { valor: 'Sáb y Dom', etiqueta: 'Sábado y domingo' },
];

/** Los días (0 = domingo, como `agenda_config.dias_habiles`) de cada opción de horario. */
const DIAS_DE_HORARIO: Record<string, number[]> = {
  'Lun a Vie': [1, 2, 3, 4, 5], 'Lun a Sáb': [1, 2, 3, 4, 5, 6], 'Lun a Dom': [0, 1, 2, 3, 4, 5, 6], 'Lun a Jue': [1, 2, 3, 4],
  Lun: [1], Mar: [2], 'Mié': [3], Jue: [4], Vie: [5], 'Sáb': [6], Dom: [0], 'Sáb y Dom': [6, 0],
};
const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * CLI-21: los días que la agenda reserva turnos y el sitio publica cerrado.
 * Sin horarios cargados, o con alguno escrito a mano que no se sabe leer, no
 * avisa nada: mejor callar que avisar mal.
 */
export function diasAgendaSinHorario(horarios: { dias: string }[], diasHabiles: number[] | null | undefined): string[] {
  if (!horarios?.length || !diasHabiles?.length) return [];
  const cubiertos = new Set<number>();
  for (const h of horarios) {
    const dias = DIAS_DE_HORARIO[(h.dias ?? '').trim()];
    if (!dias) return [];
    dias.forEach((d) => cubiertos.add(d));
  }
  return [...new Set(diasHabiles)].filter((d) => d >= 0 && d <= 6 && !cubiertos.has(d)).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => NOMBRE_DIA[d]);
}

const TEXTOS: (keyof PerfilPublico)[] = ['eslogan', 'quienes_somos', 'zona', 'google_place_id', 'instalacion_texto'];
const LISTAS: (keyof PerfilPublico)[] = ['horarios', 'marcas', 'servicios', 'fotos_trabajos'];

/**
 * jsonb de Postgres devuelve las claves ordenadas por longitud y después
 * alfabéticamente, no en el orden en que las arma el form: sin canonizar,
 * `armarCambios` veía un cambio en `servicios` con sólo recargar la
 * pantalla. `canon` ordena las claves de todo objeto anidado antes de
 * comparar por `JSON.stringify`.
 */
const canon = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canon((v as any)[k])]))
      : v;
const igual = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/**
 * Normaliza una hora a `HH:MM` (el `<input type="time">` no pinta una hora
 * sin ceros). El backend no valida el formato de `desde`/`hasta` (son
 * `@IsString() @MaxLength(10)`, texto libre), así que un perfil viejo, una
 * carga directa a la base o cualquier otro cliente de la API puede traer
 * `"9:5"`, `"9"` o `"09.00"`. Se toleran esas variantes; lo que no se
 * puede interpretar como hora devuelve `''` en vez de dejar texto que el
 * input de hora nunca podría pintar.
 */
export function hhmm(t: string): string {
  const m = /^(\d{1,2})(?:[:.](\d{1,2}))?$/.exec((t ?? '').trim());
  if (!m) return '';
  const horas = Number(m[1]);
  const minutos = m[2] !== undefined ? Number(m[2]) : 0;
  if (horas > 23 || minutos > 59) return '';
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

/**
 * CLI-14 y CLI-23: el sitio ya no pisa la garantía de Empresa (lo publicado
 * tiene que coincidir con el certificado) ni muestra «opiniones» tecleadas (el
 * total real viene de Google). De Cifras queda sólo «reparaciones». Si el
 * perfil guardado todavía trae las otras dos, `armarCambios` lo detecta como
 * cambio y el próximo guardado las saca.
 */
const CIFRAS_VIGENTES = ['reparaciones'] as const;
const CIFRAS_TODAS = ['reparaciones', 'opiniones', 'garantia_dias'] as const;

function limpiarCifras(c: Cifras | undefined, claves: readonly (keyof Cifras)[] = CIFRAS_VIGENTES): Cifras {
  const salida: Cifras = {};
  for (const k of claves) {
    const v = c?.[k];
    if (v !== undefined && v !== null && Number.isFinite(Number(v)) && String(v) !== '') salida[k] = Number(v);
  }
  return salida;
}

function limpiarRedes(r: PerfilPublico['redes']): PerfilPublico['redes'] {
  const salida: PerfilPublico['redes'] = {};
  for (const k of ['instagram', 'facebook', 'tiktok', 'sitio'] as const) {
    const v = (r?.[k] ?? '').trim();
    if (v) salida[k] = v;
  }
  return salida;
}

/** El enlace canónico de un video ya guardado: el backend sólo guarda el id. */
export const urlDeYoutube = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/**
 * La lista de videos con la forma del PATCH. Las filas sin enlace (una fila
 * recién agregada que todavía no se completó) no viajan: el backend las
 * rechazaría con un 400 que no ayuda a nadie.
 */
export function videosEnviables(videos: VideoPerfil[]): VideoEnviable[] {
  return (videos ?? [])
    .map((v) => {
      const url = (v.url ?? '').trim() || (v.id ? urlDeYoutube(v.id) : '');
      const titulo = (v.titulo_personalizado ?? '').trim();
      return titulo ? { url, titulo_personalizado: titulo } : { url };
    })
    .filter((v) => !!v.url);
}

/** El PATCH mínimo (S1a §4.3). Las URLs de imagen las escribe la subida, nunca este PATCH. */
export function armarCambios(inicial: PerfilPublico, actual: PerfilPublico): CambiosPerfil {
  const cambios: CambiosPerfil = {};
  for (const campo of TEXTOS) {
    const nuevo = ((actual[campo] as string | null) ?? '').trim() || null;
    if (nuevo !== (inicial[campo] ?? null)) (cambios as any)[campo] = nuevo;
  }
  if (actual.color_acento !== inicial.color_acento) cambios.color_acento = actual.color_acento;
  // Un perfil de un backend anterior no trae el campo: cuenta como apagado.
  if (!!actual.instalacion_activa !== !!inicial.instalacion_activa) cambios.instalacion_activa = !!actual.instalacion_activa;
  // Sin el campo cuenta como prendido: es como vendía el sitio hasta ahora.
  if ((actual.vende_repuestos !== false) !== (inicial.vende_repuestos !== false)) cambios.vende_repuestos = actual.vende_repuestos !== false;
  for (const campo of LISTAS) {
    if (!igual(actual[campo], inicial[campo])) (cambios as any)[campo] = actual[campo];
  }
  // `videos` no entra en LISTAS: entra y sale con formas distintas, así que se
  // comparan las dos como saldrían (`videosEnviables`) y no como se guardan.
  const videos = videosEnviables(actual.videos);
  if (!igual(videos, videosEnviables(inicial.videos))) cambios.videos = videos;
  const redes = limpiarRedes(actual.redes);
  if (!igual(redes, limpiarRedes(inicial.redes))) cambios.redes = redes;
  const cifras = limpiarCifras(actual.cifras);
  if (!igual(cifras, limpiarCifras(inicial.cifras, CIFRAS_TODAS))) cambios.cifras = cifras;
  return cambios;
}

const COLORES: Record<Acento, { fondo: string; tinta: string }> = {
  amarillo: { fondo: '#f5c518', tinta: '#0e1620' },
  naranja: { fondo: '#f97316', tinta: '#0e1620' },
  celeste: { fondo: '#38bdf8', tinta: '#0e1620' },
  verde: { fondo: '#22c55e', tinta: '#0e1620' },
  rojo: { fondo: '#ef4444', tinta: '#0e1620' },
  violeta: { fondo: '#a78bfa', tinta: '#0e1620' },
  // El degradé del logo (spec del portal 2026-09-27 §5). La muestra lo pinta con
  // [style.background]; encima, negro puro: #0B0B0B da 4,25:1 sobre el rojo.
  fuego: { fondo: 'linear-gradient(120deg, #EB0100, #FF7801)', tinta: '#000000' },
};
export const colorDeAcento = (a: Acento) => COLORES[a] ?? COLORES.amarillo;

/**
 * El acento como color de TEXTO en la vista previa, que es oscura. Un degradé
 * no vale en `color` (el rótulo quedaba en el blanco heredado): para Fuego va
 * la punta naranja del logo, que es la que se lee sobre el fondo oscuro. Los
 * demás son un color liso y van tal cual.
 */
export const textoDeAcento = (a: Acento) => (a === 'fuego' ? '#FF7801' : colorDeAcento(a).fondo);

const NOMBRES: Record<IconoServicio, string> = {
  lavarropas: 'Lavarropas', heladera: 'Heladera', microondas: 'Microondas', aire: 'Aire acondicionado',
  cocina: 'Cocina', secarropas: 'Secarropas', lavavajillas: 'Lavavajillas', herramienta: 'Herramienta',
};
export const nombreDeIcono = (i: IconoServicio) => NOMBRES[i] ?? i;

// ─── Errores 400 por campo (deuda I1 de S1a) ────────────────────────────────

/**
 * El cuerpo de un 400 del backend. `message` es un string con un renglón por
 * campo separado por `\n` (`FiltroDeErrores` une los arrays de
 * class-validator antes de salir) y `campos` trae la ruta de cada uno en el
 * MISMO orden. Se tipa `unknown` porque es lo que llega por la red: cualquier
 * otra cosa tiene que degradar sin romper la pantalla.
 */
export interface CuerpoError400 {
  message?: unknown;
  campos?: unknown;
}

export interface ErroresRepartidos {
  /** Rutas de control que recibieron un mensaje (`'eslogan'`, `'videos.1.url'`). */
  asignados: string[];
  /** Renglones sin control hoja al que ir (no existe, o es un grupo/array como `videos`): son los del toast. */
  sueltos: string[];
}

/**
 * "eslogan: es más largo de lo permitido." → "Es más largo de lo permitido."
 *
 * El prefijo es el nombre VISIBLE del campo, que abajo del propio campo
 * sobra. El tope de 60 evita comerse un mensaje que tenga dos puntos por
 * otro motivo ("Sin permiso: revisá la clave").
 */
function sinPrefijo(renglon: string): string {
  const sin = renglon.replace(/^[^:]{1,60}:\s+/, '') || renglon;
  return sin.charAt(0).toUpperCase() + sin.slice(1);
}

/**
 * Reparte los renglones de un 400 entre los controles del formulario.
 *
 * El pareo es POR ÍNDICE contra `campos[]`: los dos arrays los arma el mismo
 * recorrido del backend, y el prefijo del renglón no sirve como clave porque
 * es el nombre visible del campo, no la ruta del control.
 *
 * Si `campos[i]` es la ruta de un FormGroup o un FormArray (`horarios`,
 * `marcas`, `servicios`, `fotos_trabajos`, `videos`, `redes`, `cifras`: el
 * backend puede fallar `@IsArray()`/`@IsObject()` sobre el contenedor
 * entero), no hay control hoja donde pintarlo: el renglón se manda al toast
 * en vez de quedar colgado en un contenedor que ningún template lee.
 */
export function asignarErroresBackend(
  form: FormGroup,
  cuerpo: CuerpoError400 | null | undefined,
): ErroresRepartidos {
  const crudo = cuerpo?.message;
  const texto = typeof crudo === 'string'
    ? crudo
    : Array.isArray(crudo) ? crudo.map((m) => String(m)).join('\n') : '';
  const renglones = texto.split('\n').map((r) => r.trim()).filter(Boolean);
  // En una variable aparte: `Array.isArray(cuerpo?.campos)` acota la
  // expresión, no `cuerpo`, y el acceso siguiente no compilaría.
  const lista = cuerpo?.campos;
  const campos = Array.isArray(lista) ? lista.map((c) => String(c)) : [];

  const asignados: string[] = [];
  const sueltos: string[] = [];
  renglones.forEach((renglon, i) => {
    const campo = campos[i];
    const control = campo ? form.get(campo) : null;
    if (!control || control instanceof FormGroup || control instanceof FormArray) {
      sueltos.push(renglon);
      return;
    }
    control.setErrors({ ...(control.errors ?? {}), backend: sinPrefijo(renglon) });
    control.markAsTouched();
    asignados.push(campo);
  });
  return { asignados, sueltos };
}

/**
 * Borra los errores que puso el backend antes de volver a guardar. Incluye
 * el propio error de un FormGroup/FormArray (ej. `videos`, cuando el 400
 * apuntaba al contenedor entero, no a una fila): dejarlo puesto ahí es el
 * mismo rebote que dejarlo en un campo.
 *
 * Sin esto, `guardar()` rebotaría para siempre en su propio `form.invalid`:
 * el control quedó inválido por un error que ya no es cierto.
 * `updateValueAndValidity` va SIN `onlySelf`: `setErrors(null)` ya propagó
 * VALID hacia arriba, así que si el control vuelve a fallar un validador
 * local hay que avisarle a los ancestros de nuevo, o el form raíz queda
 * VALID de mentira aunque el control esté INVALID. Tampoco emite, para no
 * despertar el `toSignal(form.valueChanges)`.
 */
export function limpiarErroresBackend(control: AbstractControl): void {
  if (control instanceof FormGroup || control instanceof FormArray) {
    Object.values(control.controls).forEach((hijo) => limpiarErroresBackend(hijo));
  }
  if (control.errors?.['backend']) {
    control.setErrors(null);
    control.updateValueAndValidity({ emitEvent: false });
  }
}

/**
 * El resultado del botón "Probar". Cuando no hay clave en el servidor se dice
 * "simulado" y NO se nombra a Google: decir "★ 4,8 en Google" con datos de la
 * fuente simulada sería mentirle al que lo está configurando.
 */
export function textoPruebaGoogle(r: PruebaGoogle): string {
  if (r.simulada) return 'Simulado: sin clave de Google en el servidor';
  // Sin `toLocaleString`: Edge headless trae ICU reducido y devolvería "4.8".
  const promedio = r.promedio === null || r.promedio === undefined ? '—' : String(r.promedio).replace('.', ',');
  const total = Number(r.total ?? 0);
  return `★ ${promedio} · ${total} ${total === 1 ? 'opinión' : 'opiniones'}`;
}
