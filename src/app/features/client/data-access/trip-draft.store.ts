import { Injectable, computed, signal } from '@angular/core';
import type { Place } from '@core/geo/geocoder';
import type { MapRoute } from '@shared/ui/map/map.models';
import { haversineKm, isSamePlace } from '@shared/utils/geo';

export type PointKind = 'origin' | 'destination';

export interface DraftPoint extends Place {
  /** De dónde salió el punto: GPS, búsqueda o selección en el mapa. */
  source: 'gps' | 'search' | 'map';
}

/**
 * Origen y destino que el pasajero está eligiendo (HU-02). Se provee en la ruta del pasajero,
 * así cada sesión empieza limpia. La HU-03 lo usa para estimar la tarifa y pedir el viaje.
 */
@Injectable()
export class TripDraftStore {
  readonly origin = signal<DraftPoint | null>(null);
  readonly destination = signal<DraftPoint | null>(null);

  readonly route = computed<MapRoute | null>(() => {
    const from = this.origin()?.position;
    const to = this.destination()?.position;
    return from && to ? { from, to } : null;
  });
  readonly distanceKm = computed(() => {
    const route = this.route();
    return route ? haversineKm(route.from, route.to) : null;
  });

  /** Fija un extremo. Devuelve false, sin cambiar nada, si coincide con el otro extremo. */
  set(kind: PointKind, point: DraftPoint): boolean {
    const other = kind === 'origin' ? this.destination() : this.origin();
    if (other && isSamePlace(other.position, point.position)) return false;
    this.signalFor(kind).set(point);
    return true;
  }

  /** Actualiza el texto de un punto (por ejemplo, cuando llega la dirección del GPS) sin moverlo. */
  relabel(kind: PointKind, label: string, detail: string): void {
    this.signalFor(kind).update((point) => (point ? { ...point, label, detail } : point));
  }

  clear(kind: PointKind): void {
    this.signalFor(kind).set(null);
  }

  private signalFor(kind: PointKind) {
    return kind === 'origin' ? this.origin : this.destination;
  }
}
