import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { environment } from '../../../../../environments/environment';

type ClavePaso = 'datos' | 'legales' | 'logo' | 'caja_dolares' | 'unidad' | 'publicada' | 'empleados';
interface Paso { clave: ClavePaso; hecho: boolean }

// Agencia (12/11/2026): los pasos de una agencia que recién se da de alta.
const TEXTOS: Record<ClavePaso, { titulo: string; ruta: string }> = {
  datos: { titulo: 'Completá el teléfono y la dirección de la agencia: salen en tu sitio', ruta: '/home/configuracion/empresa' },
  legales: { titulo: 'Cargá el CUIT y la razón social para el boleto y los recibos', ruta: '/home/configuracion/empresa' },
  logo: { titulo: 'Subí tu logo', ruta: '/home/configuracion/sitio-web' },
  caja_dolares: { titulo: 'Creá una caja en dólares para anotar las señas y los pagos', ruta: '/home/configuracion/wallets' },
  unidad: { titulo: 'Cargá tu primer auto', ruta: '/home/autos/nueva' },
  publicada: { titulo: 'Publicá un auto en tu sitio', ruta: '/home/autos' },
  empleados: { titulo: 'Sumá a tus vendedores', ruta: '/home/configuracion/empleados' },
};

/** Qué le falta configurar a un taller nuevo (spec 2026-10-28 §6). Se tilda solo al volver. */
@Component({
  selector: 'app-primeros-pasos',
  standalone: false,
  templateUrl: './primeros-pasos.component.html',
  styleUrl: './primeros-pasos.component.scss',
})
export class PrimerosPasosComponent implements OnInit {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/companies/primeros-pasos`;

  readonly textos = TEXTOS;
  pasos = signal<Paso[]>([]);
  cerrado = signal(true);
  faltan = computed(() => this.pasos().filter((p) => !p.hecho).length);
  visible = computed(() => !this.cerrado() && this.faltan() > 0);

  ngOnInit(): void {
    this.http.get<{ cerrado: boolean; pasos: Paso[] }>(this.url).subscribe({
      next: (r) => {
        this.pasos.set(r.pasos);
        this.cerrado.set(r.cerrado);
      },
      error: () => this.cerrado.set(true),
    });
  }

  alAbrir(clave: ClavePaso): void {
    // En la agencia ningún paso se marca a mano: todos se tildan solos con lo que se carga.
    void clave;
  }

  porClave(_: number, p: Paso): string {
    return p.clave;
  }

  ocultar(): void {
    this.cerrado.set(true);
    this.http.patch(this.url, { cerrado: true }).subscribe();
  }
}
