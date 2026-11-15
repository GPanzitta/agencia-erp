import { TipoPieza } from '../utils/tipo-pieza.util';

/** Espejo de `perfil-publico.entity.ts` del backend (S1a §3.1). */
export const ACENTOS = ['amarillo', 'naranja', 'celeste', 'verde', 'rojo', 'violeta', 'fuego'] as const;
export type Acento = (typeof ACENTOS)[number];

export const ICONOS_SERVICIO = [
  'lavarropas', 'heladera', 'microondas', 'aire', 'cocina', 'secarropas', 'lavavajillas', 'herramienta',
] as const;
export type IconoServicio = (typeof ICONOS_SERVICIO)[number];

export type CampoImagen = 'logo' | 'isotipo' | 'portada' | 'equipo' | 'trabajo';

export interface Horario { dias: string; desde: string; hasta: string }
export interface Redes { instagram?: string; facebook?: string; tiktok?: string; sitio?: string }
export interface Servicio { nombre: string; frase: string; icono: IconoServicio }
export interface FotoTrabajo { url: string; miniatura: string; pie?: string }
export interface Cifras { reparaciones?: number; opiniones?: number; garantia_dias?: number }

/**
 * Un video de YouTube del sitio. El backend guarda `{ id, titulo, canal,
 * titulo_personalizado }` — `titulo` y `canal` los resuelve él contra
 * `oembed` y acá son de sólo lectura. `url` es lo ÚNICO que viaja en el
 * PATCH; para los que ya estaban guardados se reconstruye desde el `id`.
 */
export interface VideoPerfil {
  id: string;
  titulo: string | null;
  canal: string | null;
  titulo_personalizado: string | null;
  url: string;
}

/** Cómo viaja cada video en el PATCH (S1c-b §3.2). */
export interface VideoEnviable {
  url: string;
  titulo_personalizado?: string;
}

/** Los equipos de la consola de la portada. */
export type EquipoSintoma = 'lavarropas' | 'heladera' | 'microondas' | 'televisor' | 'aire';
/** Un repuesto de la tienda elegido para una causa: el nombre viaja para no tener que ir a buscarlo. */
export interface RepuestoElegido { id: string; nombre: string }
export interface CausaSintoma {
  causa: string;
  senal: string;
  tiempo: string;
  tipo: TipoPieza | null;
  repuestos: RepuestoElegido[];
}
/** Un síntoma de la consola: el mismo síntoma puede tener hasta 4 causas. */
export interface SintomaConfig { equipo: EquipoSintoma; sintoma: string; causas: CausaSintoma[] }

export interface PerfilPublico {
  eslogan: string | null;
  quienes_somos: string | null;
  zona: string | null;
  /** Place ID de Google, para traer las opiniones. Nunca sale al público. */
  google_place_id: string | null;
  color_acento: Acento;
  logo_url: string | null;
  isotipo_url: string | null;
  portada_url: string | null;
  foto_equipo_url: string | null;
  /** Video de portada subido al ERP (Cloudinary o `/uploads/...`). */
  video_url: string | null;
  /** Primer cuadro del video, que genera Cloudinary. En almacén local es `null`. */
  video_poster_url: string | null;
  horarios: Horario[];
  redes: Redes;
  marcas: string[];
  servicios: Servicio[];
  fotos_trabajos: FotoTrabajo[];
  cifras: Cifras;
  videos: VideoPerfil[];
  /** Nunca null: si el taller nunca guardó, el backend devuelve la lista de fábrica. */
  sintomas: SintomaConfig[];
  /** «Te lo instalamos» (spec 2026-11-07 §8.3): para todo el taller, apagado por defecto. */
  instalacion_activa: boolean;
  /** Las condiciones de la instalación, en texto libre. */
  instalacion_texto: string | null;
  /** Si el taller vende repuestos. Apagado, el sitio no ofrece buscar piezas; prendido por defecto. */
  vende_repuestos: boolean;
}

/**
 * Lo que acepta el PATCH. No es `Partial<PerfilPublico>` porque `videos` sale
 * con otra forma que la que entra: el backend recibe enlaces y devuelve ids
 * con título resuelto.
 */
export type CambiosPerfil = Partial<Omit<PerfilPublico, 'videos'>> & { videos?: VideoEnviable[] };

export const PERFIL_VACIO: PerfilPublico = {
  eslogan: null, quienes_somos: null, zona: null, google_place_id: null, color_acento: 'amarillo',
  logo_url: null, isotipo_url: null, portada_url: null, foto_equipo_url: null, video_url: null, video_poster_url: null,
  horarios: [], redes: {}, marcas: [], servicios: [], fotos_trabajos: [], cifras: {}, videos: [], sintomas: [],
  instalacion_activa: false, instalacion_texto: null, vende_repuestos: true,
};

export const TOPES = {
  eslogan: 120, quienes_somos: 2000, zona: 160, horarios: 7, marcas: 30, servicios: 8, fotos_trabajos: 12, pie: 120,
  video_mb: 25, videos: 6, titulo_video: 80, url_video: 300, google_place_id: 300, instalacion_texto: 200,
} as const;

/** Lo que contesta `POST .../perfil-publico/google/probar` (S1c-b §3.4). */
export interface PruebaGoogle {
  promedio: number | null;
  total: number | null;
  simulada: boolean;
}

/** Una posición de un lugar de fotos del sitio: la original o la que subió el taller. */
export interface FotoDelSitio {
  url: string;
  miniatura: string;
  propia: boolean;
}

/** Un lugar de la página (portada, marcas, el taller…) con una foto por posición. */
export interface LugarFotoSitio {
  clave: string;
  seccion: string;
  titulo: string;
  fotos: FotoDelSitio[];
}

/** Lo que contestan todos los endpoints de `.../perfil-publico/fotos-sitio` y `video-portada`. */
export interface FotosDelSitio {
  lugares: LugarFotoSitio[];
  video_portada: { url: string; propio: boolean };
}
