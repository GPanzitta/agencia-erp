import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ConfiguracionRoutingModule } from './configuracion-routing.module';
import { ConfiguracionComponent } from './configuracion.component';
import { AbonoComponent } from './abono/abono.component';
import { WalletsComponent } from './wallets/wallets.component';
import { SharedModule } from '../../../shared/shared.module';
import { EmpleadosComponent } from './empleados/empleados.component';
import { EmpresaComponent } from './empresa/empresa.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { SitioWebComponent } from './sitio-web/sitio-web.component';

@NgModule({
  declarations: [
    AbonoComponent,
    ConfiguracionComponent,
    WalletsComponent,
    EmpleadosComponent,
    EmpresaComponent,
    SitioWebComponent,
  ],
  imports: [
    IconComponent,
    CommonModule,
    ConfiguracionRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    DragDropModule,
    SharedModule
  ]
})
export class ConfiguracionModule { }
