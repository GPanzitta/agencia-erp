import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

import {
  ACENTOS, Acento, CampoImagen, ICONOS_SERVICIO, PERFIL_VACIO, PerfilPublico, Servicio, TOPES, VideoPerfil,
} from '../../../../core/models/perfil-publico.model';
import { PerfilPublicoService } from '../../../../core/services/perfil-publico.service';
import { EmpresaService } from '../../../../core/services/empresa.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { environment } from '../../../../../environments/environment';
import {
  DIAS_HORARIO, armarCambios, asignarErroresBackend, colorDeAcento, diasAgendaSinHorario, hhmm, limpiarErroresBackend,
  nombreDeIcono, textoPruebaGoogle, urlDeYoutube,
} from './sitio-web.util';

/** Usuario (`@taller`) o URL `https://`: mismo patrón que valida el backend (S1a §4.3). */
const PATRON_RED_SOCIAL = /^(https:\/\/\S{1,190}|@?[A-Za-z0-9._-]{1,50})$/;

/** Texto de ayuda de redes, reutilizado como mensaje de error bajo el campo (S1a §4.3). */
const AYUDA_RED_SOCIAL = 'Usuario (@taller) o dirección que empiece con https://';

/**
 * Configuración → Sitio web (S1a §4.3): lo que la home del comercio muestra
 * del taller. Las imágenes suben al elegirse; Guardar manda el PATCH mínimo.
 */
@Component({
  selector: 'app-sitio-web',
  standalone: false,
  templateUrl: './sitio-web.component.html',
  styleUrls: ['./sitio-web.component.scss'],
})
export class SitioWebComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(PerfilPublicoService);
  private empresaService = inject(EmpresaService);
  private notification = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  readonly ACENTOS = ACENTOS;
  readonly ICONOS = ICONOS_SERVICIO;
  readonly TOPES = TOPES;
  readonly DIAS_HORARIO = DIAS_HORARIO;
  readonly colorDeAcento = colorDeAcento;
  readonly nombreDeIcono = nombreDeIcono;
  readonly portalUrl = environment.portalUrl;

  cargando = signal(true);
  guardando = signal(false);
  subiendo = signal<Record<string, boolean>>({});
  subiendoVideo = signal(false);
  probandoGoogle = signal(false);
  /** Resultado del botón "Probar": `ok` decide si se pinta en verde o en rojo. */
  pruebaGoogle = signal<{ ok: boolean; texto: string } | null>(null);
  abierto = signal<string>('identidad');
  nombreTaller = signal('');
  garantiaDias = signal(90);
  marcaNueva = '';

  /** Días que traía un perfil viejo y no están en `DIAS_HORARIO`: se agregan como opción extra para no perderlos. */
  private diasExtra = signal<string[]>([]);
  readonly opcionesDias = computed(() => [
    ...DIAS_HORARIO,
    ...this.diasExtra().map((d) => ({ valor: d, etiqueta: d })),
  ]);

  /** Lo último que devolvió el backend: contra esto se calcula el PATCH. */
  private inicial = signal<PerfilPublico>(PERFIL_VACIO);

  form: FormGroup = this.fb.group({
    eslogan: ['', Validators.maxLength(TOPES.eslogan)],
    quienes_somos: ['', Validators.maxLength(TOPES.quienes_somos)],
    zona: ['', Validators.maxLength(TOPES.zona)],
    google_place_id: ['', Validators.maxLength(TOPES.google_place_id)],
    color_acento: ['amarillo' as Acento],
    instalacion_activa: [false],
    instalacion_texto: ['', Validators.maxLength(TOPES.instalacion_texto)],
    vende_repuestos: [true],
    logo_url: [null as string | null],
    isotipo_url: [null as string | null],
    portada_url: [null as string | null],
    foto_equipo_url: [null as string | null],
    video_url: [null as string | null],
    video_poster_url: [null as string | null],
    horarios: this.fb.array([]),
    redes: this.fb.group({
      instagram: ['', Validators.pattern(PATRON_RED_SOCIAL)],
      facebook: ['', Validators.pattern(PATRON_RED_SOCIAL)],
      tiktok: ['', Validators.pattern(PATRON_RED_SOCIAL)],
      sitio: ['', Validators.pattern(PATRON_RED_SOCIAL)],
    }),
    marcas: [[] as string[]],
    servicios: this.fb.array([]),
    videos: this.fb.array([]),
    fotos_trabajos: this.fb.array([]),
    // CLI-14 y CLI-23: sólo «reparaciones». La garantía sale de Empresa y las opiniones, de Google.
    cifras: this.fb.group({ reparaciones: [null as number | null] }),
  });

  /**
   * CLI-14: la garantía que el sitio pisaba con su propio número, si el perfil
   * guardado todavía la trae y no coincide con la de Empresa. Se avisa: al
   * guardar, el sitio pasa a mostrar la de Empresa.
   */
  /** Los días que la agenda de Empresa toma turnos (`agenda_config.dias_habiles`). */
  readonly diasAgenda = signal<number[]>([]);
  /** CLI-21: días con agenda que el sitio publica como cerrados. */
  readonly diasSinHorario = computed(() => diasAgendaSinHorario(this.actual().horarios, this.diasAgenda()));

  readonly garantiaPisada = computed(() => {
    const g = this.inicial().cifras?.garantia_dias;
    return g !== undefined && g !== null && Number(g) !== this.garantiaDias() ? Number(g) : null;
  });

  private valor = toSignal(this.form.valueChanges, { initialValue: this.form.value });
  readonly actual = computed<PerfilPublico>(() => this.aPerfil(this.valor()));
  readonly cambios = computed(() => armarCambios(this.inicial(), this.actual()));
  readonly hayCambios = computed(() => Object.keys(this.cambios()).length > 0);
  readonly galeriaLlena = computed(() => this.actual().fotos_trabajos.length >= TOPES.fotos_trabajos);
  readonly serviciosLlenos = computed(() => this.actual().servicios.length >= TOPES.servicios);
  readonly videosLlenos = computed(() => this.actual().videos.length >= TOPES.videos);
  /** Un Place ID de sólo espacios no sirve: sin este chequeo el botón "Probar" quedaba habilitado y el clic no hacía nada. */
  readonly placeIdVacio = computed(() => !(this.actual().google_place_id ?? '').trim());

  get horarios() { return this.form.get('horarios') as FormArray; }
  get servicios() { return this.form.get('servicios') as FormArray; }
  get videos() { return this.form.get('videos') as FormArray; }
  get fotos() { return this.form.get('fotos_trabajos') as FormArray; }

  ngOnInit(): void {
    this.api.obtener().subscribe({
      next: (p) => { this.poner(p); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.notification.error('No se pudo leer el perfil del sitio'); },
    });
    this.empresaService.cargar().subscribe({
      next: (e) => {
        this.nombreTaller.set(e.name);
        this.garantiaDias.set(Number(e.garantia_dias) || 90);
        const dias = (e as any).agenda_config?.dias_habiles;
        this.diasAgenda.set(Array.isArray(dias) ? dias.map(Number) : []);
      },
      error: () => {},
    });
    // El resultado de "Probar" es del Place ID con el que se probó: si el
    // operario lo sigue editando (o se recarga el perfil), queda viejo al
    // lado de un ID distinto y engaña. Se limpia apenas el control cambia.
    this.form.get('google_place_id')!.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.pruebaGoogle.set(null));
  }

  /** Vuelca la respuesta del backend en el form y la fija como punto de comparación. */
  private poner(p: PerfilPublico): void {
    // El resultado de "Probar" quedó del perfil anterior (o de antes de
    // guardar): al recargar deja de tener sentido, aunque el `patchValue` de
    // abajo ponga el mismo valor y no dispare la suscripción de arriba.
    this.pruebaGoogle.set(null);
    // Se normaliza la hora ANTES de fijar `inicial`: si no, "9:00" del
    // backend contra el "09:00" que pinta el <input type="time"> se veía
    // como un cambio pendiente apenas se cargaba la pantalla.
    const perfil = {
      ...PERFIL_VACIO, ...p,
      // Un backend anterior no manda los campos de la instalación: apagada.
      instalacion_activa: p.instalacion_activa === true,
      instalacion_texto: p.instalacion_texto ?? null,
      // Sólo un `false` lo apaga: un backend anterior no manda el campo y el taller vende como siempre.
      vende_repuestos: p.vende_repuestos !== false,
      // El backend puede no mandar `horarios` (perfil recién creado): sin el
      // `?? []` acá, `.map` tiraba TypeError dentro del `next` del subscribe
      // y la pantalla quedaba clavada en "Cargando…".
      horarios: (p.horarios ?? []).map((h) => ({ ...h, desde: hhmm(h.desde), hasta: hhmm(h.hasta) })),
      // El backend no manda `url` (guarda el id): se reconstruye ACÁ, antes de
      // fijar `inicial`, o recargar la pantalla se vería como un cambio.
      videos: (p.videos ?? []).map((v) => ({
        ...v,
        titulo_personalizado: v.titulo_personalizado ?? null,
        url: (v.url ?? '').trim() || urlDeYoutube(v.id),
      })),
    };
    this.inicial.set(perfil);
    const conocidos = new Set(DIAS_HORARIO.map((d) => d.valor));
    this.diasExtra.set([...new Set(perfil.horarios.map((h) => h.dias).filter((d) => d && !conocidos.has(d)))]);
    this.horarios.clear(); perfil.horarios.forEach((h) => this.horarios.push(this.grupoHorario(h)));
    this.servicios.clear(); perfil.servicios.forEach((s) => this.servicios.push(this.grupoServicio(s)));
    this.videos.clear(); perfil.videos.forEach((v) => this.videos.push(this.grupoVideo(v)));
    this.fotos.clear(); perfil.fotos_trabajos.forEach((f) => this.fotos.push(this.fb.group({ url: [f.url], miniatura: [f.miniatura], pie: [f.pie ?? '', Validators.maxLength(TOPES.pie)] })));
    this.form.patchValue({
      eslogan: perfil.eslogan ?? '', quienes_somos: perfil.quienes_somos ?? '', zona: perfil.zona ?? '',
      google_place_id: perfil.google_place_id ?? '',
      instalacion_activa: perfil.instalacion_activa === true, instalacion_texto: perfil.instalacion_texto ?? '',
      vende_repuestos: perfil.vende_repuestos !== false,
      color_acento: perfil.color_acento, logo_url: perfil.logo_url, isotipo_url: perfil.isotipo_url, portada_url: perfil.portada_url,
      foto_equipo_url: perfil.foto_equipo_url, video_url: perfil.video_url, video_poster_url: perfil.video_poster_url,
      marcas: [...perfil.marcas],
      redes: { instagram: perfil.redes.instagram ?? '', facebook: perfil.redes.facebook ?? '', tiktok: perfil.redes.tiktok ?? '', sitio: perfil.redes.sitio ?? '' },
      cifras: { reparaciones: perfil.cifras.reparaciones ?? null },
    });
  }

  private aPerfil(v: any): PerfilPublico {
    return {
      ...PERFIL_VACIO, ...v,
      horarios: (v.horarios ?? []).map((h: any) => ({ dias: h.dias ?? '', desde: h.desde ?? '', hasta: h.hasta ?? '' })),
      servicios: (v.servicios ?? []).map((s: any) => ({ nombre: s.nombre ?? '', frase: s.frase ?? '', icono: s.icono ?? 'herramienta' })),
      videos: (v.videos ?? []).map((x: any) => ({
        id: x.id ?? '', titulo: x.titulo ?? null, canal: x.canal ?? null,
        titulo_personalizado: (x.titulo_personalizado ?? '').trim() || null,
        url: x.url ?? '',
      })),
      fotos_trabajos: (v.fotos_trabajos ?? []).map((f: any) => ({ url: f.url, miniatura: f.miniatura, ...(f.pie?.trim() ? { pie: f.pie.trim() } : {}) })),
      marcas: v.marcas ?? [],
      redes: v.redes ?? {},
      cifras: v.cifras ?? {},
    };
  }

  private grupoHorario(h = { dias: 'Lun a Vie', desde: '', hasta: '' }) {
    return this.fb.group({ dias: [h.dias, [Validators.required, Validators.maxLength(40)]], desde: [h.desde, Validators.required], hasta: [h.hasta, Validators.required] });
  }
  private grupoServicio(s: Servicio = { nombre: '', frase: '', icono: 'herramienta' }) {
    return this.fb.group({ nombre: [s.nombre, [Validators.required, Validators.maxLength(60)]], frase: [s.frase, Validators.maxLength(160)], icono: [s.icono] });
  }
  /** `titulo` y `canal` son de sólo lectura: los resuelve el backend con `oembed`. */
  private grupoVideo(v: VideoPerfil = { id: '', titulo: null, canal: null, titulo_personalizado: null, url: '' }) {
    return this.fb.group({
      id: [v.id],
      titulo: [v.titulo],
      canal: [v.canal],
      url: [v.url, [Validators.required, Validators.maxLength(TOPES.url_video)]],
      titulo_personalizado: [v.titulo_personalizado ?? '', Validators.maxLength(TOPES.titulo_video)],
    });
  }

  // ─── Bloques ─────────────────────────────────────────────────────────────
  /** El `<details>` ya sabe abrirse/cerrarse solo; esto sólo sincroniza cuál queda "abierto" para el próximo render. */
  onToggle(bloque: string, ev: Event): void {
    if ((ev.target as HTMLDetailsElement).open) this.abierto.set(bloque);
  }

  // ─── Identidad ───────────────────────────────────────────────────────────
  elegirAcento(a: Acento): void { this.form.patchValue({ color_acento: a }); }

  // ─── Horarios ────────────────────────────────────────────────────────────
  agregarHorario(): void { if (this.horarios.length < TOPES.horarios) this.horarios.push(this.grupoHorario()); }
  quitarHorario(i: number): void { this.horarios.removeAt(i); }

  // ─── Servicios ───────────────────────────────────────────────────────────
  agregarServicio(): void { if (!this.serviciosLlenos()) this.servicios.push(this.grupoServicio()); }
  quitarServicio(i: number): void { this.servicios.removeAt(i); }
  moverServicio(i: number, d: -1 | 1): void {
    const j = i + d;
    if (j < 0 || j >= this.servicios.length) return;
    const ctrl = this.servicios.at(i);
    this.servicios.removeAt(i);
    this.servicios.insert(j, ctrl);
  }

  // ─── Videos ──────────────────────────────────────────────────────────────
  agregarVideo(): void { if (!this.videosLlenos()) this.videos.push(this.grupoVideo()); }
  quitarVideo(i: number): void { this.videos.removeAt(i); }
  moverVideo(i: number, d: -1 | 1): void {
    const j = i + d;
    if (j < 0 || j >= this.videos.length) return;
    const ctrl = this.videos.at(i);
    this.videos.removeAt(i);
    this.videos.insert(j, ctrl);
  }

  // ─── Opiniones de Google ─────────────────────────────────────────────────
  /**
   * Consulta en el acto sin guardar: sirve para saber si el Place ID que se
   * acaba de pegar es el del negocio antes de dejarlo puesto.
   */
  probarGoogle(): void {
    const placeId = (this.form.value.google_place_id ?? '').trim();
    if (!placeId || this.probandoGoogle()) return;
    this.probandoGoogle.set(true);
    this.pruebaGoogle.set(null);
    // Se guarda el ID pedido: si se lo sigue editando mientras la respuesta
    // está en vuelo, el `valueChanges` de `ngOnInit` ya limpió el resultado
    // y esta respuesta (del ID viejo) no puede volver a pisarlo.
    const pedido = placeId;
    this.api.probarGoogle(placeId).subscribe({
      next: (r) => {
        this.probandoGoogle.set(false);
        if ((this.form.value.google_place_id ?? '').trim() !== pedido) return;
        this.pruebaGoogle.set({ ok: true, texto: textoPruebaGoogle(r) });
      },
      error: (e) => {
        this.probandoGoogle.set(false);
        if ((this.form.value.google_place_id ?? '').trim() !== pedido) return;
        this.pruebaGoogle.set({ ok: false, texto: e?.error?.message ?? 'No se pudo consultar Google' });
      },
    });
  }

  // ─── Marcas ──────────────────────────────────────────────────────────────
  agregarMarca(texto = this.marcaNueva): void {
    const marca = texto.trim().slice(0, 40);
    const marcas: string[] = this.form.value.marcas ?? [];
    if (!marca || marcas.length >= TOPES.marcas || marcas.some((m) => m.toLowerCase() === marca.toLowerCase())) return;
    this.form.patchValue({ marcas: [...marcas, marca] });
    this.marcaNueva = '';
  }
  quitarMarca(i: number): void {
    const marcas: string[] = this.form.value.marcas ?? [];
    this.form.patchValue({ marcas: marcas.filter((_, k) => k !== i) });
  }

  // ─── Imágenes ────────────────────────────────────────────────────────────
  onArchivo(campo: CampoImagen, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (archivo) this.subir(campo, archivo);
  }

  /** Sube al elegir; la respuesta reemplaza el perfil entero (incluye la URL nueva) sin tocar lo que el usuario está editando. */
  subir(campo: CampoImagen, archivo: File): void {
    this.subiendo.update((s) => ({ ...s, [campo]: true }));
    this.api.subirImagen(campo, archivo).subscribe({
      next: (p) => {
        this.subiendo.update((s) => ({ ...s, [campo]: false }));
        this.mezclarImagenes(p);
        this.notification.success('Imagen subida');
      },
      error: (e) => {
        this.subiendo.update((s) => ({ ...s, [campo]: false }));
        this.notification.error(e?.error?.message ?? 'No se pudo subir la imagen');
      },
    });
  }

  /** No se toca el form hasta el `next` (mismo patrón que `subir()`/`borrarTrabajo()`): si el PATCH falla, la imagen no desaparece de la pantalla aunque siga guardada en el servidor. */
  quitarImagen(campo: 'logo_url' | 'isotipo_url' | 'portada_url' | 'foto_equipo_url'): void {
    // La URL no viaja por el PATCH: se manda aparte, explícita.
    this.api.guardar({ [campo]: null }).subscribe({
      next: (p) => this.mezclarImagenes(p),
      error: () => this.notification.error('No se pudo quitar la imagen'),
    });
  }

  borrarTrabajo(i: number): void {
    this.api.borrarTrabajo(i).subscribe({
      next: (p) => this.mezclarImagenes(p),
      error: () => this.notification.error('No se pudo quitar la foto'),
    });
  }

  // ─── Video de portada ────────────────────────────────────────────────────
  readonly VIDEO_TIPOS = 'video/mp4,video/webm';

  onVideoPortada(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (archivo) this.subirVideoPortada(archivo);
  }

  /**
   * El tope de 25 MB se mira acá además de en el backend: subir 200 MB por una
   * conexión de taller para que el servidor lo rechace al final es media hora
   * tirada.
   */
  subirVideoPortada(archivo: File): void {
    if (archivo.size > TOPES.video_mb * 1024 * 1024) {
      this.notification.error(`El video no puede pasar de ${TOPES.video_mb} MB.`);
      return;
    }
    this.subiendoVideo.set(true);
    this.api.subirVideo(archivo).subscribe({
      next: (p) => { this.subiendoVideo.set(false); this.mezclarImagenes(p); this.notification.success('Video subido'); },
      error: (e) => { this.subiendoVideo.set(false); this.notification.error(e?.error?.message ?? 'No se pudo subir el video'); },
    });
  }

  /** Igual que `quitarImagen`: el form no se toca hasta que el backend confirma. */
  quitarVideoPortada(): void {
    this.api.quitarVideo().subscribe({
      next: (p) => this.mezclarImagenes(p),
      error: () => this.notification.error('No se pudo quitar el video'),
    });
  }

  /** Sólo las URLs y la galería vienen del backend; los textos que el usuario está tocando se conservan. */
  private mezclarImagenes(p: PerfilPublico): void {
    this.inicial.update((ini) => ({
      ...ini, logo_url: p.logo_url, isotipo_url: p.isotipo_url, portada_url: p.portada_url, foto_equipo_url: p.foto_equipo_url,
      video_url: p.video_url, video_poster_url: p.video_poster_url, fotos_trabajos: p.fotos_trabajos,
    }));
    this.form.patchValue({
      logo_url: p.logo_url, isotipo_url: p.isotipo_url, portada_url: p.portada_url, foto_equipo_url: p.foto_equipo_url,
      video_url: p.video_url, video_poster_url: p.video_poster_url,
    });
    const pies = new Map(this.fotos.controls.map((c) => [c.value.url, c.value.pie]));
    this.fotos.clear();
    p.fotos_trabajos.forEach((f) => this.fotos.push(this.fb.group({ url: [f.url], miniatura: [f.miniatura], pie: [pies.get(f.url) ?? f.pie ?? '', Validators.maxLength(TOPES.pie)] })));
  }

  urlImagen(ruta: string | null): string | null {
    if (!ruta) return null;
    return /^https?:\/\//i.test(ruta) ? ruta : `${environment.apiUrl.replace(/\/api$/, '')}${ruta}`;
  }

  // ─── Errores de campo ────────────────────────────────────────────────────
  /**
   * Mensaje a mostrar bajo un campo: primero el que mandó el backend (lo pone
   * `asignarErroresBackend` en los errores del control), si no el de
   * validación local una vez tocado. `null` si no hay nada que mostrar.
   */
  mensajeError(control: AbstractControl | null, mensajeLocal: string): string | null {
    const backend = control?.errors?.['backend'];
    if (typeof backend === 'string') return backend;
    return control && control.touched && control.invalid ? mensajeLocal : null;
  }
  mensajeMax(tope: number): string { return `Superó el máximo de ${tope} caracteres.`; }
  readonly mensajeRedSocial = AYUDA_RED_SOCIAL;

  // ─── Guardar ─────────────────────────────────────────────────────────────
  guardar(): void {
    // Primero se sacan los errores del intento anterior: son de datos que
    // quizá ya se corrigieron, y dejarlos haría que el form quede inválido
    // para siempre.
    limpiarErroresBackend(this.form);
    if (this.form.invalid) { this.form.markAllAsTouched(); this.notification.error('Revisá los campos marcados'); return; }
    const cambios = this.cambios();
    if (!Object.keys(cambios).length) return;
    this.guardando.set(true);
    this.api.guardar(cambios).subscribe({
      next: (p) => { this.guardando.set(false); this.poner(p); this.notification.success('Sitio web guardado'); },
      error: (e) => {
        this.guardando.set(false);
        const { asignados, sueltos } = asignarErroresBackend(this.form, e?.error);
        if (sueltos.length) this.notification.error(sueltos.join(' · '));
        else if (!asignados.length) this.notification.error('No se pudo guardar');
      },
    });
  }
}
