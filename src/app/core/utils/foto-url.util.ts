import { environment } from '../../../environments/environment';
import { abrirExterna } from './abrir-externa.util';

/**
 * Las URLs de fotos y archivos que guarda el backend son de dos clases: en
 * dev, relativas a su origen (`/uploads/...`); con Cloudinary (deploy),
 * absolutas (`https://res.cloudinary.com/...`) y se usan tal cual. Vivía
 * duplicado en varios componentes; va a un solo lugar.
 */
export function urlFoto(f: string): string {
  if (/^https?:\/\//i.test(f)) return f;
  // SEG-08: lo relativo va siempre como ruta del backend. Pegado tal cual, un
  // valor «@otro-dominio/x» armaba «https://api@otro-dominio/x»: otro host.
  const ruta = String(f ?? '');
  return environment.apiUrl.replace(/\/api$/, '') + (ruta.startsWith('/') ? ruta : '/' + ruta);
}

/** "Correa A-33 / 2" → "correa-a-33-2": nombre de archivo sin acentos ni símbolos. */
export function nombreDeArchivo(texto: string): string {
  const limpio = (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return limpio || 'foto';
}

/**
 * Descarga una foto con nombre propio (pedido del usuario 07/09/2026). Las
 * fotos viven en el origen del backend, así que `<a download>` solo no
 * alcanza: el navegador ignora `download` entre orígenes y abre la imagen.
 * Se baja a blob y se guarda desde un enlace local. Si el fetch falla, se
 * abre en otra pestaña para que igual se pueda guardar a mano.
 */
export async function descargarFoto(url: string, nombre: string): Promise<boolean> {
  const absoluta = /^https?:\/\//.test(url) ? url : urlFoto(url);
  const extension = (absoluta.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
  const archivo = `${nombreDeArchivo(nombre)}.${extension}`;
  try {
    const respuesta = await fetch(absoluta);
    if (!respuesta.ok) throw new Error(String(respuesta.status));
    const blob = await respuesta.blob();
    const objeto = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = objeto;
    enlace.download = archivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(objeto), 1000);
    return true;
  } catch {
    abrirExterna(absoluta);
    return false;
  }
}
