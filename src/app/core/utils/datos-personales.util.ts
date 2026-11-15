import { Rol } from '../interfaces/auth.interface';

/**
 * DAT-02: datos personales del cliente en pantalla según el puesto (pedido
 * del dueño, 14/10/2026; el pañol se sumó el 15/10). Mostrador y admin
 * atienden al cliente y los ven completos. Técnico, pañol y chofer no los necesitan para su tarea fuera de
 * «Mi ruta» (ahí el teléfono y la dirección de cada parada se ven enteros):
 * en listados, búsquedas y fichas les salen tapados.
 *
 * Es una defensa de PANTALLA: el backend todavía manda los datos completos a
 * esos roles (pendiente en el informe). Sirve contra la mirada por encima del
 * hombro, la captura de pantalla y la foto al monitor, no contra quien abre
 * las herramientas del navegador.
 */
export type DatoPersonal = 'telefono' | 'email' | 'documento';

const ROLES_CON_DATOS_TAPADOS: ReadonlySet<string> = new Set([Rol.TECNICO, Rol.PANOL, Rol.CHOFER]);

export function veDatosCompletos(rol: Rol | string | null | undefined): boolean {
  // Sin rol (todavía cargando) no se muestra nada de más.
  return !!rol && !ROLES_CON_DATOS_TAPADOS.has(rol);
}

const PUNTOS = '••••';

/** Ya lo tapó el backend (o ya pasó por acá): trae el «•». */
export function yaTapado(v: string): boolean {
  return v.includes('•');
}

/** «•••• 7788»: los últimos 4 dígitos alcanzan para reconocerlo al teléfono. */
export function taparTelefono(t: string): string {
  const digitos = t.replace(/\D/g, '');
  return digitos.length > 4 ? `${PUNTOS} ${digitos.slice(-4)}` : PUNTOS;
}

/** «j•••@gmail.com». */
export function taparEmail(e: string): string {
  const [usuario, dominio] = e.split('@');
  if (!dominio) return PUNTOS;
  return `${usuario.charAt(0)}•••@${dominio}`;
}

/** «•••• 678»: los últimos 3 del DNI o CUIT. */
export function taparDocumento(d: string): string {
  const limpio = d.replace(/[^0-9A-Za-z]/g, '');
  return limpio.length > 3 ? `${PUNTOS} ${limpio.slice(-3)}` : PUNTOS;
}

export function datoParaRol(valor: string | null | undefined, tipo: DatoPersonal, rol: Rol | string | null | undefined): string {
  const v = String(valor ?? '').trim();
  if (!v || veDatosCompletos(rol)) return v;
  // El backend también empieza a mandarlos ya tapados a técnico y chofer
  // («•••• 7788»): si ya vienen con los puntos, van tal cual. Taparlos de
  // nuevo perdería los últimos dígitos o duplicaría los puntos.
  if (yaTapado(v)) return v;
  if (tipo === 'telefono') return taparTelefono(v);
  if (tipo === 'email') return taparEmail(v);
  return taparDocumento(v);
}

/**
 * Las coincidencias del buscador global vienen como `{ campo: 'Teléfono',
 * valor: '1155667788' }`: buscar «5566» le mostraría el número entero al
 * técnico. Con el rótulo se sabe qué tapar; el resto (nombre, equipo, N° de
 * orden) va tal cual.
 */
const DATO_DE_ROTULO: Record<string, DatoPersonal> = {
  'teléfono': 'telefono', 'tel. alternativo': 'telefono', 'email': 'email', 'correo': 'email', 'dni / cuit': 'documento',
};

export function datoPersonalDeRotulo(rotulo: string | null | undefined): DatoPersonal | null {
  return DATO_DE_ROTULO[String(rotulo ?? '').trim().toLowerCase()] ?? null;
}
