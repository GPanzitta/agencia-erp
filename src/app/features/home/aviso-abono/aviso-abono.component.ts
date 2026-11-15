import { Component, OnInit, computed, inject } from '@angular/core';
import { AbonoService, fechaAbono } from '../../../core/services/abono.service';
import { Rol } from '../../../core/interfaces/auth.interface';
import { AuthService } from '../../auth/services/auth.service';

/** Desde cuántas órdenes restantes del plan gratis vale la pena avisar. */
const AVISAR_DESDE = 5;

/** El aviso del abono arriba de todas las pantallas (spec 2026-10-28 §7). Sin novedades, no ocupa lugar. */
@Component({
  selector: 'app-aviso-abono',
  standalone: false,
  templateUrl: './aviso-abono.component.html',
  styleUrl: './aviso-abono.component.scss',
})
export class AvisoAbonoComponent implements OnInit {
  private abono = inject(AbonoService);
  private auth = inject(AuthService);

  esAdmin = computed(() => this.auth.rol() === Rol.ADMIN);

  grave = computed(() => this.abono.estado()?.estado === 'solo_lectura');

  mensaje = computed<string | null>(() => {
    const e = this.abono.estado();
    if (!e) return null;
    if (e.estado === 'solo_lectura') {
      return 'El abono de la agencia venció. Podés ver y exportar todo, pero no cargar nada nuevo. Tus clientes no se enteran: el link de la orden les sigue funcionando.';
    }
    if (e.estado === 'vencida') {
      return `El abono venció el ${fechaAbono(e.vence_en)}. Hay tiempo hasta el ${fechaAbono(e.gracia_hasta)} para pagar; después la agencia queda en sólo lectura.`;
    }
    if (e.tope === null) return null;
    const quedan = e.tope - e.ordenes_mes;
    if (quedan <= 0) return `Llegaste a las ${e.tope} unidades en stock del plan gratis: para ingresar otra, vendé alguna o pasate al plan pago.`;
    if (quedan > AVISAR_DESDE) return null;
    return quedan === 1
      ? 'Te queda lugar para 1 unidad más en el plan gratis.'
      : `Te queda lugar para ${quedan} unidades más en el plan gratis.`;
  });

  ngOnInit(): void {
    if (this.auth.rol() === Rol.SUPERADMIN) return;
    // Si falla, simplemente no hay aviso: el backend igual frena lo que corresponda.
    this.abono.refrescar().catch(() => undefined);
  }
}
