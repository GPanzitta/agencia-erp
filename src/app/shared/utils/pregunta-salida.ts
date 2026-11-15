import { signal } from '@angular/core';

/**
 * «Tenés cambios sin guardar» sin plantilla: lo que decide la pregunta en las
 * fichas de órdenes y de clientes (spec de la ficha de órdenes §5 y de
 * clientes §4.3). El diálogo es `app-pregunta-salida`; esto es su lógica.
 */

export type EleccionSalida = 'guardar' | 'descartar' | 'seguir';

/** Lo que la pregunta necesita del que edita (el cuerpo de una orden, la ficha de un cliente). */
export interface EditorConCambios {
  hayCambios(): boolean;
  guardando(): boolean;
  /** Termina cuando termina el Guardar en curso (si hay). */
  esperarGuardado(): Promise<void>;
  descartar(): void;
  /** Resuelve `true` si quedó todo guardado. */
  guardar(): Promise<boolean>;
}

export interface PreguntaAbierta {
  resolver: (e: EleccionSalida) => void;
}

export class PreguntaDeSalida {
  /** El diálogo a la vista: resuelve con lo que se elija. */
  readonly abierta = signal<PreguntaAbierta | null>(null);

  /** Ya hay un pedido esperando que termine el Guardar: los siguientes no se encolan. */
  private esperandoGuardado = false;
  /** Dónde estaba el foco al abrir la pregunta: vuelve ahí al cerrarla. */
  private focoAntes: HTMLElement | null = null;

  constructor(
    private readonly editor: () => EditorConCambios | null | undefined,
    private readonly doc: Document = document,
  ) {}

  hayCambios(): boolean {
    return !!this.editor()?.hayCambios();
  }

  /** Lo que usa un `canDeactivate`: sin cambios, en el acto; con cambios, lo que se elija. */
  puedeSalir(): boolean | Promise<boolean> {
    return this.hayCambios() ? this.confirmar() : true;
  }

  /** Abre la pregunta y resuelve si se puede seguir (guardó bien o descartó). */
  async confirmar(): Promise<boolean> {
    const editor = this.editor();
    if (!editor?.hayCambios()) return true;
    // Con un Guardar volando no se pregunta encima (Descartar o Guardar otra vez
    // pisarían su respuesta): se espera a que termine y se decide con lo que quedó.
    if (editor.guardando()) {
      if (this.esperandoGuardado) return false;
      this.esperandoGuardado = true;
      try {
        await editor.esperarGuardado();
      } finally {
        this.esperandoGuardado = false;
      }
      if (!editor.hayCambios()) return true;
    }
    // Ya hay una pregunta abierta (p. ej. ▶ y enseguida un enlace): la vieja se da por «Seguir editando».
    const previa = this.abierta();
    if (!previa) this.focoAntes = this.doc.activeElement as HTMLElement | null;
    previa?.resolver('seguir');
    const propia: PreguntaAbierta = { resolver: () => {} };
    const eleccion = await new Promise<EleccionSalida>((resolver) => {
      propia.resolver = resolver;
      this.abierta.set(propia);
    });
    // Sólo se cierra la propia: la vieja, al resolverse, no se lleva a la nueva.
    if (this.abierta() === propia) {
      this.abierta.set(null);
      const foco = this.focoAntes;
      this.focoAntes = null;
      if (foco?.isConnected) foco.focus();
    }
    if (eleccion === 'seguir') return false;
    if (eleccion === 'descartar') {
      editor.descartar();
      return true;
    }
    return editor.guardar();
  }

  elegir(e: EleccionSalida): void {
    this.abierta()?.resolver(e);
  }

  /** Sin cambios corre en el acto (así la ficha responde sin demora); con cambios, después de preguntar. */
  conConfirmacion(accion: () => void): void {
    if (!this.hayCambios()) {
      accion();
      return;
    }
    void this.confirmar().then((sigue) => {
      if (sigue) accion();
    });
  }
}
