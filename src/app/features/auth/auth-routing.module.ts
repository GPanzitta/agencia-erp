import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegistroComponent } from './registro/registro.component';
import { ConfirmarComponent } from './confirmar/confirmar.component';
import { NuevaClaveComponent } from './nueva-clave/nueva-clave.component';
import { RecuperarComponent } from './recuperar/recuperar.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  // Esto da de alta un TALLER nuevo. El alta de empleados la sigue haciendo un
  // encargado o superadmin contra POST /api/auth/register, que exige token.
  { path: 'registro', component: RegistroComponent },
  { path: 'confirmar', component: ConfirmarComponent },
  { path: 'recuperar', component: RecuperarComponent },
  { path: 'nueva-clave', component: NuevaClaveComponent },
  { path: '', redirectTo: 'login', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthRoutingModule { }
