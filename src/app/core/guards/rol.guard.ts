import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../features/auth/services/auth.service';
import { AuthStatus, Rol } from '../interfaces/auth.interface';

/**
 * Restringe una ruta a ciertos roles.
 *
 *   { path: 'gastos', canActivate: [rolGuard(Rol.ADMIN, Rol.MOSTRADOR)], ... }
 *
 * Esto es UX, no seguridad: quien manda es el backend, que valida rol en cada
 * endpoint. Acá se evita que un cocinero navegue a pantallas que no le
 * corresponden y se encuentre con una interfaz rota a fuerza de 403.
 */
export const rolGuard = (...permitidos: Rol[]): CanActivateFn => {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    // Al recargar la página el perfil todavía no llegó: hay que esperar a que
    // /auth/me resuelva antes de decidir, o el guard rebota a todo el mundo.
    if (auth.authStatus() === AuthStatus.checking) {
      await firstValueFrom(auth.checkAuthStatus());
    }

    if (auth.authStatus() !== AuthStatus.authenticated) {
      router.navigate(['/auth/login']);
      return false;
    }

    const rol = auth.rol();
    // El superadmin entra a todo.
    if (rol === Rol.SUPERADMIN || (rol && permitidos.includes(rol))) return true;

    router.navigate(['/home']);
    return false;
  };
};
