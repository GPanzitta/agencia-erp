import { Unidad } from './autos.service';
import { plata, renglon } from './autos.util';

export type FormatoPlaca = 'historia' | 'post';
export type SelloPlaca = 'ingreso' | 'oportunidad' | 'financiacion' | 'vendido';

const TEXTO_SELLO: Record<SelloPlaca, { texto: string; fondo: string; tinta: string }> = {
  ingreso: { texto: 'RECIÉN INGRESADO', fondo: '#F5BE0B', tinta: '#162028' },
  oportunidad: { texto: '¡OPORTUNIDAD / BAJÓ DE PRECIO!', fondo: '#E01B12', tinta: '#FFFFFF' },
  financiacion: { texto: 'TOMAMOS TU USADO · CUOTAS FIJAS', fondo: '#1F4FA3', tinta: '#FFFFFF' },
  vendido: { texto: '¡VENDIDO! GRACIAS POR CONFIAR', fondo: '#23794A', tinta: '#FFFFFF' },
};

function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function dibujarCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  const ratioImg = img.width / img.height;
  const ratioBox = w / h;
  let sw = img.width;
  let sh = img.height;
  let sx = 0;
  let sy = 0;
  if (ratioImg > ratioBox) {
    sw = img.height * ratioBox;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / ratioBox;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/**
 * Genera y descarga una placa PNG lista para Historias de Instagram / Estados
 * de WhatsApp (1080×1920, 9:16) o Post cuadrado (1080×1080, 1:1).
 */
export async function descargarPlacaRedes(opts: {
  unidad: Unidad;
  fotoUrl: string | null;
  formato: FormatoPlaca;
  sello: SelloPlaca;
  agenciaNombre: string;
  sitioUrl: string;
}): Promise<void> {
  const { unidad, fotoUrl, formato, sello, agenciaNombre, sitioUrl } = opts;
  const ancho = 1080;
  const alto = formato === 'historia' ? 1920 : 1080;

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Fondo base asfalto oscuro
  const gradFondo = ctx.createLinearGradient(0, 0, 0, alto);
  gradFondo.addColorStop(0, '#121A20');
  gradFondo.addColorStop(1, '#1E2A32');
  ctx.fillStyle = gradFondo;
  ctx.fillRect(0, 0, ancho, alto);

  // 2. Foto del vehículo
  const altoFoto = formato === 'historia' ? 1180 : 660;
  const img = fotoUrl ? await cargarImagen(fotoUrl) : null;
  if (img) {
    dibujarCover(ctx, img, 0, 0, ancho, altoFoto);
  } else {
    ctx.fillStyle = '#26343F';
    ctx.fillRect(0, 0, ancho, altoFoto);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = '900 96px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(unidad.marca.toUpperCase(), ancho / 2, altoFoto / 2);
  }

  // Degradado inferior sobre la foto para fundir con la tarjeta
  const gradSombra = ctx.createLinearGradient(0, altoFoto - 240, 0, altoFoto);
  gradSombra.addColorStop(0, 'rgba(18,26,32,0)');
  gradSombra.addColorStop(1, '#182229');
  ctx.fillStyle = gradSombra;
  ctx.fillRect(0, altoFoto - 240, ancho, 240);

  // 3. Banda superior con nombre de la agencia
  ctx.fillStyle = 'rgba(18, 26, 32, 0.82)';
  ctx.fillRect(0, 0, ancho, 110);
  ctx.fillStyle = '#F5BE0B';
  ctx.fillRect(0, 106, ancho, 4);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 36px Arial, sans-serif';
  ctx.fillText((agenciaNombre || 'AGENCIA DE AUTOS').toUpperCase(), 56, 68);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#C9D1D6';
  ctx.font = '600 26px Arial, sans-serif';
  ctx.fillText(unidad.numero, ancho - 56, 66);

  // 4. Sello destacado
  const cfgSello = TEXTO_SELLO[sello];
  const ySello = altoFoto - 72;
  ctx.fillStyle = cfgSello.fondo;
  ctx.fillRect(56, ySello, ancho - 112, 68);

  ctx.textAlign = 'center';
  ctx.fillStyle = cfgSello.tinta;
  ctx.font = '800 30px Arial, sans-serif';
  ctx.fillText(cfgSello.texto, ancho / 2, ySello + 45);

  // 5. Bloque de datos del auto
  let cursorY = altoFoto + (formato === 'historia' ? 95 : 65);
  ctx.textAlign = 'left';

  // Título (Marca + Modelo)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = formato === 'historia' ? '900 64px Arial, sans-serif' : '900 50px Arial, sans-serif';
  const titulo = `${unidad.marca} ${unidad.modelo}`.toUpperCase();
  ctx.fillText(titulo.slice(0, 26), 56, cursorY);

  // Versión
  if (unidad.version) {
    cursorY += formato === 'historia' ? 52 : 40;
    ctx.fillStyle = '#9AA7B0';
    ctx.font = formato === 'historia' ? '600 36px Arial, sans-serif' : '600 28px Arial, sans-serif';
    ctx.fillText(unidad.version.slice(0, 40), 56, cursorY);
  }

  // Renglón técnico (Año · Km · Caja)
  cursorY += formato === 'historia' ? 66 : 48;
  ctx.fillStyle = '#E2E6E4';
  ctx.font = formato === 'historia' ? '700 38px Arial, sans-serif' : '700 30px Arial, sans-serif';
  ctx.fillText(renglon(unidad), 56, cursorY);

  // Precio grande en amarillo vial
  cursorY += formato === 'historia' ? 125 : 82;
  ctx.fillStyle = '#F5BE0B';
  ctx.font = formato === 'historia' ? '900 92px Arial, sans-serif' : '900 68px Arial, sans-serif';
  const precioTexto = sello === 'vendido'
    ? '¡UNIDAD VENDIDA!'
    : unidad.precio_venta !== null
      ? plata(unidad.precio_venta, unidad.moneda)
      : 'CONSULTAR PRECIO';
  ctx.fillText(precioTexto, 56, cursorY);

  // Beneficios adicionales en formato Historia
  if (formato === 'historia') {
    cursorY += 86;
    ctx.fillStyle = '#C9D1D6';
    ctx.font = '600 32px Arial, sans-serif';
    ctx.fillText('✓ Papeles verificados listos para transferir', 56, cursorY);
    cursorY += 50;
    ctx.fillText('✓ Recibimos tu usado en parte de pago', 56, cursorY);
    cursorY += 50;
    ctx.fillText('✓ Financiación en cuotas fijas', 56, cursorY);
  }

  // 6. Pie de la placa con dirección web
  const limpioSitio = sitioUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  ctx.fillStyle = '#10171C';
  ctx.fillRect(0, alto - 88, ancho, 88);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 28px Arial, sans-serif';
  ctx.fillText(limpioSitio, ancho / 2, alto - 34);

  // 7. Descargar PNG
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${unidad.numero}-${formato}-${sello}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
