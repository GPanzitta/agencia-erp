import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { DocumentosService } from '../../../../core/services/documentos.service';
import {
  CategoriaDocumentoAgencia,
  ClaveDocumentoAgencia,
  guardarPlantillaDoc,
  listarPlantillasDocumento,
  obtenerPlantillaDoc,
  PlantillaDocumentoAgencia,
  restaurarPlantillaDoc,
  tieneCambiosPlantillaDoc,
  VARIABLES_DOCUMENTO,
} from '../../../../core/services/documentos/plantillas-doc.util';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-documentos-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './documentos-config.component.html',
  styleUrls: ['./documentos-config.component.scss'],
})
export class DocumentosConfigComponent implements OnInit {
  private documentos = inject(DocumentosService);
  private notification = inject(NotificationService);
  private sanitizer = inject(DomSanitizer);

  readonly categorias: CategoriaDocumentoAgencia[] = [
    'Ventas y Operaciones',
    'Consignación y Toma',
    'Taller y Salón',
  ];
  readonly variables = VARIABLES_DOCUMENTO;
  readonly coloresSugeridos = [
    { nombre: 'Naranja FG', hex: '#FF7F00' },
    { nombre: 'Azul Marino', hex: '#1D4ED8' },
    { nombre: 'Rojo Racing', hex: '#DC2626' },
    { nombre: 'Verde Esmeralda', hex: '#059669' },
    { nombre: 'Grafito Ejecutivo', hex: '#2D2F31' },
    { nombre: 'Dorado Premium', hex: '#B45309' },
  ];

  plantillas = signal<PlantillaDocumentoAgencia[]>([]);
  elegidaClave = signal<ClaveDocumentoAgencia>('boleto');
  borrador: PlantillaDocumentoAgencia = obtenerPlantillaDoc('boleto');
  vistaPreviaHtml = signal<SafeHtml>('');

  readonly grupos = computed(() => {
    const todas = this.plantillas();
    return this.categorias.map((categoria) => ({
      categoria,
      items: todas.filter((p) => p.categoria === categoria),
    }));
  });

  ngOnInit(): void {
    this.recargarLista('boleto');
  }

  recargarLista(claveActiva?: ClaveDocumentoAgencia): void {
    const lista = listarPlantillasDocumento();
    this.plantillas.set(lista);
    const clave = claveActiva ?? this.elegidaClave();
    this.seleccionar(clave);
  }

  seleccionar(clave: ClaveDocumentoAgencia): void {
    this.elegidaClave.set(clave);
    const tpl = obtenerPlantillaDoc(clave);
    this.borrador = {
      ...tpl,
      firmas: [...tpl.firmas] as [string, string, string],
    };
    void this.actualizarVistaPrevia();
  }

  fueModificada(clave: ClaveDocumentoAgencia): boolean {
    return tieneCambiosPlantillaDoc(clave);
  }

  async actualizarVistaPrevia(): Promise<void> {
    const htmlCompleto = await this.documentos.htmlVistaPreviaPlantilla(this.borrador);
    this.vistaPreviaHtml.set(this.sanitizer.bypassSecurityTrustHtml(htmlCompleto));
  }

  insertarVariable(variableClave: string, campo: HTMLTextAreaElement): void {
    const actual = this.borrador.clausulas ?? '';
    const desde = campo.selectionStart ?? actual.length;
    const hasta = campo.selectionEnd ?? actual.length;
    const token = `{${variableClave}}`;
    this.borrador.clausulas = `${actual.slice(0, desde)}${token}${actual.slice(hasta)}`;
    void this.actualizarVistaPrevia();
    const cursor = desde + token.length;
    setTimeout(() => {
      campo.focus();
      campo.setSelectionRange(cursor, cursor);
    });
  }

  guardar(): void {
    if (!this.borrador.titulo.trim()) {
      this.notification.error('El título principal del documento no puede quedar vacío.');
      return;
    }
    guardarPlantillaDoc(this.borrador);
    this.recargarLista(this.borrador.clave);
    this.notification.success(`Plantilla «${this.borrador.nombre}» guardada. Todos los próximos documentos usarán este formato.`);
  }

  restaurarOriginal(): void {
    const original = restaurarPlantillaDoc(this.borrador.clave);
    this.borrador = {
      ...original,
      firmas: [...original.firmas] as [string, string, string],
    };
    this.recargarLista(this.borrador.clave);
    this.notification.success(`«${this.borrador.nombre}» restaurado a su texto y formato original.`);
  }

  abrirVentanaPrueba(): void {
    void this.documentos.probarPlantillaDocumento(this.borrador);
  }
}
