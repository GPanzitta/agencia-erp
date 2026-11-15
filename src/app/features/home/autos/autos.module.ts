import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { rolGuard } from '../../../core/guards/rol.guard';
import { Rol } from '../../../core/interfaces/auth.interface';
import { InteresadosComponent } from './interesados.component';
import { OperacionesListaComponent } from './operaciones-lista.component';
import { StockListaComponent } from './stock-lista.component';
import { PreciosComponent } from './precios.component';
import { EscribirComponent } from '../mensajes/escribir.component';
import { UnidadAltaComponent } from './unidad-alta.component';
import { UnidadPublicacionComponent } from './unidad-publicacion.component';
import { UnidadFichaComponent } from './unidad-ficha.component';
import { UnidadVentaComponent } from './unidad-venta.component';

const routes: Routes = [
  { path: '', component: StockListaComponent },
  // Las ventas mueven plata: el dueño y el vendedor (hoy el puesto «mostrador»), como en el backend.
  { path: 'operaciones', component: OperacionesListaComponent, canActivate: [rolGuard(Rol.ADMIN, Rol.MOSTRADOR)] },
  { path: 'interesados', component: InteresadosComponent, canActivate: [rolGuard(Rol.ADMIN, Rol.MOSTRADOR)] },
  { path: 'precios', component: PreciosComponent, canActivate: [rolGuard(Rol.ADMIN, Rol.MOSTRADOR)] },
  // Cargar un auto: el dueño y el vendedor, igual que el backend.
  { path: 'nueva', component: UnidadAltaComponent, canActivate: [rolGuard(Rol.ADMIN, Rol.MOSTRADOR)] },
  { path: 'unidad/:id/publicacion', component: UnidadPublicacionComponent, canActivate: [rolGuard(Rol.ADMIN, Rol.MOSTRADOR)] },
  { path: 'unidad/:id', component: UnidadFichaComponent },
];

/** La agencia: stock de unidades y ventas (diseño del 12/11/2026). */
@NgModule({
  declarations: [UnidadPublicacionComponent, PreciosComponent, UnidadAltaComponent, InteresadosComponent, StockListaComponent, UnidadFichaComponent, UnidadVentaComponent, OperacionesListaComponent],
  imports: [CommonModule, FormsModule, EscribirComponent, RouterModule.forChild(routes)],
})
export class AutosModule {}
