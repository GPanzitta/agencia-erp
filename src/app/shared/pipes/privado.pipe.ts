import { Pipe, PipeTransform, inject } from '@angular/core';
import { AuthService } from '../../features/auth/services/auth.service';
import { DatoPersonal, datoParaRol } from '../../core/utils/datos-personales.util';

/**
 * DAT-02: `{{ c.telefono | privado:'telefono' }}`. Completo para mostrador,
 * pañol y admin; tapado para técnico y chofer (ver datos-personales.util).
 * Con tipo null (una coincidencia del buscador que no es dato personal) va
 * tal cual. Lo que ya llega tapado del backend no se vuelve a tapar.
 * Puro: el rol no cambia durante la sesión (al cerrarla se recarga la app).
 */
@Pipe({ name: 'privado', standalone: true })
export class PrivadoPipe implements PipeTransform {
  private auth = inject(AuthService);

  transform(valor: string | null | undefined, tipo: DatoPersonal | null): string {
    if (!tipo) return String(valor ?? '');
    return datoParaRol(valor, tipo, this.auth.rol());
  }
}
