import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error';
import { ToastService } from '@shared/ui/toast/toast.service';

import { ClientApi } from './client.api';
import type { RatingPayload, TripPage, TripRecord } from './client.models';
import { RatedTripsStorage, type RatedTrips } from './rated-trips.storage';
import { TripHistoryStore } from './trip-history.store';

const trip = (id: number, status: TripRecord['status'] = 'completed'): TripRecord => ({
  id,
  status,
  final_fare: 9300,
  completed_at: '2026-10-20T19:00:00.000000Z',
  driver: { user: { name: 'Carlos Rodríguez' } },
  vehicle: { plate: 'UBR-123' },
});

/** API falsa con funciones normales (un vi.fn con promesa rechazada hace fallar la prueba aunque se atrape). */
class FakeApi {
  pages: TripPage[] = [];
  pageError: unknown = null;
  rateError: unknown = null;
  readonly requested: number[] = [];
  readonly ratings: { id: number; payload: RatingPayload }[] = [];

  trips = async (page: number): Promise<TripPage> => {
    this.requested.push(page);
    if (this.pageError) throw this.pageError;
    return this.pages[page - 1] ?? { items: [], page, hasMore: false };
  };
  rate = async (id: number, payload: RatingPayload) => {
    if (this.rateError) throw this.rateError;
    this.ratings.push({ id, payload });
    return {
      message: 'Calificación enviada exitosamente.',
      rating: { id: 1, trip_id: id, score: payload.score, comment: payload.comment ?? null },
    };
  };
}

describe('TripHistoryStore', () => {
  let api: FakeApi;
  let saved: RatedTrips;
  const toast = { info: vi.fn(), success: vi.fn(), error: vi.fn() };

  function setup(): TripHistoryStore {
    TestBed.configureTestingModule({
      providers: [
        TripHistoryStore,
        { provide: ClientApi, useValue: api },
        { provide: ToastService, useValue: toast },
        {
          provide: RatedTripsStorage,
          useValue: { load: async () => saved, save: async (r: RatedTrips) => void (saved = r) },
        },
      ],
    });
    return TestBed.inject(TripHistoryStore);
  }

  beforeEach(() => {
    api = new FakeApi();
    saved = {};
    vi.clearAllMocks();
  });

  it('loads the first page and appends the next ones until there are no more', async () => {
    api.pages = [
      { items: [trip(5), trip(4)], page: 1, hasMore: true },
      { items: [trip(4), trip(3)], page: 2, hasMore: false },
    ];
    const store = setup();

    await store.ensureLoaded();
    await store.loadMore();
    await store.loadMore();

    // El viaje 4 se repite entre páginas (llegó uno nuevo): no se duplica.
    expect(store.trips().map((t) => t.id)).toEqual([5, 4, 3]);
    expect(store.hasMore()).toBe(false);
    expect(api.requested).toEqual([1, 2]);
  });

  it('shows the empty state when the passenger has no trips', async () => {
    const store = setup();

    await store.ensureLoaded();

    expect(store.empty()).toBe(true);
  });

  it('shows an error only when there is nothing to show', async () => {
    api.pageError = new ApiError(0, 'offline');
    const store = setup();
    await store.refresh();
    expect(store.status()).toBe('error');

    api.pageError = null;
    api.pages = [{ items: [trip(1)], page: 1, hasMore: false }];
    await store.refresh();
    api.pageError = new ApiError(0, 'Sin conexión');
    await store.refresh();

    expect(store.status()).toBe('ready');
    expect(store.trips()).toHaveLength(1);
    expect(toast.error).toHaveBeenCalledWith('Sin conexión');
  });

  it('rates a completed trip once and remembers it on the phone', async () => {
    api.pages = [{ items: [trip(7)], page: 1, hasMore: false }];
    const store = setup();
    await store.ensureLoaded();
    expect(store.canRate(store.find(7)!)).toBe(true);

    expect(await store.rate(7, { score: 4, comment: '  Muy amable  ', has_incident: false })).toBe('ok');

    expect(api.ratings).toEqual([{ id: 7, payload: { score: 4, comment: 'Muy amable', has_incident: false } }]);
    expect(store.canRate(store.find(7)!)).toBe(false);
    expect(store.ratingOf(store.find(7)!)).toBe(4);
    expect(saved).toEqual({ 7: 4 });
  });

  it('does not send an empty comment', async () => {
    const store = setup();

    await store.rate(7, { score: 5, comment: '   ', has_incident: true });

    expect(api.ratings[0].payload).toEqual({ score: 5, has_incident: true });
  });

  it('stops offering to rate when the backend says it was already rated', async () => {
    api.rateError = new ApiError(400, 'Este viaje ya fue calificado.');
    api.pages = [{ items: [trip(7)], page: 1, hasMore: false }];
    const store = setup();
    await store.ensureLoaded();

    expect(await store.rate(7, { score: 5, has_incident: false })).toBe('already-rated');

    expect(store.canRate(store.find(7)!)).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Este viaje ya fue calificado.');
  });

  it('explains why an unfinished trip cannot be rated', async () => {
    api.rateError = new ApiError(400, 'Solo puede calificar viajes finalizados.');
    const store = setup();

    expect(await store.rate(7, { score: 5, has_incident: false })).toBe('failed');

    expect(toast.error).toHaveBeenCalledWith('Solo puede calificar viajes finalizados.');
    expect(store.canRate(trip(7, 'cancelled'))).toBe(false);
  });

  it('uses the rating sent by the backend or the one saved on the phone', async () => {
    saved = { 8: 3 };
    api.pages = [{ items: [{ ...trip(9), rating: { score: 5, comment: null } }, trip(8)], page: 1, hasMore: false }];
    const store = setup();

    await store.ensureLoaded();

    expect(store.ratingOf(store.find(9)!)).toBe(5);
    expect(store.ratingOf(store.find(8)!)).toBe(3);
  });
});
