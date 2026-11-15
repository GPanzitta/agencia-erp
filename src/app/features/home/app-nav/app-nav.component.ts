import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { AuthService } from '../../auth/services/auth.service';
import { Rol } from '../../../core/interfaces/auth.interface';
import { INICIALES_PRODUCTO, NOMBRE_PRODUCTO } from '../../../core/marca-producto';
import { AutosService } from '../autos/autos.service';
import { armarGruposNav, GrupoNav, ItemNav, linkActivo } from './nav-items.util';

const ROTULO_PUESTO: Record<string, string> = { admin: 'Dueño', superadmin: 'Dueño', mostrador: 'Vendedor' };

/**
 * El menú de la agencia: marca arriba, las pantallas agrupadas según el puesto
 * y, abajo, quién está usando el sistema. En escritorio es la columna fija de
 * la izquierda; con [vertical]=true es lo mismo dentro del cajón del celular.
 */
@Component({
  selector: 'app-app-nav',
  standalone: false,
  templateUrl: './app-nav.component.html',
  styleUrls: ['./app-nav.component.scss'],
})
export class AppNavComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private autos = inject(AutosService);

  @Input() vertical = false;

  readonly marca = NOMBRE_PRODUCTO;
  readonly iniciales = INICIALES_PRODUCTO;

  private rol = computed(() => this.authService.rol());
  private url = signal(this.router.url);
  /** Pedidos de reserva del sitio que esperan que alguien confirme la seña. */
  private reservasDelSitio = signal(0);

  grupos = computed<GrupoNav[]>(() => {
    const rol = this.rol();
    return armarGruposNav({ esAdmin: rol === Rol.ADMIN || rol === Rol.SUPERADMIN, esVendedor: rol === Rol.MOSTRADOR });
  });

  activo = computed(() => linkActivo(this.url(), this.grupos().flatMap((g) => g.items)));

  nombre = computed(() => this.authService.currentUser()?.nombre ?? '');
  puesto = computed(() => ROTULO_PUESTO[String(this.rol() ?? '').toLowerCase()] ?? '');
  inicialesDelUsuario = computed(() => {
    const partes = this.nombre().trim().split(/\s+/).filter(Boolean);
    return partes.length ? partes.slice(0, 2).map((p) => p[0].toUpperCase()).join('') : '·';
  });

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.url.set((e as NavigationEnd).urlAfterRedirects);
        this.contarReservas();
      });
  }

  ngOnInit(): void {
    this.contarReservas();
  }

  insignia(it: ItemNav): number {
    return it.insignia === 'reservas_sitio' ? this.reservasDelSitio() : 0;
  }

  /** Se cuenta al entrar y en cada cambio de pantalla: no hace falta más para un aviso. */
  private contarReservas(): void {
    // El cajón del celular repite el menú: cuenta sólo la columna fija.
    if (this.vertical) return;
    if (!this.grupos().some((g) => g.items.some((i) => i.insignia === 'reservas_sitio'))) return;
    this.autos.pedidosDeReserva().subscribe({
      next: (l) => this.reservasDelSitio.set(l.filter((p) => p.estado === 'pendiente').length),
      error: () => undefined,
    });
  }

  trackPorTitulo(_: number, g: GrupoNav): string { return g.titulo ?? ''; }
  trackPorLink(_: number, it: ItemNav): string { return it.link; }

  logout(): void {
    this.authService.logout();
  }
}
