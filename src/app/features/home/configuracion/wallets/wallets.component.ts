import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { WalletsService, Wallet, MovimientoBilletera } from '../services/wallets.service';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-wallets',
  templateUrl: './wallets.component.html',
  styleUrls: ['./wallets.component.scss']
})
export class WalletsComponent implements OnInit {
  private walletsService = inject(WalletsService);
  private notification = inject(NotificationService);
  private fb = inject(FormBuilder);

  wallets = signal<Wallet[]>([]);
  isLoading = signal(false);
  isSubmitting = signal(false);

  showModal = signal(false);
  editingId = signal<string | null>(null);
  isEditing = computed(() => this.editingId() !== null);
  walletForm: FormGroup;

  /** Billetera pendiente de confirmación de borrado (abre el modal propio). */
  confirmandoBaja = signal<Wallet | null>(null);

  /** Acordeón del libro: id de la billetera con los movimientos desplegados. */
  movimientosAbiertos = signal<string | null>(null);
  movimientos = signal<MovimientoBilletera[]>([]);
  cargandoMovimientos = signal(false);

  constructor() {
    this.walletForm = this.fb.group({
      name: ['', Validators.required],
      type: ['cash', Validators.required],
      moneda: ['ARS', Validators.required],
    });
  }

  ngOnInit() {
    this.loadWallets();
  }

  loadWallets() {
    this.isLoading.set(true);
    this.walletsService.getWallets().subscribe({
      next: (data) => {
        this.wallets.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading wallets', err);
        this.isLoading.set(false);
      }
    });
  }

  openModal(wallet?: Wallet) {
    if (wallet) {
      this.editingId.set(wallet.id || null);
      this.walletForm.patchValue({
        name: wallet.name,
        type: wallet.type || 'cash',
        moneda: wallet.moneda || 'ARS',
      });
    } else {
      this.editingId.set(null);
      this.walletForm.reset({ type: 'cash', moneda: 'ARS' });
    }
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId.set(null);
  }

  saveWallet() {
    if (this.walletForm.invalid) return;
    this.isSubmitting.set(true);
    const val = this.walletForm.value;

    const req$ = this.editingId()
      ? this.walletsService.updateWallet(this.editingId()!, val)
      : this.walletsService.createWallet(val);

    req$.subscribe({
      next: () => {
        this.notification.success(this.editingId() ? 'Billetera actualizada' : 'Billetera creada');
        this.loadWallets();
        this.closeModal();
        this.isSubmitting.set(false);
      },
      error: () => {
        this.isSubmitting.set(false);
      }
    });
  }

  pedirBaja(wallet: Wallet) {
    this.confirmandoBaja.set(wallet);
  }

  cancelarBaja() {
    this.confirmandoBaja.set(null);
  }

  confirmarBaja() {
    const wallet = this.confirmandoBaja();
    if (!wallet?.id) return;
    this.walletsService.deleteWallet(wallet.id).subscribe({
      next: () => {
        this.notification.success('Billetera eliminada');
        this.confirmandoBaja.set(null);
        this.loadWallets();
      },
      error: () => {
        this.confirmandoBaja.set(null);
      }
    });
  }

  toggleActive(wallet: Wallet) {
    if (!wallet.id) return;
    this.walletsService.updateWallet(wallet.id, { is_active: !wallet.is_active }).subscribe({
      next: () => this.loadWallets(),
      // El aviso lo da el interceptor, con el mensaje traducido.
      error: () => {}
    });
  }

  /** Despliega o cierra el libro de la billetera bajo su fila. */
  toggleMovimientos(wallet: Wallet) {
    if (!wallet.id) return;
    if (this.movimientosAbiertos() === wallet.id) {
      this.movimientosAbiertos.set(null);
      return;
    }
    this.movimientosAbiertos.set(wallet.id);
    this.movimientos.set([]);
    this.cargandoMovimientos.set(true);
    this.walletsService.movimientos(wallet.id, 20).subscribe({
      next: (data) => {
        this.movimientos.set(data);
        this.cargandoMovimientos.set(false);
      },
      error: () => {
        this.cargandoMovimientos.set(false);
        this.movimientosAbiertos.set(null);
      }
    });
  }

  montoConSigno(mv: MovimientoBilletera): number {
    const monto = Number(mv.monto) || 0;
    return mv.signo === 'egreso' ? -monto : monto;
  }
}
