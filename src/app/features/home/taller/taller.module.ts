import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { TallerComponent } from './taller.component';

const routes: Routes = [{ path: '', component: TallerComponent }];

@NgModule({
  declarations: [TallerComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes)],
})
export class TallerModule {}
