import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../auth/services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
  routes = [
    { name: 'Inicio', path: '/admin/inicio', icon: 'home' },
    { name: 'Empresas', path: '/admin/empresas', icon: 'business' },
    { name: 'Talleres y abono', path: '/admin/plataforma', icon: 'payments' }
  ];

  constructor(private authService: AuthService) {}

  logout() {
    this.authService.logout();
  }
}
