import { Component, inject } from '@angular/core';
import { InactividadService } from './core/services/inactividad.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'brumm-frontend';
  // DAT-05: se crea con la app y se prende sola cuando hay sesión confirmada.
  private inactividad = inject(InactividadService);
}
