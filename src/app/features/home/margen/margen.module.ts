import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { IconComponent } from '../../../shared/components/icon/icon.component';
import { MargenRoutingModule } from './margen-routing.module';
import { MargenComponent } from './margen.component';

@NgModule({
  declarations: [MargenComponent],
  imports: [CommonModule, FormsModule, IconComponent, MargenRoutingModule],
})
export class MargenModule {}
