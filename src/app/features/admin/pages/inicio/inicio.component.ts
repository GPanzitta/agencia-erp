import { Component } from '@angular/core';

@Component({
  selector: 'app-inicio',
  standalone: true,
  template: `
    <div class="inicio-container">
      <h1>Bienvenido al Panel de Super Admin</h1>
      <p>Desde aquí podrás gestionar las empresas y su configuración inicial de manera segura.</p>
    </div>
  `,
  styles: [`
    .inicio-container {
      background: #fff;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      
      h1 { margin-top: 0; color: #2d3436; }
      p { color: #636e72; }
    }
  `]
})
export class InicioComponent {}
