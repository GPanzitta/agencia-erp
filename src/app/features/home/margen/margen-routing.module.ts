import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { MargenComponent } from './margen.component';

const routes: Routes = [
  { path: '', component: MargenComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MargenRoutingModule {}
