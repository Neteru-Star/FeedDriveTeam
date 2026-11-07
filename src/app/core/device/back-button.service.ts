import { Injectable, InjectionToken, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { IS_NATIVE_PLATFORM } from '@core/location/location.service';
import { NavController } from '@ionic/angular/nav-controller';
import { Platform } from '@ionic/angular/platform';

import { AuthStore } from '../auth/auth.store';

type AppApi = Pick<typeof App, 'minimizeApp'>;

/** Plugin App de Capacitor; se reemplaza en las pruebas. */
export const CAPACITOR_APP = new InjectionToken<AppApi>('CAPACITOR_APP', { providedIn: 'root', factory: () => App });

/** Prioridad menor que la de Ionic: primero cierra menús y modales, y vuelve atrás en la navegación si puede. */
export const FALLBACK_PRIORITY = -1;

/**
 * Botón "atrás" de Android cuando Ionic ya no tiene a dónde volver: desde una sección regresa a la pantalla inicial
 * del rol; desde la inicial (o el login) minimiza la app en lugar de cerrarla, como las apps de transporte.
 */
@Injectable({ providedIn: 'root' })
export class BackButtonService {
  private readonly platform = inject(Platform);
  private readonly router = inject(Router);
  private readonly nav = inject(NavController);
  private readonly auth = inject(AuthStore);
  private readonly app = inject(CAPACITOR_APP);
  private readonly isNative = inject(IS_NATIVE_PLATFORM);

  init(): void {
    if (!this.isNative) return;
    this.platform.backButton.subscribeWithPriority(FALLBACK_PRIORITY, () => void this.handle());
  }

  async handle(): Promise<void> {
    const path = this.router.url.split('?')[0];
    const home = this.auth.home();
    if (home && path !== home && !path.startsWith('/login')) {
      await this.nav.navigateRoot(home, { animationDirection: 'back' });
      return;
    }
    await this.app.minimizeApp();
  }
}
