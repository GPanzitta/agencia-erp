import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { rolGuard } from '../../core/guards/rol.guard';
import { Rol } from '../../core/interfaces/auth.interface';
import { CajasComponent } from './cajas/cajas.component';
import { HomeComponent } from './home/home.component';
import { InicioComponent } from './inicio/inicio.component';

/**
 * Las pantallas de la agencia. `/home` es donde aterriza el login y adonde
 * rebota el rolGuard, así que Inicio y Stock van SIN guard: un guard ahí deja
 * a quien no es dueño rebotando contra la puerta. Lo que se cierra son los
 * endpoints, no esas dos rutas.
 */
const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    children: [
      { path: '', pathMatch: 'full', component: InicioComponent },
      { path: 'autos', loadChildren: () => import('./autos/autos.module').then((m) => m.AutosModule) },
      { path: 'cajas', component: CajasComponent, canActivate: [rolGuard(Rol.ADMIN, Rol.MOSTRADOR)] },
      { path: 'gastos', loadChildren: () => import('./gastos/gastos.module').then((m) => m.GastosModule) },
      { path: 'proveedores', canActivate: [rolGuard(Rol.ADMIN)], loadChildren: () => import('./proveedores/proveedores.module').then((m) => m.ProveedoresModule) },
      { path: 'configuracion', canActivate: [rolGuard(Rol.ADMIN)], loadChildren: () => import('./configuracion/configuracion.module').then((m) => m.ConfiguracionModule) },
      // Registro de acciones sensibles: sólo el dueño.
      { path: 'auditoria', canActivate: [rolGuard(Rol.ADMIN)], loadChildren: () => import('./auditoria/auditoria.module').then((m) => m.AuditoriaModule) },
      { path: 'perfil', loadComponent: () => import('../cuenta/cambiar-clave/cambiar-clave.component').then((m) => m.CambiarClaveComponent) },
      // Cualquier dirección vieja (del sistema anterior) cae en Inicio.
      { path: '**', redirectTo: '' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HomeRoutingModule {}
