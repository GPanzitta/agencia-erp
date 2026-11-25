import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ConfiguracionComponent } from './configuracion.component';
import { WalletsComponent } from './wallets/wallets.component';

import { EmpleadosComponent } from './empleados/empleados.component';
import { EmpresaComponent } from './empresa/empresa.component';
import { AbonoComponent } from './abono/abono.component';
import { SitioWebComponent } from './sitio-web/sitio-web.component';
import { rolGuard } from '../../../core/guards/rol.guard';
import { Rol } from '../../../core/interfaces/auth.interface';

const routes: Routes = [
  {
    path: '',
    component: ConfiguracionComponent,
    children: [
      { path: '', redirectTo: 'empresa', pathMatch: 'full' },
      { path: 'empresa', component: EmpresaComponent },
      // «Medios de pago» era un catálogo que ningún flujo leía (#4). Con D2 el
      // chofer cobra según las billeteras de Empresa, así que la pantalla
      // confundía más de lo que configuraba. Un link o favorito viejo cae ahí.
      { path: 'medios-pago', redirectTo: 'empresa' },
      { path: 'wallets', component: WalletsComponent },
      // Los textos de WhatsApp y correo: los reescribe el dueño.
      { path: 'mensajes', canActivate: [rolGuard(Rol.ADMIN)], loadComponent: () => import('../mensajes/mensajes-config.component').then((m) => m.MensajesConfigComponent) },
      // Las plantillas de los 11 documentos A4 de la agencia (boletos, OV, recibos, actas, consignación, taller).
      { path: 'documentos', canActivate: [rolGuard(Rol.ADMIN)], loadComponent: () => import('./documentos/documentos-config.component').then((m) => m.DocumentosConfigComponent) },
      // Alta y baja de empleados: solo el admin del taller.
      {
        path: 'empleados',
        component: EmpleadosComponent,
        canActivate: [rolGuard(Rol.ADMIN)],
      },
      // Lo que paga el taller: solo el admin (spec 2026-10-28 §7).
      {
        path: 'abono',
        component: AbonoComponent,
        canActivate: [rolGuard(Rol.ADMIN)],
      },
      // Traer datos de otro sistema: solo el admin (spec 2026-10-28 §6).
      // Los textos que salen al cliente los define quien manda en el taller.
      // El diccionario del taller cambia lo que encuentra TODO el pañol: lo
      // toca el mismo que da de alta gente (spec §6.9 y §5.5).
      // La vidriera la ordena quien manda en el taller: cada cambio mueve la
      // navegación pública de la tienda (T1).
      // Qué se muestra primero en la home del sitio lo decide quien manda en
      // el taller: mueve la primera pantalla que ve el cliente (S1c-b §4.2).
      // La consola de la portada también sale a la calle: la edita el admin.
      // Lo que el taller muestra en la calle lo edita quien manda en el taller (S1a §4.1).
      {
        path: 'sitio-web',
        component: SitioWebComponent,
        canActivate: [rolGuard(Rol.ADMIN)],
      },
      // La cuenta de Mercado Libre la conecta y administra quien manda en
      // el taller (M1 §9.1): expone tokens y credenciales de publicación.
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ConfiguracionRoutingModule { }
