import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AutosService, Unidad } from './autos.service';
import { CAJAS, CARROCERIAS, COMBUSTIBLES, MARCAS_SUGERIDAS, estimarAnioPorPatente, modelosDeMarca, monto } from './autos.util';
import { NotificationService } from '../../../core/services/notification.service';

interface FotoElegida { archivo: File; vista: string }

const MAXIMO_FOTOS = 12;

/**
 * Cargar un auto (14/11/2026): pantalla propia, en tres bloques —el auto, la
 * plata y las fotos—. Antes era un formulario que se abría dentro del listado,
 * debajo de todo, y no se encontraba.
 */
@Component({
  selector: 'app-unidad-alta',
  standalone: false,
  templateUrl: './unidad-alta.component.html',
  styleUrls: ['./unidad-alta.component.scss'],
})
export class UnidadAltaComponent implements OnInit, OnDestroy {
  private api = inject(AutosService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private notification = inject(NotificationService);

  readonly combustibles = COMBUSTIBLES;
  readonly cajas = CAJAS;
  readonly carrocerias = CARROCERIAS;
  readonly marcasSugeridas = MARCAS_SUGERIDAS;
  readonly maximoFotos = MAXIMO_FOTOS;

  get modelosSugeridos(): string[] {
    return modelosDeMarca(this.n.marca);
  }

  alCambiarDominio(valor: string): void {
    this.n.dominio = valor;
    if (!this.n.anio.trim()) {
      const estimado = estimarAnioPorPatente(valor);
      if (estimado) this.n.anio = String(estimado);
    }
  }

  n = {
    origen: 'compra' as 'compra' | 'consignacion', condicion: 'usado' as 'usado' | '0km', moneda: 'USD' as 'USD' | 'ARS',
    dominio: '', marca: '', modelo: '', version: '', anio: '', km: '', color: '', combustible: '', transmision: '', carroceria: '',
    costo: '', piso: '', precio: '', titular_nombre: '', titular_telefono: '', descripcion: '', publicar: true,
  };
  fotos = signal<FotoElegida[]>([]);
  guardando = signal(false);
  /** Qué se está haciendo mientras guarda: «Cargando el auto…», «Subiendo foto 2 de 5…». */
  paso = signal('');

  ngOnInit(): void {
    // Desde un interesado se llega con ?tomar=<datos de su auto>: el alta se abre ya completa.
    const crudo = this.route.snapshot.queryParamMap.get('tomar');
    if (!crudo) return;
    try {
      const d = JSON.parse(crudo) as Record<string, string | number | null>;
      const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v));
      this.n = {
        ...this.n,
        dominio: texto(d['dominio']),
        marca: texto(d['marca']),
        modelo: texto(d['modelo']),
        version: texto(d['version']),
        anio: texto(d['anio']),
        km: texto(d['km']),
        combustible: texto(d['combustible']),
        transmision: texto(d['transmision']),
        carroceria: texto(d['carroceria']),
        descripcion: texto(d['descripcion']),
        titular_nombre: texto(d['titular_nombre']),
        titular_telefono: texto(d['titular_telefono']),
        costo: texto(d['costo']),
        moneda: d['moneda'] === 'ARS' ? 'ARS' : 'USD',
      };
    } catch { /* un enlace roto no completa nada */ }
  }

  ngOnDestroy(): void {
    this.fotos().forEach((f) => URL.revokeObjectURL(f.vista));
  }

  elegirFotos(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const elegidas = Array.from(campo.files ?? []).filter((a) => a.type.startsWith('image/'));
    campo.value = '';
    const lugar = MAXIMO_FOTOS - this.fotos().length;
    if (elegidas.length > lugar) this.notification.info(`Entran hasta ${MAXIMO_FOTOS} fotos: quedaron las primeras.`);
    this.fotos.update((l) => [...l, ...elegidas.slice(0, lugar).map((archivo) => ({ archivo, vista: URL.createObjectURL(archivo) }))]);
  }

  quitarFoto(f: FotoElegida): void {
    URL.revokeObjectURL(f.vista);
    this.fotos.update((l) => l.filter((x) => x !== f));
  }

  /** Lo que falta para poder guardar, dicho como se lo diría al vendedor. */
  private problema(): string | null {
    const n = this.n;
    const anio = Number(n.anio);
    if (n.marca.trim().length < 2 || n.modelo.trim().length < 1) return 'Poné la marca y el modelo.';
    if (!Number.isInteger(anio) || anio < 1900 || anio > 2100) return 'El año no es válido.';
    if (n.condicion === 'usado' && !n.dominio.trim()) return 'Un usado se carga con su dominio (patente).';
    if ([n.costo, n.piso, n.precio].some((t) => t.trim() && monto(t) === null)) return 'Revisá los montos: hay uno que no es un número.';
    if (n.origen === 'consignacion' && !n.titular_nombre.trim()) return 'Decí quién es el dueño que la deja en consignación.';
    if (n.publicar && !n.precio.trim()) return 'Para publicarlo en el sitio hace falta el precio de venta.';
    return null;
  }

  async guardar(): Promise<void> {
    const problema = this.problema();
    if (problema) { this.notification.error(problema); return; }
    const n = this.n;
    const esConsignacion = n.origen === 'consignacion';
    this.guardando.set(true);
    this.paso.set('Cargando el auto…');
    let unidad: Unidad;
    try {
      unidad = await firstValueFrom(this.api.crear({
        origen: n.origen, condicion: n.condicion, moneda: n.moneda,
        dominio: n.dominio.trim() || undefined,
        marca: n.marca.trim(), modelo: n.modelo.trim(), version: n.version.trim() || undefined,
        anio: Number(n.anio), km: n.km.trim() ? Number(n.km.replace(/\D/g, '')) : 0,
        color: n.color.trim() || undefined,
        combustible: n.combustible || undefined, transmision: n.transmision || undefined, carroceria: n.carroceria || undefined,
        ...(esConsignacion ? { precio_piso: monto(n.piso) ?? undefined } : { costo_adquisicion: monto(n.costo) ?? 0 }),
        precio_venta: monto(n.precio) ?? undefined,
        titular_nombre: n.titular_nombre.trim() || undefined,
        titular_telefono: n.titular_telefono.trim() || undefined,
      }));
    } catch {
      // El aviso con el motivo lo muestra el interceptor de errores.
      this.guardando.set(false);
      return;
    }
    // El auto ya existe: lo que falle de acá en más se avisa y se termina en su ficha.
    let pendientes = 0;
    if (n.descripcion.trim()) {
      try { await firstValueFrom(this.api.editar(unidad.id, { descripcion: n.descripcion.trim() })); } catch { pendientes++; }
    }
    const fotos = this.fotos();
    for (let i = 0; i < fotos.length; i++) {
      this.paso.set(`Subiendo foto ${i + 1} de ${fotos.length}…`);
      try { await firstValueFrom(this.api.subirFoto(unidad.id, fotos[i].archivo)); } catch { pendientes++; }
    }
    if (n.publicar) {
      this.paso.set('Publicándolo en el sitio…');
      // Sólo se publica un auto «disponible»: recién cargado está en «ingreso».
      try {
        await firstValueFrom(this.api.cambiarEstado(unidad.id, 'disponible'));
        await firstValueFrom(this.api.publicar(unidad.id, true));
      } catch { pendientes++; }
    }
    this.guardando.set(false);
    if (pendientes) this.notification.info(`Unidad ${unidad.numero} cargada, pero algo no se pudo completar: revisá las fotos, la descripción y si quedó publicada.`);
    else this.notification.success(`Unidad ${unidad.numero} cargada`);
    this.router.navigate(['/home/autos/unidad', unidad.id]);
  }
}
