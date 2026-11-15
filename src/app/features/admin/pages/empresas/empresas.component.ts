import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, Company } from '../../services/admin.service';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './empresas.component.html',
  styleUrls: ['./empresas.component.scss']
})
export class EmpresasComponent implements OnInit {
  companies: Company[] = [];
  isLoading = true;
  isCreating = false;
  newCompanyName = '';
  showModal = false;
  successMessage = '';
  createdUsers: any[] = [];
  /**
   * #36: la clave que generó el backend para el admin del taller nuevo. Viaja
   * una sola vez (`clave_inicial`); antes la pantalla decía «user123456», que
   * ya no es la clave de nadie.
   */
  claveInicial: string | null = null;

  private notification = inject(NotificationService);

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.loadCompanies();
  }

  loadCompanies() {
    this.isLoading = true;
    this.adminService.getCompanies().subscribe({
      next: (data) => {
        this.companies = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading companies', err);
        this.isLoading = false;
      }
    });
  }

  openCreateModal() {
    this.showModal = true;
    this.newCompanyName = '';
    this.successMessage = '';
    this.createdUsers = [];
    this.claveInicial = null;
  }

  closeModal() {
    this.showModal = false;
    if (this.successMessage) {
      this.loadCompanies();
    }
  }

  createCompany() {
    if (!this.newCompanyName.trim()) return;
    
    this.isCreating = true;
    this.adminService.setupCompany(this.newCompanyName).subscribe({
      next: (res) => {
        this.isCreating = false;
        this.successMessage = res.message;
        this.createdUsers = res.users;
        this.claveInicial = res.clave_inicial ?? null;
      },
      error: () => {
        this.isCreating = false;
      }
    });
  }
}
