import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import { Rol } from '../../../core/interfaces/auth.interface';

@Component({
  selector: 'app-configuracion',
  templateUrl: './configuracion.component.html',
  styleUrls: ['./configuracion.component.scss']
})
export class ConfiguracionComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  /**
   * Título del encabezado de objeto según la pestaña activa: el shell lleva
   * el .oh y las sub-páginas no repiten su propio título.
   */
  get tituloSeccion(): string {
    const url = this.router.url;
    if (url.includes('wallets')) return 'Billeteras';
    if (url.includes('empleados')) return 'Empleados';
    if (url.includes('mensajes')) return 'Mensajes';
    if (url.includes('sintomas')) return 'Síntomas';
    if (url.includes('sinonimos')) return 'Sinónimos';
    if (url.includes('vidriera')) return 'Vidriera';
    if (url.includes('sitio-web')) return 'Sitio web';
    if (url.includes('tienda')) return 'Tienda';
    if (url.includes('mercado-libre')) return 'Mercado Libre';
    return 'Empresa';
  }

  /**
   * Empleados y Mensajes son cosas de administración: una da de alta gente, la
   * otra define lo que el taller le dice al cliente. El guard de la ruta y el
   * backend cortan igual; esto es para no ofrecer algo que después rebota.
   */
  esAdmin = computed(() => {
    const rol = this.auth.rol();
    return rol === Rol.ADMIN || rol === Rol.SUPERADMIN;
  });
}
