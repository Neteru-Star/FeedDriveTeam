import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '@core/config/app-config';
import { ApiError } from '@core/http/api-error';
import { ToastService } from '@shared/ui/toast/toast.service';

import { ActiveRideStorage } from './active-ride.storage';
import { ActiveRideStore, SEARCH_TIMEOUT_MS } from './active-ride.store';
import { ClientApi } from './client.api';
import type { ActiveTrip, ClientActive, RideRequest } from './client.models';

const POLL_MS = 5000;
const payload = {
  origin_name: 'Parque de la 93',
  origin_latitude: 4.6766,
  origin_longitude: -74.0483,
  destination_name: 'Andino',
  destination_latitude: 4.6664,
  destination_longitude: -74.0536,
};
const request: RideRequest = {
  ...payload,
  id: 7,
  client_id: 2,
  estimated_distance_km: 1.28,
  estimated_duration_min: 4,
  estimated_fare: 6500,
  status: 'requested',
  created_at: new Date().toISOString(),
};
const trip: ActiveTrip = {
  id: 3,
  request_id: 7,
  status: 'assigned',
  estimated_fare: 6500,
  driver: {
    id: 1,
    rating_average: 4.95,
    user: { name: 'Carlos Rodríguez', phone: '3119876543' },
    latest_location: null,
  },
  vehicle: { plate: 'UBR-123', brand: 'Chevrolet', model: 'Onix', color: 'Gris' },
};

/**
 * API falsa con funciones normales: un vi.fn que devuelve una promesa rechazada hace fallar la prueba
 * aunque el código la atrape, así que los errores se programan con `next*`.
 */
class FakeApi {
  active: ClientActive = { has_active: false };
  requestError: ApiError | null = null;
  cancelError: ApiError | null = null;
  readonly cancelled: { id: number; reason: string }[] = [];

  requestRide = async (): Promise<RideRequest> => {
    if (this.requestError) throw this.requestError;
    this.active = { has_active: true, type: 'request', data: request };
    return request;
  };
  activeFare = async () => ({});
  estimate = async () => ({});
  getActive = async (): Promise<ClientActive> => this.active;
  cancel = async (id: number, reason: string): Promise<unknown> => {
    if (this.cancelError) throw this.cancelError;
    this.cancelled.push({ id, reason });
    this.active = { has_active: false };
    return {};
  };
}

describe('ActiveRideStore', () => {
  let api: FakeApi;
  const toast = { info: vi.fn(), success: vi.fn(), error: vi.fn() };
  let saved: RideRequest | null;

  function setup(): ActiveRideStore {
    TestBed.configureTestingModule({
      providers: [
        ActiveRideStore,
        { provide: ClientApi, useValue: { ...api, active: () => api.getActive() } },
        { provide: ToastService, useValue: toast },
        { provide: APP_CONFIG, useValue: { pollIntervalMs: POLL_MS } },
        {
          provide: ActiveRideStorage,
          useValue: {
            load: async () => saved,
            save: async (r: RideRequest) => void (saved = r),
            clear: async () => void (saved = null),
          },
        },
      ],
    });
    return TestBed.inject(ActiveRideStore);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    api = new FakeApi();
    saved = null;
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it('requests a ride, waits in "searching" and shows the driver when the trip is assigned', async () => {
    const store = setup();

    expect(await store.requestRide(payload)).toBe('ok');
    expect(store.state().kind).toBe('searching');
    expect(saved?.id).toBe(7);

    api.active = { has_active: true, type: 'trip', data: trip };
    await vi.advanceTimersByTimeAsync(POLL_MS);

    const state = store.state();
    expect(state.kind).toBe('trip');
    expect(state.kind === 'trip' && state.trip.driver.user.name).toBe('Carlos Rodríguez');
    // La ruta sigue disponible aunque /client/active no traiga el origen ni el destino del viaje.
    expect(store.request()?.origin_name).toBe('Parque de la 93');
  });

  it('cancels the request after 2 minutes without a driver', async () => {
    const store = setup();
    await store.requestRide(payload);

    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS + POLL_MS);

    expect(store.state().kind).toBe('no-drivers');
    expect(api.cancelled).toEqual([{ id: 7, reason: 'Sin conductores disponibles' }]);
    expect(saved).toBeNull();
  });

  it('keeps the trip if a driver accepted just before the 2-minute cancel', async () => {
    // El conductor acepta en el instante en que la app intenta cancelar: el backend rechaza la cancelación.
    api.cancel = async () => {
      api.active = { has_active: true, type: 'trip', data: trip };
      throw new ApiError(400, 'Esta solicitud ya no puede cancelarse.');
    };
    const store = setup();
    await store.requestRide(payload);

    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS + POLL_MS);

    expect(store.state().kind).toBe('trip');
  });

  it('reports the 400 "active trip" so the screen can offer to open it', async () => {
    api.requestError = new ApiError(
      400,
      'Ya cuenta con una solicitud o viaje activo en curso.',
      {},
      { active_request_id: 2 },
    );
    const store = setup();

    expect(await store.requestRide(payload)).toBe('already-active');
    expect(store.state().kind).toBe('idle');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows the validation message of a 422 and stays idle', async () => {
    api.requestError = new ApiError(422, 'El campo origin_name es obligatorio.', {
      origin_name: 'El campo origin_name es obligatorio.',
    });
    const store = setup();

    expect(await store.requestRide(payload)).toBe('failed');
    expect(toast.error).toHaveBeenCalledWith('El campo origin_name es obligatorio.');
  });

  it('resumes an assigned trip after reopening the app', async () => {
    saved = request;
    api.active = { has_active: true, type: 'trip', data: trip };
    const store = setup();

    await store.restore();

    expect(store.state().kind).toBe('trip');
    expect(store.request()?.destination_name).toBe('Andino');
  });

  it('returns to planning and announces it when the trip ends', async () => {
    api.active = { has_active: true, type: 'trip', data: trip };
    const store = setup();
    await store.restore();

    api.active = { has_active: false };
    await vi.advanceTimersByTimeAsync(POLL_MS);

    expect(store.state().kind).toBe('idle');
    expect(toast.success).toHaveBeenCalledWith('Tu viaje terminó.');
  });

  it('lets the passenger cancel while searching', async () => {
    const store = setup();
    await store.requestRide(payload);

    await store.cancelSearch();

    expect(store.state().kind).toBe('idle');
    expect(api.cancelled).toEqual([{ id: 7, reason: 'Cancelado por el pasajero' }]);
  });
});
