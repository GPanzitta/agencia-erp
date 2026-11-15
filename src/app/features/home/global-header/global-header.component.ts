import { Component, EventEmitter, OnInit, Output, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { Rol } from '../../../core/interfaces/auth.interface';
import { AuthService } from '../../auth/services/auth.service';
import { armarGruposNav, linkActivo } from '../app-nav/nav-items.util';
import { AutosService } from '../autos/autos.service';
import { urlDelSitio } from '../autos/autos.util';

/**
 * La barra de arriba: en qué pantalla estás, el buscador de autos, el enlace
 * al sitio de la agencia y el botón para cargar un auto, siempre a mano.
 */
@Component({
  selector: 'app-global-header',
  standalone: false,
  templateUrl: './global-header.component.html',
  styleUrls: ['./global-header.component.scss'],
})
export class GlobalHeaderComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private autos = inject(AutosService);

  @Output() menu = new EventEmitter<void>();

  private url = signal(this.router.url);
  sitio = signal<string | null>(null);

  private esAdmin = computed(() => [Rol.ADMIN, Rol.SUPERADMIN].includes(this.auth.rol() as Rol));
  puedeCargar = computed(() => this.esAdmin() || this.auth.rol() === Rol.MOSTRADOR);

  /** El nombre de la pantalla actual, tomado del mismo menú. */
  donde = computed(() => {
    const items = armarGruposNav({ esAdmin: this.esAdmin(), esVendedor: this.auth.rol() === Rol.MOSTRADOR }).flatMap((g) => g.items);
    const link = linkActivo(this.url(), items);
    if (this.url().startsWith('/home/perfil')) return 'Mi perfil';
    return items.find((i) => i.link === link)?.rotulo ?? '';
  });

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => this.url.set((e as NavigationEnd).urlAfterRedirects));
  }

  ngOnInit(): void {
    this.autos.sitio().subscribe({ next: (s) => this.sitio.set(urlDelSitio(environment.portalUrl, s.slug)), error: () => undefined });
  }

  /** La búsqueda vive en el stock, con el término en la URL. */
  buscar(termino: string): void {
    const q = (termino ?? '').trim();
    this.router.navigate(['/home/autos'], { queryParams: q ? { q } : {} });
  }
}
