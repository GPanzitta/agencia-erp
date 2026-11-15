/**
 * CLI-03: ¿el cliente que se está por crear ya existe? Misma regla de claves
 * que propone la auditoría para el backend (y que ya usan los pedidos web):
 * - teléfono: los últimos 8 dígitos (así «15-3844-1251», «011 3844-1251» y
 *   «+54 9 11 3844 1251» son el mismo);
 * - documento: sólo los dígitos («30.111.222» = «30111222»);
 * - correo: en minúsculas y sin espacios.
 *
 * Es un aviso, no un bloqueo: dos personas pueden compartir un teléfono fijo.
 */

export interface ClienteComparable {
  id?: string;
  nombre?: string | null;
  apellido?: string | null;
  telefono?: string | null;
  telefono_alternativo?: string | null;
  documento?: string | null;
  email?: string | null;
}

export interface ClienteParecido {
  id: string;
  nombre: string;
  apellido?: string | null;
  telefono?: string | null;
  documento?: string | null;
  email?: string | null;
  /** Qué coincide, para leer: «mismo teléfono», «mismo documento y correo». */
  motivo: string;
  /** false = dado de baja (el backend también los devuelve como candidatos). */
  activo?: boolean;
}

const ROTULO_MOTIVO: Record<string, string> = { telefono: 'teléfono', documento: 'documento', email: 'correo' };

const soloDigitos = (v: unknown): string => String(v ?? '').replace(/\D/g, '');

/** Los últimos 8 dígitos; null si no llega a 8 (un interno o un número incompleto no compara). */
export function claveTelefono(v: unknown): string | null {
  const d = soloDigitos(v);
  return d.length >= 8 ? d.slice(-8) : null;
}

/** Documento sólo con dígitos; null si quedan menos de 6 (no es un DNI ni un CUIT). */
export function claveDocumento(v: unknown): string | null {
  const d = soloDigitos(v);
  return d.length >= 6 ? d : null;
}

export function claveEmail(v: unknown): string | null {
  const e = String(v ?? '').trim().toLowerCase();
  return e.includes('@') ? e : null;
}

/** «a», «a y b», «a, b y c». */
function enumerar(xs: string[]): string {
  return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
}

function telefonos(c: ClienteComparable): string[] {
  return [claveTelefono(c.telefono), claveTelefono(c.telefono_alternativo)].filter((x): x is string => !!x);
}

/** Los clientes de `lista` que coinciden con `nuevo` en teléfono, documento o correo (los primeros `max`). */
export function posiblesDuplicados(nuevo: ClienteComparable, lista: ClienteComparable[], max = 3): ClienteParecido[] {
  const tels = telefonos(nuevo);
  const doc = claveDocumento(nuevo.documento);
  const mail = claveEmail(nuevo.email);
  if (!tels.length && !doc && !mail) return [];

  const salida: ClienteParecido[] = [];
  for (const c of lista ?? []) {
    if (!c?.id || (nuevo.id && c.id === nuevo.id)) continue;
    const motivos: string[] = [];
    if (tels.length && telefonos(c).some((t) => tels.includes(t))) motivos.push('teléfono');
    if (doc && claveDocumento(c.documento) === doc) motivos.push('documento');
    if (mail && claveEmail(c.email) === mail) motivos.push('correo');
    if (!motivos.length) continue;
    salida.push({
      id: c.id,
      nombre: c.nombre ?? '',
      apellido: c.apellido ?? null,
      telefono: c.telefono ?? null,
      documento: c.documento ?? null,
      email: c.email ?? null,
      motivo: `mismo ${enumerar(motivos)}`,
    });
    if (salida.length >= max) break;
  }
  return salida;
}

/**
 * Lo que propone CLI-03 para la tanda 2 del backend: `POST /customers` responde
 * 409 `CLIENTE_POSIBLE_DUPLICADO` con los `candidatos`, salvo que venga
 * `forzar: true`. Devuelve los candidatos si el error es ése (lista vacía si no
 * los trae) y null si es otro error. Tolerante: hasta que el backend lo mande,
 * nunca devuelve nada distinto de null.
 */
export function candidatosDelBackend(err: unknown): ClienteParecido[] | null {
  const cuerpo = (err as { error?: any })?.error;
  if (!cuerpo || cuerpo.code !== 'CLIENTE_POSIBLE_DUPLICADO') return null;
  const lista = Array.isArray(cuerpo.candidatos) ? cuerpo.candidatos : [];
  return lista
    .filter((c: any) => c && c.id)
    .map((c: any) => ({
      id: String(c.id),
      nombre: String(c.nombre ?? ''),
      apellido: c.apellido ?? null,
      telefono: c.telefono ?? null,
      documento: c.documento ?? null,
      email: c.email ?? null,
      // Contrato de 2d38af3: `motivos: ('telefono' | 'documento' | 'email')[]` y `activo`.
      motivo: Array.isArray(c.motivos) && c.motivos.length
        ? `mismo ${enumerar(c.motivos.map((m: string) => ROTULO_MOTIVO[m] ?? m))}`
        : String(c.motivo ?? 'el sistema lo marcó como parecido'),
      activo: c.activo === false ? false : true,
    }));
}

/**
 * La misma regla que aplica el backend al importar (customers/claves-cliente.util):
 * mismo documento, o mismo teléfono y mismo nombre. Lo que coincide acá se omite.
 */
export function clavesDeImportacion(c: ClienteComparable): string[] {
  const claves: string[] = [];
  const doc = soloDigitos(c.documento);
  if (doc.length >= 7) claves.push(`doc:${doc}`);
  const tel = claveTelefono(c.telefono);
  const nombre = `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim().toLowerCase();
  if (tel && nombre) claves.push(`tel:${tel}|${nombre}`);
  return claves;
}
