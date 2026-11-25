import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { Rol } from '../../../core/interfaces/auth.interface';
import { urlFoto } from '../../../core/utils/foto-url.util';
import { AuthService } from '../../auth/services/auth.service';
import { AutosService, Interesado, Operacion, PedidoDeReserva, ResumenStock, Unidad } from '../autos/autos.service';
import { dominioLegible, plata, renglon, textoDias } from '../autos/autos.util';
import { Pendiente, pendientesDeHoy } from './inicio.util';

/**
 * Inicio de la agencia (14/11/2026): lo que hay que atender hoy, cómo está el
 * stock y qué autos llevan más tiempo parados. Reemplaza al tablero del Taller.
 */
@Component({
  selector: 'app-inicio',
  standalone: false,
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.scss'],
})
export class InicioComponent implements OnInit {
  private api = inject(AutosService);
  private auth = inject(AuthService);

  readonly plata = plata;
  readonly renglon = renglon;
  readonly dominio = dominioLegible;
  readonly textoDias = textoDias;
  readonly foto = urlFoto;
  readonly hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  readonly esDuenio = computed(() => [Rol.ADMIN, Rol.SUPERADMIN].includes(this.auth.rol() as Rol) && !this.auth.modoCliente());
  readonly vende = computed(() => this.esDuenio() || this.auth.rol() === Rol.MOSTRADOR);
  readonly nombre = computed(() => (this.auth.currentUser()?.nombre ?? '').trim().split(/\s+/)[0] ?? '');

  cargando = signal(true);
  resumen = signal<ResumenStock | null>(null);
  stock = signal<Unidad[]>([]);
  pendientes = signal<Pendiente[]>([]);

  /** Los que más llevan parados: son los que hay que mover o rebajar. */
  parados = computed(() => [...this.stock()].filter((u) => u.estado !== 'reservada').sort((a, b) => b.dias_en_stock - a.dias_en_stock).slice(0, 5));
  recientes = computed(() => [...this.stock()].sort((a, b) => a.dias_en_stock - b.dias_en_stock).slice(0, 5));

  ngOnInit(): void {
    const vende = this.vende();
    forkJoin({
      stock: this.api.listar('stock').pipe(catchError(() => of([] as Unidad[]))),
      resumen: this.esDuenio() ? this.api.resumen().pipe(catchError(() => of(null))) : of(null),
      interesados: vende ? this.api.interesados('activos').pipe(catchError(() => of([] as Interesado[]))) : of([] as Interesado[]),
      pedidos: vende ? this.api.pedidosDeReserva().pipe(catchError(() => of([] as PedidoDeReserva[]))) : of([] as PedidoDeReserva[]),
      reservas: vende ? this.api.operaciones('reservas').pipe(catchError(() => of([] as Operacion[]))) : of([] as Operacion[]),
    }).subscribe((d) => {
      this.stock.set(d.stock);
      this.resumen.set(d.resumen);
      this.pendientes.set(pendientesDeHoy({ ...d, hoy: new Date() }));
      this.cargando.set(false);
    });
  }

  trackPorId(_: number, x: { id: string }): string { return x.id; }
  trackPorClave(_: number, p: Pendiente): string { return p.clave; }
}
