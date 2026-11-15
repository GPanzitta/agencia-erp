import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

/**
 * Interfaz estándar para los eventos recibidos por WebSocket.
 *
 * Ejemplo: { type: 'order', message: 'newOrder', data: { id: '...', numero_venta: 'VTA-2026-0001' } }
 */
export interface SocketEvent<T = any> {
  type: string;
  message: string;
  data?: T;
}

/**
 * Servicio centralizado para la comunicación por WebSocket con el backend.
 *
 * Uso:
 *   // En un componente:
 *   this.socketService.connect();
 *   this.socketService.on<SocketEvent>('events')
 *     .pipe(filter(e => e.type === 'order'))
 *     .subscribe(event => { ... });
 */
@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket;
  private connected = false;

  constructor() {
    const wsUrl = (environment as any).wsUrl || environment.apiUrl.replace('/api', '');
    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });

    // Logs de debug para conexión
    this.socket.on('connect', () => {
      console.log('[SocketService] ✅ Connected:', this.socket.id);
      this.connected = true;
      this.joinCompanyRoom();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[SocketService] ❌ Disconnected:', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.warn('[SocketService] ⚠️ Connection error:', error.message);
    });

    // Reconexión automática: al reconectar, volver a unirse al room
    this.socket.on('reconnect', () => {
      console.log('[SocketService] 🔄 Reconnected');
      this.joinCompanyRoom();
    });
  }

  /**
   * Conecta al WebSocket enviando el token JWT para autenticación.
   */
  connect(): void {
    if (this.socket.connected) return;

    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('[SocketService] No token found, cannot connect');
      return;
    }

    // Configurar auth con el token
    this.socket.auth = { token };
    this.socket.connect();
  }

  /**
   * Retorna un Observable que emite cada vez que llega un evento con el nombre dado.
   *
   * Ejemplo:
   *   socketService.on<SocketEvent>('events')
   *     .pipe(filter(e => e.type === 'order' && e.message === 'newOrder'))
   *     .subscribe(event => this.loadOrders());
   */
  on<T = any>(event: string): Observable<T> {
    return new Observable<T>((observer) => {
      const handler = (data: T) => observer.next(data);
      this.socket.on(event, handler);
      return () => {
        this.socket.off(event, handler);
      };
    });
  }

  /**
   * Desconecta el socket.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }

  /**
   * ¿Está conectado?
   */
  isConnected(): boolean {
    return this.connected;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  /**
   * Une al cliente al room de su empresa (company:xxx).
   */
  private joinCompanyRoom(): void {
    const companyId = this.getCompanyIdFromToken();
    if (companyId) {
      this.socket.emit('joinCompany', companyId);
      console.log('[SocketService] Joined room company:', companyId);
    }
  }

  /**
   * Decodifica el JWT del localStorage para extraer el companyId.
   */
  private getCompanyIdFromToken(): string | null {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload?.companyId || null;
    } catch {
      return null;
    }
  }
}
