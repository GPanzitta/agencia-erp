import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IconComponent } from '../../shared/components/icon/icon.component';
import { SharedModule } from '../../shared/shared.module';
import { AppNavComponent } from './app-nav/app-nav.component';
import { AvisoAbonoComponent } from './aviso-abono/aviso-abono.component';
import { CajasComponent } from './cajas/cajas.component';
import { GlobalHeaderComponent } from './global-header/global-header.component';
import { HomeRoutingModule } from './home-routing.module';
import { HomeComponent } from './home/home.component';
import { InicioComponent } from './inicio/inicio.component';
import { PrimerosPasosModule } from './dashboard/primeros-pasos/primeros-pasos.module';

@NgModule({
  declarations: [HomeComponent, AvisoAbonoComponent, GlobalHeaderComponent, AppNavComponent, InicioComponent, CajasComponent],
  imports: [PrimerosPasosModule, IconComponent, CommonModule, FormsModule, SharedModule, HomeRoutingModule],
})
export class HomeModule {}
