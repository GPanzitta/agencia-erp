import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GastosDashboardComponent } from './gastos-dashboard/gastos-dashboard.component';
import { rolGuard } from '../../../core/guards/rol.guard';
import { Rol } from '../../../core/interfaces/auth.interface';

// Un mismo módulo, dos territorios: el dashboard de gastos es del dueño y
// Compras es de los cuatro puestos de adentro. Los guards van HIJO POR HIJO y
// nunca en el padre `gastos` de home-routing: un guard arriba le mataría
// Compras al pañol, que no tiene por qué ver los gastos.
const routes: Routes = [
  // Los gastos del taller quedaron sólo del dueño: el mostrador los perdió.
  { path: '', component: GastosDashboardComponent, canActivate: [rolGuard(Rol.ADMIN)] },
  // Armador de pedido: el catálogo con stock/consumo/sugerido a la vista.
  // Las dos que asientan un egreso de billetera quedaron en admin y pañol,
  // los mismos dos roles que sus endpoints. Estuvieron abiertas a los cuatro
  // un rato: mostrador y técnico entraban, cargaban la compra entera y el
  // Guardar les devolvía 403. Pagar sigue siendo de admin y pañol —eso no
  // cambió—; lo que se arregló es que la pantalla lo diga antes y no después.
  //
  // Se eligió cerrar y no dejarlas en solo-lectura porque ninguna de las dos
  // tiene nada que mirar: son formularios de punta a punta, y lo que llegó de
  // una OC ya se ve en el detalle de Compras, que sí es de los cuatro.
  // El gate de UI que apaga los botones vive en `puedeRegistrarCompra`.

  // Spec C §2.5: se compró en el mostrador y se carga de una (OC + entrega + gasto).
  // Página propia (no modal): se abre desde el celular al lado del camión.
  // `POST /purchase-orders/:id/entregas` recibe y paga en el mismo request.
  // Los proveedores viven en /home/proveedores; acá solo queda la redirección
  // para no romper enlaces viejos.
  { path: 'proveedores', redirectTo: '/home/proveedores' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class GastosRoutingModule { }
