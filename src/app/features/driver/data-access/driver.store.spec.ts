import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from '@core/auth/auth.store';
import { APP_CONFIG } from '@core/config/app-config';
import { HapticsService } from '@core/device/haptics.service';
import { ApiError } from '@core/http/api-error';
import { LocationService } from '@core/location/location.service';
import { ToastService } from '@shared/ui/toast/toast.service';

import { DriverSessionStorage, type DriverSession } from './driver-session.storage';
import { DriverApi } from './driver.api';
import type { AcceptedTrip, Availability, DriverRideRequest } from './driver.models';
import { DriverStore, TAKEN_FEEDBACK_MS } from './driver.store';
import { LocationReporter } from './location-reporter';

const POLL_MS = 5000;
const PARQUE_93 = { lat: 4.6766, lng: -74.0483 };
const request = (id: number, lat?: number): DriverRideRequest => ({
  id,
  origin_name: `Origen ${id}`,
  destination_name: `Destino ${id}`,
  estimated_distance_km: 2.4,
  estimated_fare: 9000,
  client: { name: 'Laura Gómez', phone: '3001234567' },
  ...(lat === undefined ? {} : { origin_latitude: lat, origin_longitude: -74.0483 }),
});
const trip: AcceptedTrip = {
  id: 30,
  request_id: 2,
  client_id: 5,
  driver_id: 1,
  status: 'assigned',
  estimated_fare: 9000,
};

/** API falsa con funciones normales (un vi.fn con promesa rechazada hace fallar la prueba aunque se atrape). */
class FakeApi {
  requests: DriverRideRequest[] = [];
  listError: unknown = null;
  availabilityError: unknown = null;
  acceptError: unknown = null;
  readonly availability: Availability[] = [];

  rideRequests = async () => {
    if (this.listError) throw this.listError;
    return this.requests;
  };
  setAvailability = async (status: Availability) => {
    if (this.availabilityError) throw this.availabilityError;
    this.availability.push(status);
    return status;
  };
  accept = async () => {
    if (this.acceptError) throw this.acceptError;
    return trip;
  };
  sendLocation = async () => ({});
}

describe('DriverStore', () => {
  let api: FakeApi;
  let session: DriverSession;
  const position = signal<{ lat: number; lng: number } | null>(null);
  const toast = { info: vi.fn(), success: vi.fn(), error: vi.fn() };
  const haptics = { tap: vi.fn(), success: vi.fn(), error: vi.fn() };
  const reporter = { start: vi.fn(), stop: vi.fn(async () => undefined), setTrip: vi.fn() };
  let locates = true;
  let logoutHook: () => Promise<unknown> = async () => undefined;

  function setup(): DriverStore {
    TestBed.configureTestingModule({
      providers: [
        DriverStore,
        { provide: DriverApi, useValue: api },
        {
          provide: AuthStore,
          useValue: { beforeLogout: (hook: () => Promise<unknown>) => ((logoutHook = hook), () => undefined) },
        },
        { provide: LocationReporter, useValue: reporter },
        { provide: HapticsService, useValue: haptics },
        { provide: ToastService, useValue: toast },
        { provide: APP_CONFIG, useValue: { pollIntervalMs: POLL_MS } },
        {
          provide: LocationService,
          useValue: {
            position,
            locate: async () => (locates ? (position.set(PARQUE_93), PARQUE_93) : null),
          },
        },
        {
          provide: DriverSessionStorage,
          useValue: { load: async () => session, save: async (s: DriverSession) => void (session = s) },
        },
      ],
    });
    return TestBed.inject(DriverStore);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    api = new FakeApi();
    session = { online: false, assigned: null };
    position.set(null);
    locates = true;
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it('shows the account review when the backend answers 403 with the approval status', async () => {
    api.listError = new ApiError(
      403,
      'Su cuenta de conductor aún no ha sido aprobada.',
      {},
      { approval_status: 'pending' },
    );
    const store = setup();

    await store.init();

    expect(store.mode()).toBe('review');
    expect(store.approval()).toBe('pending');
  });

  it('starts offline, goes online, reports the GPS and lists the nearest requests first', async () => {
    api.requests = [request(1, 4.7), request(2, 4.68), request(3)];
    const store = setup();
    await store.init();
    expect(store.mode()).toBe('offline');

    expect(await store.goOnline()).toBe('ok');

    expect(store.mode()).toBe('online');
    expect(api.availability).toEqual(['available']);
    expect(reporter.start).toHaveBeenCalled();
    expect(session.online).toBe(true);
    // 2 está a ~400 m, 1 a ~2,6 km y 3 no trae coordenadas.
    expect(store.requests().map((r) => r.id)).toEqual([2, 1, 3]);
    expect(store.requests()[0].pickupKm).toBeCloseTo(0.37, 1);
  });

  it('does not go online without the location', async () => {
    locates = false;
    const store = setup();
    await store.init();

    expect(await store.goOnline()).toBe('no-location');
    expect(api.availability).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith('Activa tu ubicación para recibir viajes.');
  });

  it('goes back online by itself if it was online when the app closed', async () => {
    session = { online: true, assigned: null };
    const store = setup();

    await store.init();

    expect(store.mode()).toBe('online');
  });

  it('announces new requests while polling and stops polling when offline', async () => {
    const store = setup();
    await store.init();
    await store.goOnline();

    api.requests = [request(7, 4.68)];
    await vi.advanceTimersByTimeAsync(POLL_MS);

    expect(store.requests().map((r) => r.id)).toEqual([7]);
    expect(store.announcement()).toBe('Nueva solicitud: de Origen 7 a Destino 7.');
    expect(haptics.tap).toHaveBeenCalledTimes(1);

    await store.goOffline();
    api.requests = [request(7), request(8)];
    await vi.advanceTimersByTimeAsync(POLL_MS * 2);

    expect(store.mode()).toBe('offline');
    expect(store.requests()).toEqual([]);
    expect(api.availability).toEqual(['available', 'unavailable']);
    expect(reporter.stop).toHaveBeenCalled();
  });

  it('accepts a request and keeps the trip on the phone', async () => {
    api.requests = [request(2, 4.68)];
    const store = setup();
    await store.init();
    await store.goOnline();

    await store.accept(store.requests()[0]);

    expect(store.mode()).toBe('assigned');
    expect(store.assigned()?.trip.id).toBe(30);
    expect(session.assigned?.request.origin_name).toBe('Origen 2');
    expect(session.assigned?.request).not.toHaveProperty('pickupKm');
    expect(haptics.success).toHaveBeenCalled();
    expect(reporter.setTrip).toHaveBeenLastCalledWith(30);
  });

  it('marks a request taken by another driver (409) and then removes it', async () => {
    api.requests = [request(2, 4.68), request(3, 4.69)];
    api.acceptError = new ApiError(409, 'Lo sentimos, este servicio ya fue tomado por otro conductor o fue cancelado.');
    const store = setup();
    await store.init();
    await store.goOnline();

    await store.accept(store.requests()[0]);

    expect(store.mode()).toBe('online');
    expect(store.taken().has(2)).toBe(true);
    expect(haptics.error).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Otro conductor tomó este viaje primero.');

    api.requests = [request(3, 4.69)];
    await vi.advanceTimersByTimeAsync(TAKEN_FEEDBACK_MS);
    expect(store.requests().map((r) => r.id)).toEqual([3]);
    expect(store.taken().size).toBe(0);
  });

  it('hides a rejected request only on this phone', async () => {
    api.requests = [request(2), request(3)];
    const store = setup();
    await store.init();
    await store.goOnline();

    store.reject(3);
    await vi.advanceTimersByTimeAsync(POLL_MS);

    expect(store.requests().map((r) => r.id)).toEqual([2]);
    expect(session.hidden).toEqual([3]);
  });

  it('moves to the account review if the account is suspended while online', async () => {
    const store = setup();
    await store.init();
    await store.goOnline();

    api.listError = new ApiError(403, 'Suspendido', {}, { approval_status: 'suspended' });
    await vi.advanceTimersByTimeAsync(POLL_MS);

    expect(store.mode()).toBe('review');
    expect(store.approval()).toBe('suspended');
    expect(session.online).toBe(false);
  });

  it('resumes the assigned trip after reopening the app', async () => {
    session = { online: true, assigned: { trip, request: request(2) } };
    const store = setup();

    await store.init();

    expect(store.mode()).toBe('assigned');
    expect(reporter.setTrip).toHaveBeenCalledWith(30);
  });

  it('goes offline before logging out and does not reconnect by itself afterwards', async () => {
    const store = setup();
    await store.init();
    await store.goOnline();

    await logoutHook();

    expect(api.availability).toEqual(['available', 'unavailable']);
    expect(session.online).toBe(false);
  });

  it('goes offline on logout even if the app was reopened on another screen', async () => {
    session = { online: true, assigned: null };
    setup();

    await logoutHook();

    expect(api.availability).toEqual(['unavailable']);
  });
});
