/** Roles del sistema. Tienen que coincidir con `src/enums/roles.enum.ts` del backend. */
export enum Rol {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  MOSTRADOR = 'mostrador',
  TECNICO = 'tecnico',
  PANOL = 'panol',
  /** T6b — Sale a la calle: retira y entrega equipos, y cobra en la puerta. */
  CHOFER = 'chofer',
}

export interface User {
  id?: string;
  email: string;
  nombre: string;
  telefono?: string;
  /** Rol del usuario logueado. Lo devuelven /auth/login y /auth/me. */
  rol?: Rol | null;
  companyId?: string;
  /** SEG-54: el admin le reseteó la clave; hasta cambiarla, sólo ve la pantalla de cambio. */
  debe_cambiar_clave?: boolean;
}

/** Empleado tal como lo lista GET /auth/usuarios. */
export interface Empleado extends User {
  id: string;
  activo: boolean;
  created_at?: string;
}

export interface AuthResponse {
  id: string;
  nombre: string;
  email: string;
  rol: Rol | null;
  token: string;
  companyId?: string;
  debe_cambiar_clave?: boolean;
}

/** POST /auth/usuarios/:id/resetear-clave (SEG-54): la provisoria viene UNA sola vez. */
export interface ClaveReseteada extends User {
  id: string;
  clave_provisoria: string;
}

export enum AuthStatus {
  checking = 'checking',
  authenticated = 'authenticated',
  notAuthenticated = 'notAuthenticated'
}
