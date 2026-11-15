import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EmpresaService } from '../../../../core/services/empresa.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { WalletsService } from '../../configuracion/services/wallets.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
/** «08–10»: un bloque horario, de hora a hora. */
const rotuloBloque = (desde: string, hasta: string) => `${desde.slice(0, 2)}–${hasta.slice(0, 2)}`;

/** Los turnos a domicilio de fábrica: 08 a 18, de 2 h, 3 visitas por turno (13/10/2026). */
const DOMICILIO_DEFAULT = { desde: '08:00', hasta: '18:00', duracion_min: 120, cupo_por_bloque: 3 };

const aMinutos = (hhmm: string): number => {
  const [h, m] = (hhmm ?? '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const aHora = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Tope de los montos de la empresa: el `@Max` del DTO del backend. */
export const MONTO_MAXIMO = 10_000_000;

/** Los 14 datos legales y de los documentos (contrato opción B §1). */
export const DATOS_LEGALES = [
  'razon_social', 'condicion_iva', 'iibb', 'inicio_actividades', 'email_contacto', 'horario_atencion',
  'costo_revision', 'revision_se_descuenta', 'plazo_presupuesto_dias', 'plazo_reparacion_dias',
  'canon_guarda_diario', 'revision_garantia_dias', 'factura_momento', 'traslado_garantia',
] as const;

/**
 * Datos del taller. Son el membrete de la documentación física (orden de
 * servicio, remito de entrega, OC): lo que no esté cargado acá sale en blanco
 * en el papel.
 */
@Component({
  selector: 'app-empresa',
  standalone: false,
  templateUrl: './empresa.component.html',
  styleUrls: ['./empresa.component.scss'],
})
export class EmpresaComponent implements OnInit {
  private fb = inject(FormBuilder);
  private empresaService = inject(EmpresaService);
  private notification = inject(NotificationService);
  private walletsService = inject(WalletsService);
  private http = inject(HttpClient);

  cargando = signal(true);
  /**
   * #5: la lectura de la empresa contestó. Sin esto el form queda con los
   * valores por defecto, y guardarlo pisaba la billetera de MP y el token con
   * null: no se muestra ni se guarda.
   */
  cargado = signal(false);
  guardando = signal(false);
  /** Sólo las elegibles: activas y no borradas. */
  wallets = signal<any[]>([]);
  walletsCargadas = signal(false);
  /**
   * CLI-02: el token de MP no se muestra ni se precarga: el campo arranca
   * vacío y sólo viaja si se escribe uno nuevo. Esto dice si hay uno cargado.
   */
  mpConfigurado = signal(false);
  mpConexion = signal<'oauth' | 'manual' | 'demo' | 'vencida' | null>(null);
  mpUsuario = signal<string | null>(null);
  mpCuenta = signal<string | null>(null);
  mpVence = signal<string | null>(null);
  mpDemoPermitida = signal(false);
  /** La cuenta que volvió de Mercado Pago, esperando que el admin confirme que es la del taller. */
  mpPorConfirmar = signal<{ pendiente: string; cuenta: string } | null>(null);
  mpOcupado = signal(false);

  /**
   * #41: la billetera guardada en ese campo ya no está entre las elegibles
   * (desactivada o borrada). Se muestra como tal en vez de dejar el selector
   * en blanco o que parezca "sin configurar".
   */
  billeteraFuera(campo: 'mp_wallet_id' | 'transferencia_wallet_id'): string | null {
    const id = this.form.get(campo)?.value;
    if (!id || this.wallets().some((w) => w.id === id)) return null;
    return id;
  }

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    direccion: ['', [Validators.maxLength(250)]],
    telefono: ['', [Validators.maxLength(40)]],
    cuit: ['', [Validators.maxLength(20)]],
    sena_porcentaje: [50, [Validators.min(0), Validators.max(100)]],
    mp_wallet_id: [''],
    // D2: dónde entran las transferencias que el chofer cobra en la puerta.
    transferencia_wallet_id: [''],
    garantia_dias: [90, [Validators.min(0), Validators.max(3650)]],
    dias_abandono: [30, [Validators.min(1), Validators.max(365)]],
    costo_visita_domicilio: [0, [Validators.min(0)]],
    tope_ordenes_tecnico: [8, [Validators.min(1), Validators.max(100)]],
    // Respaldo de compra (C3): con esto en true un repuesto no se puede dar
    // por ingresado sin una OC paga que lo respalde. La regla existía; el
    // toggle no (auditoría del 13/09/2026).
    exigir_oc_paga_repuestos: [true],
    // Identificación y catálogo (spec C5 §2.10). Los rangos son los del
    // `ActualizarEmpresaDto`: enteros, 0-500 y 0-100.
    margen_repuestos_porcentaje: [40, [Validators.min(0), Validators.max(500)]],
    alerta_suba_costo_porcentaje: [15, [Validators.min(0), Validators.max(100)]],

    // Datos legales y de los documentos (opción B, 13/10/2026). Topes y
    // rangos: los del `ActualizarEmpresaDto` del contrato. Los defaults son
    // los de la migración: con eso el papel sale igual que si no se tocara.
    razon_social: ['', [Validators.maxLength(120)]],
    condicion_iva: [''],
    iibb: ['', [Validators.maxLength(30)]],
    inicio_actividades: ['', [Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    email_contacto: ['', [Validators.email, Validators.maxLength(120)]],
    horario_atencion: ['', [Validators.maxLength(120)]],
    costo_revision: [0, [Validators.min(0), Validators.max(MONTO_MAXIMO)]],
    revision_se_descuenta: [true],
    plazo_presupuesto_dias: [2, [Validators.required, Validators.min(1), Validators.max(15)]],
    plazo_reparacion_dias: [10, [Validators.required, Validators.min(1), Validators.max(30)]],
    canon_guarda_diario: [0, [Validators.min(0), Validators.max(MONTO_MAXIMO)]],
    revision_garantia_dias: [5, [Validators.required, Validators.min(1), Validators.max(30)]],
    factura_momento: ['al_cobrar'],
    traslado_garantia: ['', [Validators.maxLength(600)]],
  });

  /**
   * Los 14 datos legales los guarda la migración 1789800000019 del backend.
   * El backend rechaza los campos que no conoce (`forbidNonWhitelisted`):
   * si la empresa que llegó no trae ninguno, el servidor todavía no los
   * guarda, la sección se ve deshabilitada y el PATCH no los manda, para que
   * el resto del formulario se pueda seguir guardando.
   */
  datosLegalesDisponibles = signal(false);

  readonly MONTO_MAXIMO = MONTO_MAXIMO;

  readonly CONDICIONES_IVA = [
    { valor: 'responsable_inscripto', etiqueta: 'Responsable Inscripto' },
    { valor: 'monotributo', etiqueta: 'Monotributo' },
    { valor: 'exento', etiqueta: 'Exento' },
  ];

  readonly MOMENTOS_FACTURA = [
    { valor: 'al_cobrar', etiqueta: 'Al cobrar el servicio' },
    { valor: 'al_senar', etiqueta: 'Al cobrar la seña y al cobrar el saldo' },
  ];

  // ─── Agenda (T6) ──────────────────────────────────────────────────────────
  /** getDay() de JavaScript: 0 domingo … 6 sábado. */
  readonly diasSemana = [
    { valor: 0, etiqueta: 'Dom' }, { valor: 1, etiqueta: 'Lun' }, { valor: 2, etiqueta: 'Mar' },
    { valor: 3, etiqueta: 'Mié' }, { valor: 4, etiqueta: 'Jue' }, { valor: 5, etiqueta: 'Vie' },
    { valor: 6, etiqueta: 'Sáb' },
  ];

  /** Se edita fuera del form group: es un objeto anidado, no campos planos. */
  agenda = signal<any>({
    dias_habiles: [1, 2, 3, 4, 5, 6],
    local: { desde: '09:00', hasta: '18:00', duracion_min: 30, cupo_por_hora: 2 },
    domicilio: { ...DOMICILIO_DEFAULT },
  });

  /**
   * Cuánto dura cada turno a domicilio. Tres horas es el tope: la Ley 2.962
   * de CABA pide que la franja que se le da al cliente no pase de 3 h.
   */
  readonly duracionesDomicilio = [
    { valor: 60, etiqueta: '1 h' },
    { valor: 90, etiqueta: '1 h 30' },
    { valor: 120, etiqueta: '2 h' },
    { valor: 180, etiqueta: '3 h' },
  ];

  /** Los turnos que quedan con la configuración en pantalla: «08–10 · 10–12 · …». */
  readonly bloquesDomicilio = computed(() => {
    const d = this.agenda().domicilio ?? DOMICILIO_DEFAULT;
    const dur = Number(d.duracion_min) || 0;
    const lista: string[] = [];
    if (dur <= 0) return lista;
    for (let m = aMinutos(d.desde); m + dur <= aMinutos(d.hasta); m += dur) {
      lista.push(rotuloBloque(aHora(m), aHora(m + dur)));
    }
    return lista;
  });

  // ─── Plazos objetivo y rubros (T7) ────────────────────────────────────────
  /** Mismo criterio que la agenda: objeto anidado, editado fuera del form. */
  sla = signal<any>({ diagnostico_horas: 24, cotizacion_horas: 48, reparacion_horas: 72 });

  editarSla(campo: string, valor: any): void {
    this.sla.update((s: any) => ({ ...s, [campo]: Number(valor) }));
  }

  esDiaHabil(valor: number): boolean {
    return (this.agenda().dias_habiles ?? []).includes(valor);
  }

  toggleDia(valor: number): void {
    this.agenda.update((a: any) => {
      const dias: number[] = a.dias_habiles ?? [];
      return {
        ...a,
        dias_habiles: dias.includes(valor)
          ? dias.filter((d) => d !== valor)
          : [...dias, valor].sort(),
      };
    });
  }

  editarDomicilio(campo: string, valor: any): void {
    const numerico = campo === 'duracion_min' || campo === 'cupo_por_bloque';
    this.agenda.update((a: any) => ({
      ...a,
      domicilio: { ...(a.domicilio ?? DOMICILIO_DEFAULT), [campo]: numerico ? Number(valor) : valor },
    }));
  }

  /**
   * Lo que llega del backend, sin las franjas viejas (mañana/tarde): un
   * backend al día ya manda `domicilio` derivado; si no viniera, valen los
   * turnos de fábrica.
   */
  private agendaDesde(cfg: any): any {
    const { franjas: _viejas, ...resto } = cfg ?? {};
    return { ...resto, domicilio: resto.domicilio ?? { ...DOMICILIO_DEFAULT } };
  }

  editarLocal(campo: string, valor: any): void {
    const numerico = campo === 'duracion_min' || campo === 'cupo_por_hora';
    this.agenda.update((a: any) => ({
      ...a,
      local: { ...a.local, [campo]: numerico ? Number(valor) : valor },
    }));
  }

  /**
   * El costo del ejemplo de la ayuda. Es el mismo número que usa la spec
   * ("un repuesto que costó $12.000") y sirve para que el que mueve el margen
   * vea el efecto sin abrir el pañol.
   */
  readonly COSTO_DE_EJEMPLO = 12000;

  /** Lo que se cotizaría ese costo con el margen que está cargado en el form. */
  ejemploMargen(): number {
    const margen = Number(this.form.get('margen_repuestos_porcentaje')?.value ?? 0);
    return Math.round(this.COSTO_DE_EJEMPLO * (1 + margen / 100));
  }

  ngOnInit(): void {
    this.walletsService.getWallets().subscribe({
      next: (ws: any[]) => {
        this.wallets.set((ws ?? []).filter((w) => w.is_active && !w.is_deleted));
        this.walletsCargadas.set(true);
      },
      error: () => {},
    });
    this.cargarEmpresa();
    this.procesarRetornoMp(window.location.search);
  }

  /** Lee la empresa y siembra el form. También es el «Reintentar». */
  cargarEmpresa(): void {
    this.cargando.set(true);
    this.empresaService.cargar().subscribe({
      next: (e) => {
        this.form.patchValue({
          name: e.name,
          direccion: e.direccion ?? '',
          telefono: e.telefono ?? '',
          cuit: e.cuit ?? '',
          sena_porcentaje: e.sena_porcentaje ?? 50,
          mp_wallet_id: e.mp_wallet_id ?? '',
          transferencia_wallet_id: e.transferencia_wallet_id ?? '',
          garantia_dias: e.garantia_dias ?? 90,
          dias_abandono: e.dias_abandono ?? 30,
          costo_visita_domicilio: (e as any).costo_visita_domicilio ?? 0,
          tope_ordenes_tecnico: (e as any).tope_ordenes_tecnico ?? 8,
          exigir_oc_paga_repuestos: (e as any).exigir_oc_paga_repuestos ?? true,
          margen_repuestos_porcentaje: e.margen_repuestos_porcentaje ?? 40,
          alerta_suba_costo_porcentaje: e.alerta_suba_costo_porcentaje ?? 15,
          razon_social: e.razon_social ?? '',
          condicion_iva: e.condicion_iva ?? '',
          iibb: e.iibb ?? '',
          // Una columna `date` puede llegar con hora: el input sólo quiere el día.
          inicio_actividades: e.inicio_actividades ? String(e.inicio_actividades).slice(0, 10) : '',
          email_contacto: e.email_contacto ?? '',
          horario_atencion: e.horario_atencion ?? '',
          costo_revision: e.costo_revision ?? 0,
          revision_se_descuenta: e.revision_se_descuenta ?? true,
          plazo_presupuesto_dias: e.plazo_presupuesto_dias ?? 2,
          plazo_reparacion_dias: e.plazo_reparacion_dias ?? 10,
          canon_guarda_diario: e.canon_guarda_diario ?? 0,
          revision_garantia_dias: e.revision_garantia_dias ?? 5,
          factura_momento: e.factura_momento ?? 'al_cobrar',
          traslado_garantia: e.traslado_garantia ?? '',
        });
        this.datosLegalesDisponibles.set(DATOS_LEGALES.some((k) => k in (e ?? {})));
        this.alternarDatosLegales();
        // Si el taller nunca configuró la agenda, el backend devuelve los
        // valores por defecto: el formulario nunca arranca vacío.
        this.mpConfigurado.set(!!e.mp_configurado);
        this.mpConexion.set(e.mp_conexion ?? null);
        this.mpUsuario.set(e.mp_user_id ?? null);
        this.mpCuenta.set(e.mp_cuenta ?? null);
        this.mpVence.set(e.mp_token_vence ?? null);
        this.mpDemoPermitida.set(!!e.mp_demo_permitida);
        if ((e as any).agenda_config) this.agenda.set(this.agendaDesde((e as any).agenda_config));
        if ((e as any).sla_config) this.sla.set((e as any).sla_config);
        this.cargado.set(true);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
      },
    });
  }

  /** La lista del inicio se puede ocultar: desde acá se vuelve a abrir (spec 2026-10-28 §6). */
  verPrimerosPasos(): void {
    this.http.patch(`${environment.apiUrl}/companies/primeros-pasos`, { cerrado: false }).subscribe();
  }

  /** Spec 2026-10-28 §13.1: cada taller conecta su cuenta de Mercado Pago con un clic. */
  textoConexionMp(): string {
    switch (this.mpConexion()) {
      case 'oauth': return `Conectada a Mercado Pago (${this.mpCuenta() ?? `cuenta ${this.mpUsuario()}`})`;
      case 'vencida': return 'La conexión con Mercado Pago venció: volvé a conectarla. Mientras tanto, tus clientes no pueden pagar online';
      case 'manual': return 'Token cargado a mano: conectala con el botón para que se renueve sola';
      case 'demo': return 'Modo demo: los cobros se simulan';
      default: return 'Sin conectar: tus clientes no pueden pagar online';
    }
  }

  /** La renovación es sola y empieza 30 días antes: si faltan menos de 15, viene fallando. */
  avisoVencimientoMp(): string | null {
    const vence = this.mpVence();
    if (this.mpConexion() !== 'oauth' || !vence) return null;
    if (new Date(vence).getTime() - Date.now() > 15 * 86400000) return null;
    return `La conexión no se pudo renovar y vence el ${new Date(vence).toLocaleDateString('es-AR')}: volvé a conectarla.`;
  }

  /** Aparte para poder testear sin irse de la página. */
  irA(url: string): void {
    window.location.href = url;
  }

  conectarMp(): void {
    this.mpOcupado.set(true);
    this.empresaService.iniciarConexionMp().subscribe({
      next: ({ url }) => this.irA(url),
      error: () => this.mpOcupado.set(false),
    });
  }

  /** Mercado Pago vuelve acá con `?mp=<pendiente>&cuenta=<nombre>` o `?mp_error=<código>`. */
  procesarRetornoMp(busqueda: string): void {
    const q = new URLSearchParams(busqueda);
    const pendiente = q.get('mp');
    const error = q.get('mp_error');
    if (!pendiente && !error) return;
    window.history.replaceState({}, '', window.location.pathname);
    if (error) {
      this.notification.error(error === 'MP_OAUTH_INVALIDO'
        ? 'Esa conexión con Mercado Pago no es válida o venció. Probá de nuevo.'
        : 'Mercado Pago no respondió. Probá de nuevo en un rato.');
      return;
    }
    this.mpPorConfirmar.set({ pendiente: pendiente as string, cuenta: q.get('cuenta') ?? '' });
  }

  /** SEG-13, igual que Mercado Libre: se activa recién cuando el admin vio qué cuenta volvió. */
  confirmarCuentaMp(): void {
    const p = this.mpPorConfirmar();
    if (!p) return;
    this.empresaService.confirmarConexionMp(p.pendiente).subscribe({
      next: () => {
        this.mpPorConfirmar.set(null);
        this.notification.success('Mercado Pago conectado');
        this.cargarEmpresa();
      },
      error: () => this.mpPorConfirmar.set(null),
    });
  }

  descartarCuentaMp(): void {
    this.mpPorConfirmar.set(null);
  }

  desconectarMp(): void {
    if (!window.confirm('¿Desconectar Mercado Pago? Tus clientes van a aprobar los presupuestos sin pagar la seña.')) return;
    this.empresaService.desconectarMp().subscribe({ next: () => this.cargarEmpresa() });
  }

  usarDemoMp(): void {
    const conCuenta = this.mpConexion() === 'oauth' || this.mpConexion() === 'manual';
    if (conCuenta && !window.confirm('¿Pasar a modo demo? Se quita la conexión con tu cuenta real y los cobros se simulan.')) return;
    this.empresaService.actualizar({ mp_access_token: 'SIMULADO' } as any).subscribe({ next: () => this.cargarEmpresa() });
  }

  /**
   * Sin soporte del backend los controles quedan deshabilitados: no validan
   * (el form puede guardarse) y no viajan.
   */
  private alternarDatosLegales(): void {
    for (const k of DATOS_LEGALES) {
      const ctrl = this.form.get(k);
      if (this.datosLegalesDisponibles()) ctrl?.enable({ emitEvent: false });
      else ctrl?.disable({ emitEvent: false });
    }
  }

  /**
   * Los 14 datos como los espera el DTO: texto vacío = null (en el papel,
   * «si está vacío»), números como número. Nada si el backend no los conoce.
   */
  private datosLegalesDelForm(): Record<string, unknown> {
    if (!this.datosLegalesDisponibles()) return {};
    const v = this.form.getRawValue();
    const textoONull = (x: unknown) => String(x ?? '').trim() || null;
    return {
      razon_social: textoONull(v.razon_social),
      condicion_iva: v.condicion_iva || null,
      iibb: textoONull(v.iibb),
      inicio_actividades: v.inicio_actividades || null,
      email_contacto: textoONull(v.email_contacto),
      horario_atencion: textoONull(v.horario_atencion),
      costo_revision: Number(v.costo_revision) || 0,
      revision_se_descuenta: !!v.revision_se_descuenta,
      plazo_presupuesto_dias: Number(v.plazo_presupuesto_dias) || 2,
      plazo_reparacion_dias: Number(v.plazo_reparacion_dias) || 10,
      canon_guarda_diario: Number(v.canon_guarda_diario) || 0,
      revision_garantia_dias: Number(v.revision_garantia_dias) || 5,
      factura_momento: v.factura_momento || 'al_cobrar',
      traslado_garantia: textoONull(v.traslado_garantia),
    };
  }

  guardar(): void {
    if (!this.cargado() || this.form.invalid) return;
    this.guardando.set(true);
    const v = this.form.value;
    this.empresaService.actualizar({
      name: v.name.trim(),
      direccion: v.direccion?.trim() || null,
      telefono: v.telefono?.trim() || null,
      cuit: v.cuit?.trim() || null,
      // CLI-02: sin escribir nada, el token guardado no se toca.
      sena_porcentaje: Number(v.sena_porcentaje) || 0,
      mp_wallet_id: v.mp_wallet_id || null,
      // Vacío = null: el backend la borra (el chofer deja de cobrar por transferencia).
      transferencia_wallet_id: v.transferencia_wallet_id || null,
      garantia_dias: Number(v.garantia_dias) ?? 90,
      dias_abandono: Number(v.dias_abandono) || 30,
      costo_visita_domicilio: Number(v.costo_visita_domicilio) || 0,
      exigir_oc_paga_repuestos: !!v.exigir_oc_paga_repuestos,
      agenda_config: this.agenda(),
      sla_config: this.sla(),
      tope_ordenes_tecnico: Number(v.tope_ordenes_tecnico) || 8,
      margen_repuestos_porcentaje: Number(v.margen_repuestos_porcentaje) || 0,
      alerta_suba_costo_porcentaje: Number(v.alerta_suba_costo_porcentaje) || 0,
      ...this.datosLegalesDelForm(),
    } as any).subscribe({
      next: (e) => {
        this.guardando.set(false);
        this.mpConfigurado.set(!!e?.mp_configurado);
        this.notification.success('Datos de la agencia guardados');
      },
      error: () => {
        this.guardando.set(false);
      },
    });
  }
}
