import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { PrimerosPasosComponent } from './primeros-pasos.component';

/** Los primeros pasos, en un módulo propio para poder mostrarlos en el stock de la agencia (12/11/2026). */
@NgModule({
  declarations: [PrimerosPasosComponent],
  imports: [CommonModule, RouterModule],
  exports: [PrimerosPasosComponent],
})
export class PrimerosPasosModule {}
