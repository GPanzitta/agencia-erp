import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { AuthRoutingModule } from './auth-routing.module';
import { LoginComponent } from './login/login.component';
import { RegistroComponent } from './registro/registro.component';
import { ConfirmarComponent } from './confirmar/confirmar.component';
import { NuevaClaveComponent } from './nueva-clave/nueva-clave.component';
import { RecuperarComponent } from './recuperar/recuperar.component';


@NgModule({
  declarations: [
    LoginComponent,
    RegistroComponent,
    ConfirmarComponent,
    RecuperarComponent,
    NuevaClaveComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AuthRoutingModule
  ]
})
export class AuthModule { }
