import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import type { RideRequest } from './client.models';

const KEY = 'feeddrive.activeRide';

/**
 * Guarda la solicitud en curso en el teléfono. `GET /client/active` no devuelve el origen ni el destino
 * de un viaje asignado, así que sin esto la ruta se perdería al recargar la app.
 */
@Injectable({ providedIn: 'root' })
export class ActiveRideStorage {
  async load(): Promise<RideRequest | null> {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return null;
    try {
      return JSON.parse(value) as RideRequest;
    } catch {
      return null;
    }
  }

  save(request: RideRequest): Promise<void> {
    return Preferences.set({ key: KEY, value: JSON.stringify(request) });
  }

  clear(): Promise<void> {
    return Preferences.remove({ key: KEY });
  }
}
