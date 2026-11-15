import { HttpContextToken } from '@angular/common/http';

/**
 * Para pedidos que manejan su propio error y no quieren que el
 * `errorInterceptor` les tape la pantalla con un toast — p. ej. `registrarEnvio`
 * en `shared/services/mensajes.service.ts`: WhatsApp ya se abrió, el registro
 * es solo una constancia, y un toast de error ahí solo confundiría.
 *
 * Vive en su propio archivo para que `AuthService` lo use sin importar el
 * interceptor, que a su vez necesita a `AuthService` (CLI-04).
 */
export const SIN_AVISO_DE_ERROR = new HttpContextToken<boolean>(() => false);
