import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiError } from '@core/http/api-error';
import { ToastService } from '@shared/ui/toast/toast.service';

import { ClientApi } from './client.api';
import type { RatingPayload, TripRecord } from './client.models';
import { RatedTripsStorage, type RatedTrips } from './rated-trips.storage';

export type HistoryStatus = 'idle' | 'loading' | 'ready' | 'error';
export type RateResult = 'ok' | 'already-rated' | 'failed';

/** Largo máximo del comentario según la validación del backend. */
export const RATING_COMMENT_MAX = 500;

/** Historial de viajes del pasajero (HU-08): páginas de `GET /client/trips` y calificaciones. */
@Injectable()
export class TripHistoryStore {
  private readonly api = inject(ClientApi);
  private readonly storage = inject(RatedTripsStorage);
  private readonly toast = inject(ToastService);

  readonly trips = signal<TripRecord[]>([]);
  readonly status = signal<HistoryStatus>('idle');
  readonly hasMore = signal(true);
  readonly loadingMore = signal(false);
  readonly empty = computed(() => this.status() === 'ready' && this.trips().length === 0);

  private readonly rated = signal<RatedTrips>({});
  private page = 0;
  private ratedLoaded?: Promise<void>;

  /** Carga la primera página si aún no se ha cargado. */
  async ensureLoaded(): Promise<void> {
    if (this.status() === 'idle') await this.refresh();
    else await this.loadRated();
  }

  /** Vuelve a la primera página (al entrar o al deslizar hacia abajo). */
  async refresh(): Promise<void> {
    if (this.trips().length === 0) this.status.set('loading');
    await this.loadRated();
    try {
      const first = await this.api.trips(1);
      this.trips.set(first.items);
      this.page = first.page;
      this.hasMore.set(first.hasMore);
      this.status.set('ready');
    } catch (error) {
      if (this.trips().length === 0) this.status.set('error');
      else void this.toast.error(this.errorMessage(error));
    }
  }

  /** Siguiente página para el scroll infinito. */
  async loadMore(): Promise<void> {
    if (!this.hasMore() || this.loadingMore() || this.status() !== 'ready') return;
    this.loadingMore.set(true);
    try {
      const next = await this.api.trips(this.page + 1);
      const known = new Set(this.trips().map((t) => t.id));
      this.trips.update((list) => [...list, ...next.items.filter((t) => !known.has(t.id))]);
      this.page = next.page;
      this.hasMore.set(next.hasMore && next.items.length > 0);
    } catch (error) {
      void this.toast.error(this.errorMessage(error));
    } finally {
      this.loadingMore.set(false);
    }
  }

  find(id: number): TripRecord | undefined {
    return this.trips().find((t) => t.id === id);
  }

  /** Estrellas con que se calificó el viaje; `0` si está calificado sin saber cuántas; `null` si no. */
  ratingOf(trip: Pick<TripRecord, 'id' | 'rating'>): number | null {
    return trip.rating?.score ?? this.rated()[trip.id] ?? null;
  }

  canRate(trip: Pick<TripRecord, 'id' | 'status' | 'rating'>): boolean {
    return trip.status === 'completed' && this.ratingOf(trip) === null;
  }

  async rate(tripId: number, payload: RatingPayload): Promise<RateResult> {
    const comment = payload.comment?.trim().slice(0, RATING_COMMENT_MAX);
    try {
      const { message, rating } = await this.api.rate(tripId, {
        score: payload.score,
        has_incident: payload.has_incident,
        ...(comment ? { comment } : {}),
      });
      await this.remember(tripId, rating.score);
      this.trips.update((list) =>
        list.map((t) => (t.id === tripId ? { ...t, rating: { score: rating.score, comment: rating.comment } } : t)),
      );
      void this.toast.success(message || '¡Gracias por calificar tu viaje!');
      return 'ok';
    } catch (error) {
      if (error instanceof ApiError && error.status === 400 && /calificad/i.test(error.message)) {
        // Calificado desde otro dispositivo: ya no se ofrece de nuevo.
        await this.remember(tripId, this.rated()[tripId] ?? 0);
        void this.toast.info('Este viaje ya fue calificado.');
        return 'already-rated';
      }
      void this.toast.error(this.errorMessage(error, 'No pudimos enviar tu calificación. Inténtalo de nuevo.'));
      return 'failed';
    }
  }

  private async remember(tripId: number, score: number): Promise<void> {
    this.rated.update((map) => ({ ...map, [tripId]: score }));
    await this.storage.save(this.rated());
  }

  private loadRated(): Promise<void> {
    this.ratedLoaded ??= this.storage.load().then((saved) => this.rated.update((map) => ({ ...saved, ...map })));
    return this.ratedLoaded;
  }

  private errorMessage(error: unknown, fallback = 'No pudimos cargar tus viajes. Revisa tu conexión.'): string {
    return error instanceof ApiError ? error.message : fallback;
  }
}
