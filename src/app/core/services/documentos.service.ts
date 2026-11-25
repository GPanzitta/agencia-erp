import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { EmpresaService } from './empresa.service';
import { environment } from '../../../environments/environment';
import { SIN_AVISO_DE_ERROR } from '../interceptors/error.interceptor';
import { EmpresaDoc } from './documentos/comun';
import {
  armarActaDeEntrega,
  armarBoletoDeCompraventa,
  armarCartelDeVidriera,
  armarContratoDeConsignacion,
  armarEtiquetaDeLlave,
  armarHojaDePeritaje,
  armarLiquidacionConsignacion,
  armarOrdenDeAlistaje,
  armarOrdenDeVenta,
  armarPropuestaComercial,
  armarReciboDePago,
  armarVistaPreviaPlantillaDoc,
  OrdenAlistajeDoc,
  PagoDoc,
  PeritajeTomaDoc,
  PropuestaAutoDoc,
  UnidadDoc,
  VentaAutoDoc,
} from './documentos/boleto-auto.doc';
import { PlantillaDocumentoAgencia } from './documentos/plantillas-doc.util';
import { urlFoto } from '../utils/foto-url.util';
import * as QRCode from 'qrcode';

/**
 * Los papeles de la agencia: se arma el HTML, se abre en una ventana aparte
 * con estilos de impresión A4 y se imprime desde ahí.
 *
 * - Recibo: de la seña o de cada pago de una venta.
 * - Boleto de compraventa: un modelo, a revisar por el abogado o el gestor.
 */
@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private empresaService = inject(EmpresaService);
  private http = inject(HttpClient);
  /** El logo del perfil público, pedido una sola vez y sólo al imprimir. */
  private logo?: Promise<string | null>;

  constructor() {
    // El membrete se cachea al arrancar: cuando alguien imprime, ya está.
    this.empresaService.cargar().subscribe({ error: () => {} });
  }

  /** Recibo de la seña o de un pago de la venta de un auto. */
  async reciboDePagoAuto(venta: VentaAutoDoc, pago: PagoDoc): Promise<void> {
    this.abrirHtml(armarReciboDePago(venta, pago, await this.membrete()));
  }

  /** Boleto de compraventa (modelo a revisar por el abogado o el gestor de la agencia). */
  async boletoAuto(venta: VentaAutoDoc): Promise<void> {
    this.abrirHtml(armarBoletoDeCompraventa(venta, await this.membrete()));
  }

  /** Cartel A4 de parabrisas / vidriera con QR a la publicación online. */
  async cartelDeVidrieraAuto(unidad: UnidadDoc, urlPublica?: string | null): Promise<void> {
    let qr: string | null = null;
    if (urlPublica) {
      try {
        qr = await QRCode.toString(urlPublica, { type: 'svg', margin: 1, width: 136 });
      } catch {
        qr = null;
      }
    }
    this.abrirHtml(armarCartelDeVidriera(unidad, await this.membrete(), { qr, url: urlPublica ?? null }));
  }

  /** Contrato de autorización de venta en consignación. */
  async contratoDeConsignacionAuto(unidad: UnidadDoc): Promise<void> {
    this.abrirHtml(armarContratoDeConsignacion(unidad, await this.membrete()));
  }

  /** Liquidación final para el propietario de un vehículo en consignación. */
  async liquidacionConsignacionAuto(unidad: UnidadDoc): Promise<void> {
    this.abrirHtml(armarLiquidacionConsignacion(unidad, await this.membrete()));
  }

  /** Hoja de propuesta comercial llave por llave (Permuta + Efectivo + Cuotas) con QR al auto. */
  async propuestaComercialAuto(propuesta: PropuestaAutoDoc, urlPublica?: string | null): Promise<void> {
    let qr: string | null = null;
    if (urlPublica) {
      try {
        qr = await QRCode.toString(urlPublica, { type: 'svg', margin: 1, width: 136 });
      } catch {
        qr = null;
      }
    }
    this.abrirHtml(armarPropuestaComercial(propuesta, await this.membrete(), { qr, url: urlPublica ?? null }));
  }

  /** Hoja A4 de tasación y peritaje técnico de toma de un usado. */
  async hojaDePeritajeAuto(peritaje: PeritajeTomaDoc): Promise<void> {
    this.abrirHtml(armarHojaDePeritaje(peritaje, await this.membrete()));
  }

  /** Acta de entrega de unidad con fecha/hora exacta y checklist de accesorios. */
  async actaDeEntregaAuto(venta: VentaAutoDoc): Promise<void> {
    this.abrirHtml(armarActaDeEntrega(venta, await this.membrete()));
  }

  /** Orden de Venta (OV) A4 con código QR de seguimiento online en el portal. */
  async ordenDeVentaAuto(venta: VentaAutoDoc, urlSeguimiento?: string | null): Promise<void> {
    let qr: string | null = null;
    if (urlSeguimiento) {
      try {
        qr = await QRCode.toString(urlSeguimiento, { type: 'svg', margin: 1, width: 136 });
      } catch {
        qr = null;
      }
    }
    this.abrirHtml(armarOrdenDeVenta(venta, await this.membrete(), { qr, url: urlSeguimiento ?? null }));
  }

  /** Orden de Alistaje y Taller (OA-2026-XXXX) A4 con QR y checklist de 12 puntos. */
  async ordenDeAlistajeAuto(orden: OrdenAlistajeDoc, urlOrden?: string | null): Promise<void> {
    let qr: string | null = null;
    if (urlOrden) {
      try {
        qr = await QRCode.toString(urlOrden, { type: 'svg', margin: 1, width: 132 });
      } catch {
        qr = null;
      }
    }
    this.abrirHtml(armarOrdenDeAlistaje(orden, await this.membrete(), { qr, url: urlOrden ?? null }));
  }

  /** Etiqueta recortable con QR para el llavero del tablero y la carpeta de la unidad. */
  async etiquetaDeLlaveAuto(unidad: UnidadDoc, urlFicha?: string | null): Promise<void> {
    let qr: string | null = null;
    if (urlFicha) {
      try {
        qr = await QRCode.toString(urlFicha, { type: 'svg', margin: 1, width: 112 });
      } catch {
        qr = null;
      }
    }
    this.abrirHtml(armarEtiquetaDeLlave(unidad, await this.membrete(), { qr, url: urlFicha ?? null }));
  }

  /** Abre una ventana de prueba A4 con datos de ejemplo para la plantilla que se está editando. */
  async probarPlantillaDocumento(tpl: PlantillaDocumentoAgencia): Promise<void> {
    this.abrirHtml(armarVistaPreviaPlantillaDoc(tpl, await this.membrete()));
  }

  /** Devuelve el HTML A4 renderizado de una plantilla con datos de ejemplo (para el iframe de vista previa). */
  async htmlVistaPreviaPlantilla(tpl: PlantillaDocumentoAgencia): Promise<string> {
    return armarVistaPreviaPlantillaDoc(tpl, await this.membrete());
  }

  private async membrete(): Promise<EmpresaDoc | null> {
    const empresa = this.empresaService.empresa() as EmpresaDoc | null;
    this.logo ??= firstValueFrom(
      this.http
        .get<{ logo_url?: string | null }>(`${environment.apiUrl}/companies/mi-empresa/perfil-publico`, {
          context: new HttpContext().set(SIN_AVISO_DE_ERROR, true),
        })
        .pipe(timeout(2500)),
    )
      // Relativo (dev, `/uploads/...`) se resuelve contra el backend: la
      // ventana del documento es about:blank y lo resolvería contra el ERP.
      .then((p) => (p?.logo_url ? urlFoto(p.logo_url) : null))
      .catch(() => {
        this.logo = undefined; // se reintenta en la próxima impresión
        return null;
      });
    const logo = await this.logo;
    return empresa ? { ...empresa, logo_url: logo } : null;
  }


  private abrirHtml(html: string): void {
    const ventana = window.open('', '_blank', 'width=860,height=1000');
    if (ventana) {
      ventana.document.write(html);
      ventana.document.close();
      return;
    }

    // Ventana emergente bloqueada: se imprime igual, desde un iframe oculto.
    // El operador ve directamente el diálogo de impresión del navegador.
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) { iframe.remove(); return; }
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      const w = iframe.contentWindow as (Window & { imprimirFotos?: () => void }) | null;
      // Con fotos, la pregunta del papel no se ve (el iframe es invisible):
      // se hace desde la ventana del ERP y las fotos salen del mismo iframe.
      const pregunta = w?.document.getElementById('pf-titulo')?.textContent;
      if (w && pregunta && w.imprimirFotos) {
        let yaPregunto = false;
        w.addEventListener('afterprint', () => {
          if (yaPregunto) return;
          yaPregunto = true;
          if (window.confirm(pregunta)) setTimeout(() => w.imprimirFotos?.());
        });
      }
      w?.focus();
      w?.print();
      // Se limpia después: el diálogo de impresión ya tomó su copia (con
      // margen para que el operador conteste la pregunta de las fotos).
      setTimeout(() => iframe.remove(), 300000);
    };
  }
}
