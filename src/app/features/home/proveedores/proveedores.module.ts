import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { ProveedoresRoutingModule } from './proveedores-routing.module';
import { ProveedoresPageComponent } from './proveedores-page/proveedores-page.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@NgModule({
  declarations: [
    ProveedoresPageComponent
  ],
  imports: [
    IconComponent,
    CommonModule,
    ReactiveFormsModule,
    ProveedoresRoutingModule
  ]
})
export class ProveedoresModule { }
