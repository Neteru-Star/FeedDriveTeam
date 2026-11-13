import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { AuthStore } from '@core/auth/auth.store';

import type { RideRequest } from './client.models';

const KEY = 'feeddrive.activeRide';

/**
 * Guarda la solicitud en curso en el teléfono. `GET /client/active` no devuelve el origen ni el destino
 * de un viaje asignado, así que sin esto la ruta se perdería al recargar la app.
 */
@Injectable({ providedIn: 'root' })
export class ActiveRideStorage {
  private readonly auth = inject(AuthStore);

  /** Una por pasajero: dos pasajeros en pestañas distintas del mismo navegador no comparten su viaje. */
  private get key(): string {
    return `${KEY}.${this.auth.user()?.id ?? 'anon'}`;
  }

  async load(): Promise<RideRequest | null> {
    const { value } = await Preferences.get({ key: this.key });
    if (!value) return null;
    try {
      return JSON.parse(value) as RideRequest;
    } catch {
      return null;
    }
  }

  save(request: RideRequest): Promise<void> {
    return Preferences.set({ key: this.key, value: JSON.stringify(request) });
  }

  clear(): Promise<void> {
    return Preferences.remove({ key: this.key });
  }
}
