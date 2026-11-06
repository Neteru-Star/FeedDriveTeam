import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

const KEY = 'feeddrive.ratedTrips';

/** Calificación conocida de un viaje: las estrellas, o `0` si el backend dijo que ya estaba calificado sin decir cuántas. */
export type RatedTrips = Record<number, number>;

/**
 * Viajes ya calificados. La documentación de `GET /client/trips` no incluye la calificación, así que la app
 * recuerda las que envió para no ofrecer calificar dos veces.
 */
@Injectable({ providedIn: 'root' })
export class RatedTripsStorage {
  async load(): Promise<RatedTrips> {
    const { value } = await Preferences.get({ key: KEY });
    try {
      const parsed: unknown = value ? JSON.parse(value) : {};
      return parsed && typeof parsed === 'object' ? (parsed as RatedTrips) : {};
    } catch {
      return {};
    }
  }

  save(rated: RatedTrips): Promise<void> {
    return Preferences.set({ key: KEY, value: JSON.stringify(rated) });
  }
}
