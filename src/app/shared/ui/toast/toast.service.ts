import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular/toast-controller';

type ToastKind = 'success' | 'error' | 'info';

/** Avisos breves en la parte superior. Los errores duran más porque suelen pedir una acción. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toasts = inject(ToastController);

  success(message: string): Promise<void> {
    return this.show(message, 'success');
  }

  error(message: string): Promise<void> {
    return this.show(message, 'error');
  }

  info(message: string): Promise<void> {
    return this.show(message, 'info');
  }

  private async show(message: string, kind: ToastKind): Promise<void> {
    const toast = await this.toasts.create({
      message,
      duration: kind === 'error' ? 4500 : 2500,
      position: 'top',
      cssClass: ['app-toast', `app-toast--${kind}`],
      buttons: [{ text: 'Cerrar', role: 'cancel' }],
    });
    await toast.present();
  }
}
