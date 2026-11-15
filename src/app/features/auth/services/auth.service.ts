import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  AuthResponse,
  AuthStatus,
  ClaveReseteada,
  Empleado,
  Rol,
  User,
} from '../../../core/interfaces/auth.interface';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { SIN_AVISO_DE_ERROR } from '../../../core/interceptors/sin-aviso.token';
import { SocketService } from '../../../core/services/socket.service';
import { RecargaService, vaciarAlmacenamiento } from '../../../core/services/recarga.service';
import { olvidarUltimaActividad } from '../../../core/utils/actividad.util';

/**
 * Un login que la pantalla tiene que explicar ella misma, porque el
 * interceptor no avisó:
 * - `sesion_rechazada`: el login anduvo pero `/auth/me` no confirma la sesión;
 *   el usuario está dado de baja o le revocaron el acceso (CLI-04). Antes salía
 *   «Bienvenido» y después un bucle de «Tu sesión venció».
 * - `sin_aviso`: falló el primer intento, que va callado porque podía haber
 *   un segundo (CLI-17), y no hubo segundo.
 */
export class FalloDeLogin extends Error {
  constructor(
    readonly tipo: 'sesion_rechazada' | 'sin_aviso',
    readonly original: unknown,
  ) {
    super(tipo);
  }
}

/** El correo como lo guarda el backend desde CLI-17: sin espacios y en minúsculas. */
export function normalizarEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

const SIN_AVISO = () => ({ context: new HttpContext().set(SIN_AVISO_DE_ERROR, true) });

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  readonly http = inject(HttpClient);
  readonly #socket = inject(SocketService);
  readonly #recarga = inject(RecargaService);
  readonly #URL_API = environment.apiUrl + '/auth';

  private _currentUser = signal<User | null>(null);
  private _authStatus = signal<AuthStatus>(AuthStatus.checking);

  public currentUser = computed(() => this._currentUser());
  public authStatus = computed(() => this._authStatus());
  /** Rol del usuario logueado, para adaptar la interfaz al perfil. */
  public rol = computed(() => this._currentUser()?.rol ?? null);
  /** SEG-54: con la clave provisoria del reseteo, el ERP sólo deja la pantalla de cambio. */
  public debeCambiarClave = computed(() => this._currentUser()?.debe_cambiar_clave === true);

  constructor() {
    this.checkAuthStatus().subscribe();
  }

  private setAuthentication(res: AuthResponse): boolean {
    this._currentUser.set({
      id: res.id,
      email: res.email,
      nombre: res.nombre,
      rol: res.rol,
      companyId: res.companyId,
      debe_cambiar_clave: res.debe_cambiar_clave === true,
    });
    this._authStatus.set(AuthStatus.authenticated);
    localStorage.setItem('token', res.token);
    return true;
  }

  /**
   * CLI-17: el correo viaja en minúsculas y sin espacios. Si el que se tipeó
   * tenía mayúsculas y el backend todavía compara exacto (un usuario viejo
   * guardado como «Padri@…»), se reintenta una vez como se escribió; el primer
   * intento va sin aviso para no mostrar un «incorrecto» que no es.
   *
   * CLI-04: con el token en mano se confirma la sesión contra `/auth/me` antes
   * de darla por abierta. Si el usuario está dado de baja, el login termina en
   * `FalloDeLogin` y no queda ninguna sesión a medias.
   */
  login(credentials: { email: string; password: string }): Observable<boolean> {
    const escrito = String(credentials?.email ?? '').trim();
    const normalizado = normalizarEmail(escrito);
    const conRespaldo = escrito !== normalizado;
    const intentar = (email: string, avisar: boolean) =>
      this.http.post<AuthResponse>(
        `${this.#URL_API}/login`,
        { ...credentials, email },
        avisar ? {} : SIN_AVISO(),
      );

    return intentar(normalizado, !conRespaldo).pipe(
      catchError((err) => {
        if (!conRespaldo) return throwError(() => err);
        const reintentar = (err as HttpErrorResponse)?.status === 401 && err?.error?.code === 'CREDENCIALES_INVALIDAS';
        return reintentar ? intentar(escrito, true) : throwError(() => new FalloDeLogin('sin_aviso', err));
      }),
      switchMap((res) => this.confirmarSesion(res)),
      catchError((err) => {
        this.limpiarSesion();
        return throwError(() => err);
      }),
    );
  }

  /** Alta pública de un taller (spec 2026-10-28 §6). */
  registrarTaller(datos: {
    taller: string; nombre: string; email: string; telefono: string; clave: string; rubros: string[]; sitio_web?: string;
  }): Observable<{ enviado: boolean }> {
    return this.http.post<{ enviado: boolean }>(`${environment.apiUrl}/alta-taller`, datos);
  }

  /** Sin aviso: la pantalla de confirmación ya explica el link vencido. */
  confirmarCuenta(token: string): Observable<{ confirmada: boolean }> {
    return this.http.post<{ confirmada: boolean }>(`${environment.apiUrl}/alta-taller/confirmar`, { token }, SIN_AVISO());
  }

  reenviarConfirmacion(email: string): Observable<{ enviado: boolean }> {
    return this.http.post<{ enviado: boolean }>(`${environment.apiUrl}/alta-taller/reenviar`, { email });
  }

  pedirRecuperacion(email: string): Observable<{ enviado: boolean }> {
    return this.http.post<{ enviado: boolean }>(`${this.#URL_API}/recuperar`, { email });
  }

  /** Sin aviso: la pantalla ya explica el link vencido. */
  cambiarClavePorCorreo(token: string, clave: string): Observable<{ cambiada: boolean }> {
    return this.http.post<{ cambiada: boolean }>(`${this.#URL_API}/recuperar/cambiar`, { token, clave }, SIN_AVISO());
  }

  /** Con el token del login, `/auth/me` dice si la sesión vale (CLI-04). */
  private confirmarSesion(res: AuthResponse): Observable<boolean> {
    localStorage.setItem('token', res.token);
    return this.http.get<Omit<AuthResponse, 'token'>>(`${this.#URL_API}/me`, SIN_AVISO()).pipe(
      map((perfil) => this.setAuthentication({ ...res, ...perfil, token: res.token })),
      catchError((err) => throwError(() => new FalloDeLogin('sesion_rechazada', err))),
    );
  }

  /**
   * Alta de un empleado. La hace un encargado o superadmin desde el ERP, y NO
   * devuelve token: el usuario que se está creando no es el que está operando.
   * Antes este endpoint era público y autologueaba, que era la vía por la que
   * cualquiera se hacía una cuenta con acceso a los datos de todos los locales.
   */
  crearEmpleado(datos: {
    nombre: string;
    email: string;
    password: string;
    telefono?: string;
    rol: Rol;
  }): Observable<Empleado> {
    return this.http.post<Empleado>(`${this.#URL_API}/register`, { ...datos, email: normalizarEmail(datos.email) });
  }

  listarEmpleados(): Observable<Empleado[]> {
    return this.http.get<Empleado[]>(`${this.#URL_API}/usuarios`);
  }

  /** Cambia el rol de un empleado. El backend revoca sus sesiones vigentes. */
  cambiarRolEmpleado(id: string, rol: string): Observable<Empleado> {
    return this.http.patch<Empleado>(`${this.#URL_API}/usuarios/${id}/rol`, { rol });
  }

  /**
   * SEG-54: «Cambiar mi clave». El backend cierra TODAS las sesiones de la
   * cuenta (también el socket) y devuelve un token nuevo para este equipo:
   * se guarda acá y el que llama recarga la app para reconectar todo limpio.
   */
  cambiarClave(actual: string, nueva: string): Observable<boolean> {
    return this.http
      .post<AuthResponse>(`${this.#URL_API}/cambiar-clave`, { actual, nueva })
      .pipe(map((res) => this.setAuthentication(res)));
  }

  /** SEG-54: el admin le pone una clave provisoria a un empleado; viene una sola vez. */
  resetearClaveEmpleado(id: string): Observable<ClaveReseteada> {
    return this.http.post<ClaveReseteada>(`${this.#URL_API}/usuarios/${id}/resetear-clave`, {});
  }

  cambiarEstadoEmpleado(id: string, activo: boolean): Observable<Empleado> {
    return this.http.patch<Empleado>(`${this.#URL_API}/usuarios/${id}/activo`, { activo });
  }

  /**
   * Valida la sesión contra el servidor y trae el perfil.
   *
   * Antes esto solo miraba si había algo en `localStorage` y daba la sesión por
   * buena: un token vencido, revocado o directamente inventado pasaba igual, y
   * la aplicación entera se dibujaba hasta que el primer request devolvía 401.
   * Ahora la sesión la confirma el backend, que además es de donde sale el rol.
   */
  checkAuthStatus(): Observable<boolean> {
    const token = localStorage.getItem('token');
    if (!token) {
      this.limpiarSesion();
      return of(false);
    }

    return this.http.get<Omit<AuthResponse, 'token'>>(`${this.#URL_API}/me`).pipe(
      map(perfil => this.setAuthentication({ ...perfil, token })),
      catchError(() => {
        // Token vencido, revocado, de un usuario dado de baja o sin rol.
        this.limpiarSesion();
        return of(false);
      })
    );
  }

  /**
   * CLI-04: el backend dijo 401 en medio del trabajo (token vencido, rol
   * cambiado, usuario dado de baja o sesión cerrada en otro equipo). Se limpia
   * la sesión del navegador para que el login deje entrar de nuevo; antes el
   * `unauthGuard` lo rebotaba a /home y quedaba en un bucle de avisos.
   */
  cerrarSesionLocal(): void {
    this.limpiarSesion();
  }

  private limpiarSesion() {
    localStorage.removeItem('token');
    // DAT-05: la actividad de esta sesión no tiene que cerrar la próxima.
    olvidarUltimaActividad();
    // CLI-05: el socket abierto con el token anterior no sigue escuchando.
    this.#socket.disconnect();
    this._currentUser.set(null);
    this._authStatus.set(AuthStatus.notAuthenticated);
  }

  /**
   * Antes esto solo borraba el token del navegador: en el servidor seguía
   * siendo válido hasta que expirara —hasta 5 días—, así que un logout no
   * cerraba nada de verdad. Ahora avisa al backend, que invalida el token con
   * `token_version` antes de limpiar la sesión local.
   *
   * DAT-04: después vacía `localStorage` y `sessionStorage` y recarga la app
   * en el login, para que no quede nada del usuario anterior ni en el
   * navegador ni en memoria (antes se navegaba con el router y las listas ya
   * bajadas seguían en los servicios).
   */
  logout() {
    this.http.post(`${this.#URL_API}/logout`, {}).pipe(
      catchError(() => of(null)) // si ya no había sesión válida, no importa
    ).subscribe(() => {
      this.limpiarSesion();
      vaciarAlmacenamiento();
      this.#recarga.irDeCero('/auth/login');
    });
  }
}
