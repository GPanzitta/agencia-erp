/** Lo que hay para atender hoy en la agencia, en orden de urgencia. Puro: se prueba sin Angular. */
export interface Pendiente {
  clave: string;
  cuantos: number;
  texto: string;
  /** Qué hacer con eso, en una línea. */
  detalle: string;
  link: string;
  parametros?: Record<string, string>;
  /** Lo urgente se pinta distinto: plata esperando o un cliente plantado. */
  urgente: boolean;
}

interface Datos {
  stock: {
    estado: string;
    semaforo: string;
    publicada: boolean;
    precio_venta: number | null;
    dias_en_stock: number;
    papeles?: { estado: string; vence: string | null; vencido: boolean }[];
  }[];
  interesados: { atrasado: boolean; toca_hoy: boolean; cotizacion: { pendiente: boolean }; sugeridas?: unknown[] }[];
  pedidos: { estado: string }[];
  reservas: { reserva_vence: string | null; vencida: boolean }[];
  hoy: Date;
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

export function pendientesDeHoy(d: Datos): Pendiente[] {
  const lista: Pendiente[] = [];
  const agregar = (p: Pendiente) => { if (p.cuantos > 0) lista.push(p); };

  const senas = d.pedidos.filter((p) => p.estado === 'pendiente').length;
  agregar({ clave: 'senas', cuantos: senas, urgente: true, link: '/home/autos/operaciones', parametros: { vista: 'sitio' },
    texto: plural(senas, 'pedido de reserva del sitio', 'pedidos de reserva del sitio'), detalle: 'Fijate si llegó la seña y confirmala.' });

  const atrasados = d.interesados.filter((i) => i.atrasado).length;
  agregar({ clave: 'atrasados', cuantos: atrasados, urgente: true, link: '/home/autos/interesados',
    texto: plural(atrasados, 'interesado sin contactar a tiempo', 'interesados sin contactar a tiempo'), detalle: 'Quedaron de días anteriores.' });

  const deHoy = d.interesados.filter((i) => i.toca_hoy && !i.atrasado).length;
  agregar({ clave: 'hoy', cuantos: deHoy, urgente: false, link: '/home/autos/interesados',
    texto: plural(deHoy, 'interesado para contactar hoy', 'interesados para contactar hoy'), detalle: 'Llamalos o escribiles por WhatsApp.' });

  const conAutos = d.interesados.filter((i) => i.sugeridas && i.sugeridas.length > 0).length;
  agregar({ clave: 'con_autos', cuantos: conAutos, urgente: false, link: '/home/autos/interesados',
    texto: plural(conAutos, 'interesado con autos en stock que le sirven', 'interesados con autos en stock que les sirven'), detalle: 'Entraron autos para su búsqueda: avisales para concretar la visita.' });

  const cotizar = d.interesados.filter((i) => i.cotizacion?.pendiente).length;
  agregar({ clave: 'cotizar', cuantos: cotizar, urgente: false, link: '/home/autos/interesados',
    texto: plural(cotizar, 'cotización de usado sin contestar', 'cotizaciones de usados sin contestar'), detalle: 'Pasales un valor por su auto.' });

  const limite = new Date(d.hoy.getTime() + 3 * 86_400_000).toISOString().slice(0, 10);
  const porVencer = d.reservas.filter((r) => r.vencida || (r.reserva_vence !== null && r.reserva_vence <= limite)).length;
  agregar({ clave: 'reservas', cuantos: porVencer, urgente: false, link: '/home/autos/operaciones',
    texto: plural(porVencer, 'reserva vencida o por vencer', 'reservas vencidas o por vencer'), detalle: 'Cerrá la venta o liberá el auto.' });

  const sinPublicar = d.stock.filter((u) => u.estado === 'disponible' && !u.publicada && u.precio_venta !== null).length;
  agregar({ clave: 'publicar', cuantos: sinPublicar, urgente: false, link: '/home/autos', parametros: { vista: 'disponibles' },
    texto: plural(sinPublicar, 'auto listo que no está en el sitio', 'autos listos que no están en el sitio'), detalle: 'Tienen precio: sólo falta publicarlos.' });

  const papeles = d.stock.filter((u) => u.semaforo === 'rojo').length;
  agregar({ clave: 'papeles', cuantos: papeles, urgente: false, link: '/home/autos',
    texto: plural(papeles, 'auto con papeles que frenan la entrega', 'autos con papeles que frenan la entrega'), detalle: 'Hoy no se pueden entregar.' });

  const hoyIso = d.hoy.toISOString().slice(0, 10);
  const limitePapeles = new Date(d.hoy.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const papelesPorVencer = d.stock.filter((u) =>
    (u.papeles ?? []).some((p) => p.estado === 'ok' && !p.vencido && p.vence !== null && p.vence >= hoyIso && p.vence <= limitePapeles),
  ).length;
  agregar({ clave: 'papeles_vencer', cuantos: papelesPorVencer, urgente: false, link: '/home/autos',
    texto: plural(papelesPorVencer, 'auto con VTV, informe o verificación por vencer', 'autos con VTV, informe o verificación por vencer'),
    detalle: 'Vencen en los próximos 7 días: renovalos antes de entregar.' });

  return lista;
}
