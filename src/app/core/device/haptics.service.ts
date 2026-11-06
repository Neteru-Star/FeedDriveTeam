import { Injectable, InjectionToken, inject } from '@angular/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

type HapticsApi = Pick<typeof Haptics, 'impact' | 'notification'>;

/** Plugin de vibración de Capacitor; se reemplaza en las pruebas. */
export const HAPTICS = new InjectionToken<HapticsApi>('HAPTICS', { providedIn: 'root', factory: () => Haptics });

/** Vibraciones cortas para confirmar acciones. En la web sin soporte simplemente no hace nada. */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly haptics = inject(HAPTICS);

  /** Llegó algo nuevo (por ejemplo, una solicitud). */
  tap(): void {
    void this.haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  }

  success(): void {
    void this.haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
  }

  error(): void {
    void this.haptics.notification({ type: NotificationType.Error }).catch(() => undefined);
  }
}
