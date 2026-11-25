import { IconName } from '../../../shared/components/icon/icon.component';

/**
 * Qué muestra el menú de la agencia y cuál de sus entradas está prendida.
 * Puro y testeado sin Angular: el componente sólo le pasa el puesto y la URL.
 *
 * Es UX, no seguridad: el backend y los guards de ruta cortan igual. Acá sólo
 * se evita ofrecer pantallas que rebotarían con 403.
 */
export interface ItemNav {
  rotulo: string;
  link: string;
  icono: IconName;
  /** Se prende sólo con la URL exacta (Inicio, que es padre de todo). */
  exacto?: boolean;
  /** Otras rutas que también pertenecen a esta entrada. */
  prefijos?: string[];
  /** Un contador al lado del rótulo; el componente sabe de dónde sale. */
  insignia?: 'reservas_sitio';
}

export interface GrupoNav {
  /** null = el bloque de arriba, sin título. */
  titulo: string | null;
  items: ItemNav[];
}

export interface PermisosNav {
  /** El dueño de la agencia. */
  esAdmin: boolean;
  /** El vendedor (el puesto que el sistema llama «mostrador»). */
  esVendedor: boolean;
}

export function armarGruposNav(p: PermisosNav): GrupoNav[] {
  const vende = p.esAdmin || p.esVendedor;

  const grupos: GrupoNav[] = [
    {
      titulo: null,
      items: [{ rotulo: 'Inicio', link: '/home', icono: 'casa', exacto: true }],
    },
    {
      titulo: 'Autos',
      items: [
        { rotulo: 'Stock', link: '/home/autos', icono: 'inventario', prefijos: ['/home/autos/unidad', '/home/autos/nueva'] },
        { rotulo: 'Taller y Repuestos', link: '/home/taller', icono: 'config' },
        ...(vende ? [{ rotulo: 'Comparar precios', link: '/home/autos/precios', icono: 'tendencia' as IconName }] : []),
      ],
    },
    {
      titulo: 'Ventas',
      items: vende
        ? [
            { rotulo: 'Interesados', link: '/home/autos/interesados', icono: 'campana' },
            { rotulo: 'Órdenes de Venta (OV)', link: '/home/autos/operaciones', icono: 'nota', insignia: 'reservas_sitio' },
          ]
        : [],
    },
    {
      titulo: 'Plata',
      items: [
        ...(vende ? [{ rotulo: 'Cajas', link: '/home/cajas', icono: 'caja' as IconName }] : []),
        ...(p.esAdmin
          ? [
              { rotulo: 'Rentabilidad', link: '/home/margen', icono: 'grafico' as IconName },
              { rotulo: 'Gastos', link: '/home/gastos', icono: 'dinero' as IconName },
              { rotulo: 'Proveedores', link: '/home/proveedores', icono: 'proveedor' as IconName },
            ]
          : []),
      ],
    },
    {
      titulo: 'Agencia',
      items: p.esAdmin
        ? [
            { rotulo: 'Configuración', link: '/home/configuracion', icono: 'config' },
            { rotulo: 'Documentos A4', link: '/home/configuracion/documentos', icono: 'nota' },
            { rotulo: 'Vendedores', link: '/home/configuracion/empleados', icono: 'personas' },
            { rotulo: 'Auditoría', link: '/home/auditoria', icono: 'buscar' },
          ]
        : [],
    },
  ];

  return grupos.filter((g) => g.items.length > 0);
}

/**
 * Entre todas las entradas, la que "posee" la URL: la de link más largo que
 * sea igual a la URL o un prefijo de segmento entero. Así «Vendedores» le gana
 * a «Configuración» en /home/configuracion/empleados.
 */
export function linkActivo(url: string, items: ItemNav[]): string | null {
  const limpia = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  let ganador: string | null = null;
  let largo = -1;

  for (const it of items) {
    const rutas = [it.link, ...(it.prefijos ?? [])];
    for (const ruta of rutas) {
      const coincide = it.exacto ? limpia === ruta : limpia === ruta || limpia.startsWith(ruta + '/');
      if (coincide && ruta.length > largo) {
        largo = ruta.length;
        ganador = it.link;
      }
    }
  }
  return ganador;
}
