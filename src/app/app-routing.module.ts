import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard, unauthGuard } from './core/guards/auth.guard';
import { rolGuard } from './core/guards/rol.guard';

/** Exportadas para el spec de SEG-ERP-04. */
export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule),
    canActivate: [unauthGuard]
  },
  {
    path: 'home',
    loadChildren: () => import('./features/home/home.module').then(m => m.HomeModule),
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent),
    // SEG-ERP-04: la consola de la plataforma es sólo del superadmin
    // (`rolGuard()` sin roles = sólo él). Con `authGuard` solo, cualquier
    // empleado la cargaba y el backend recién lo frenaba con 403.
    canActivate: [authGuard, rolGuard()],
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      { path: 'inicio', loadComponent: () => import('./features/admin/pages/inicio/inicio.component').then(m => m.InicioComponent) },
      { path: 'empresas', loadComponent: () => import('./features/admin/pages/empresas/empresas.component').then(m => m.EmpresasComponent) },
      { path: 'plataforma', loadComponent: () => import('./features/admin/pages/plataforma/plataforma.component').then(m => m.PlataformaComponent) }
    ]
  },
  {
    // SEG-54: la clave provisoria del reseteo se cambia acá, fuera del layout
    // de /home (que dispara pedidos que el backend rechaza con esa clave).
    path: 'cambiar-clave',
    loadComponent: () => import('./features/cuenta/cambiar-clave/cambiar-clave.component').then(m => m.CambiarClaveComponent),
    canActivate: [authGuard],
    data: { obligatorio: true },
  },
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/home'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
