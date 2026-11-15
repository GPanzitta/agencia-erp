import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { IconComponent } from './components/icon/icon.component';
import { AvisoDuplicadoComponent } from './components/aviso-duplicado/aviso-duplicado.component';
import { PrivadoPipe } from './pipes/privado.pipe';

@NgModule({
  declarations: [
    ConfirmDialogComponent,
    // La identidad y el buscador van acá por el mismo motivo que el escáner:
    // los consumen inventario, órdenes, gastos y configuración (spec §6.1).
    // La ficha de cliente completa: la usan Clientes (modal) y Órdenes (alta con cliente nuevo).
    // CLI-03: «¿Es alguno de estos?» antes de crear un cliente repetido.
    AvisoDuplicadoComponent,
    // Recibir escaneando: cajón compartido por Repuestos y el listado de OC.
    // Spec 2026-10-21 §15: el bloque lo usan el dashboard (dueño) y la ficha de órdenes (mostrador).
  ],
  imports: [
    IconComponent,
    // DAT-02: teléfono, correo y DNI tapados para técnico y chofer. Es standalone:
    // se importa para el buscador de cliente de acá y se reexporta para los módulos.
    PrivadoPipe,
    CommonModule,
    // El modal de mensajes usa [(ngModel)] en el textarea y el select de móvil,
    // y un routerLink al estado vacío. La identidad y el buscador linkean a la ficha.
    FormsModule,
    // La ficha de cliente es un formulario reactivo.
    ReactiveFormsModule,
    RouterModule
  ],
  exports: [
    // Órdenes usa <app-icon> en el modal de diagnóstico (C5b Task 9) y no importa
    // IconComponent por su cuenta: SharedModule lo reexporta para todos.
    IconComponent,
    PrivadoPipe,
    ConfirmDialogComponent,
    AvisoDuplicadoComponent,
    // Spec 2026-10-21 §15: el bloque lo usan el dashboard (dueño) y la ficha de órdenes (mostrador).
  ]
})
export class SharedModule { }
