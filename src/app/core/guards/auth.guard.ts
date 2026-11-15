import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../features/auth/services/auth.service';
import { AuthStatus } from '../interfaces/auth.interface';

/**
 * Deja pasar solo con una sesión que el backend haya confirmado.
 *
 * Antes alcanzaba con que existiera la clave `token` en localStorage, sin
 * mirar siquiera si estaba vencida: un token viejo, revocado o escrito a mano
 * abría la aplicación entera, que recién se rompía cuando el primer request
 * volvía 401. Ahora la sesión se valida contra /auth/me.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.authStatus() === AuthStatus.checking) {
    await firstValueFrom(auth.checkAuthStatus());
  }

  if (auth.authStatus() === AuthStatus.authenticated) {
    // SEG-54: con la clave provisoria del reseteo, la pantalla de cambio va
    // antes que cualquier otra (el backend igual responde 403 al resto).
    if (auth.debeCambiarClave() && !String(state?.url ?? '').startsWith('/cambiar-clave')) {
      router.navigate(['/cambiar-clave']);
      return false;
    }
    return true;
  }

  router.navigate(['/auth/login']);
  return false;
};

export const unauthGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.authStatus() === AuthStatus.checking) {
    await firstValueFrom(auth.checkAuthStatus());
  }

  if (auth.authStatus() === AuthStatus.authenticated) {
    router.navigate(['/home']);
    return false;
  }
  return true;
};
