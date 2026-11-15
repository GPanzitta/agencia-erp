import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SharedModule } from '../../../shared/shared.module';

import { GastosRoutingModule } from './gastos-routing.module';
import { GastosDashboardComponent } from './gastos-dashboard/gastos-dashboard.component';
import { NuevoGastoComponent } from './nuevo-gasto/nuevo-gasto.component';
import { CuentasPorPagarComponent } from './cuentas-por-pagar/cuentas-por-pagar.component';
import { VencimientosComponent } from './vencimientos/vencimientos.component';
import { PresupuestosComponent } from './presupuestos/presupuestos.component';
import { RecurrentesComponent } from './recurrentes/recurrentes.component';
import { ConfigFinanzasComponent } from './config-finanzas/config-finanzas.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@NgModule({
  declarations: [
    GastosDashboardComponent,
    NuevoGastoComponent,
    CuentasPorPagarComponent,
    VencimientosComponent,
    PresupuestosComponent,
    RecurrentesComponent,
    ConfigFinanzasComponent
  ],
  imports: [
    IconComponent,
    CommonModule,
    GastosRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    SharedModule
  ]
})
export class GastosModule { }
