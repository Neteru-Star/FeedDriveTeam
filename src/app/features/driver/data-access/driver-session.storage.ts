import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { AuthStore } from '@core/auth/auth.store';

import type { AssignedTrip } from './driver.models';

const KEY = 'feeddrive.driverSession';

/**
 * Estado del conductor que el backend no permite consultar: si estaba en línea y su viaje asignado.
 * Se guarda en el teléfono para retomarlo al volver a abrir la app.
 */
export interface DriverSession {
  online: boolean;
  assigned: AssignedTrip | null;
  /** Solicitudes que el conductor rechazó (el backend no tiene "rechazar"). */
  hidden?: number[];
}

const EMPTY: DriverSession = { online: false, assigned: null, hidden: [] };

@Injectable({ providedIn: 'root' })
export class DriverSessionStorage {
  private readonly auth = inject(AuthStore);

  /** Una sesión por conductor: otro conductor en el mismo teléfono no hereda el estado. */
  private get key(): string {
    return `${KEY}.${this.auth.user()?.id ?? 'anon'}`;
  }

  async load(): Promise<DriverSession> {
    const { value } = await Preferences.get({ key: this.key });
    try {
      return value ? { ...EMPTY, ...(JSON.parse(value) as Partial<DriverSession>) } : EMPTY;
    } catch {
      return EMPTY;
    }
  }

  save(session: DriverSession): Promise<void> {
    return Preferences.set({ key: this.key, value: JSON.stringify(session) });
  }

  clear(): Promise<void> {
    return Preferences.remove({ key: this.key });
  }
}
