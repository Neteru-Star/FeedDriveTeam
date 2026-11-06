import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiError } from '@core/http/api-error';
import type { MapRoute } from '@shared/ui/map/map.models';

import { ClientApi } from './client.api';
import type { Fare, FareEstimate } from './client.models';

export type QuoteState =
  | { status: 'idle' }
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; estimate: FareEstimate }
  | { status: 'error'; key: string; message: string };

const routeKey = (route: MapRoute): string =>
  [route.from.lat, route.from.lng, route.to.lat, route.to.lng].map((v) => v.toFixed(6)).join(',');

/** Tarifa activa de la plataforma y cotización de la ruta elegida (HU-03). */
@Injectable()
export class FareQuoteStore {
  private readonly api = inject(ClientApi);

  readonly activeFare = signal<Fare | null>(null);
  readonly surge = computed(() => this.activeFare()?.surge_multiplier ?? 1);

  private readonly state = signal<QuoteState>({ status: 'idle' });

  /** Estado de la cotización para una ruta: si la ruta cambió, la cotización anterior ya no vale. */
  quoteFor(route: MapRoute | null): QuoteState {
    const state = this.state();
    if (!route || state.status === 'idle' || state.key !== routeKey(route)) return { status: 'idle' };
    return state;
  }

  async loadActiveFare(): Promise<void> {
    try {
      this.activeFare.set(await this.api.activeFare());
    } catch {
      // Sin la tarifa pública solo se pierde el chip de alta demanda; la cotización la calcula el backend.
    }
  }

  async estimate(route: MapRoute): Promise<void> {
    const key = routeKey(route);
    this.state.set({ status: 'loading', key });
    try {
      const estimate = await this.api.estimate({
        origin_latitude: route.from.lat,
        origin_longitude: route.from.lng,
        destination_latitude: route.to.lat,
        destination_longitude: route.to.lng,
      });
      // Si mientras tanto se pidió otra ruta, esta respuesta llegó tarde y se descarta.
      const current = this.state();
      if (current.status === 'loading' && current.key === key) this.state.set({ status: 'ready', key, estimate });
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 422
          ? 'Revisa el origen y el destino: no son una ubicación válida.'
          : 'Revisa tu conexión e inténtalo de nuevo.';
      this.state.set({ status: 'error', key, message });
    }
  }
}
