import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProveedoresPageComponent } from './proveedores-page/proveedores-page.component';

const routes: Routes = [
  { path: '', component: ProveedoresPageComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProveedoresRoutingModule { }
