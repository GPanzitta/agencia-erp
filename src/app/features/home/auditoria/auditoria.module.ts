import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuditoriaComponent } from './auditoria.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@NgModule({
  declarations: [AuditoriaComponent],
  imports: [
    IconComponent,
    CommonModule,
    RouterModule.forChild([{ path: '', component: AuditoriaComponent }]),
  ],
})
export class AuditoriaModule {}
