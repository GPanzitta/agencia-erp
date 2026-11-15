import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { AuthService } from '../../auth/services/auth.service';
import { Rol } from '../../../core/interfaces/auth.interface';

/**
 * El marco de la agencia (14/11/2026): menú a la izquierda de punta a punta,
 * barra superior con el buscador de autos y el contenido a la derecha. En el
 * celular el menú se guarda en un cajón y aparecen los accesos de abajo.
 */
@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  menuAbierto = signal(false);

  /** Interesados y ventas son del dueño y del vendedor, igual que el menú y el backend. */
  vende = computed(() => [Rol.ADMIN, Rol.SUPERADMIN, Rol.MOSTRADOR].includes(this.auth.rol() as Rol));

  constructor() {
    // El cajón del celular se cierra solo al cambiar de pantalla.
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.menuAbierto.set(false));
  }
}
