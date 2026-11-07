import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HapticsService } from '@core/device/haptics.service';
import { ApiError } from '@core/http/api-error';
import { LocationService } from '@core/location/location.service';
import { ToastService } from '@shared/ui/toast/toast.service';

import { DriverTripStore } from './driver-trip.store';
import { DriverApi } from './driver.api';
import type { AssignedTrip, CompletedTrip } from './driver.models';
import { DriverStore } from './driver.store';

const PARQUE_93 = { lat: 4.6766, lng: -74.0483 };
const north = (meters: number) => ({ lat: PARQUE_93.lat + meters / 111_195, lng: PARQUE_93.lng });
const assigned: AssignedTrip = {
  trip: { id: 30, request_id: 2, client_id: 5, driver_id: 1, status: 'assigned', estimated_fare: 6500 },
  request: {
    id: 2,
    origin_name: 'Parque de la 93',
    destination_name: 'Andino',
    estimated_distance_km: 1.28,
    estimated_fare: 6500,
    client: { name: 'Laura Gómez', phone: '3001234567' },
  },
};

class FakeApi {
  readonly calls: string[] = [];
  error: unknown = null;
  completeBody: unknown = null;

  advance = async (id: number, action: string) => {
    if (this.error) throw this.error;
    this.calls.push(`${action} ${id}`);
    return {};
  };
  complete = async (id: number, body: { actual_distance_km: number; actual_duration_min: number }) => {
    if (this.error) throw this.error;
    this.calls.push(`complete ${id}`);
    this.completeBody = body;
    const completed: CompletedTrip = {
      id,
      status: 'completed',
      final_fare: 7300,
      distance_travelled_km: body.actual_distance_km,
      duration_travelled_min: body.actual_duration_min,
      completed_at: '2026-11-06T21:33:00Z',
    };
    return completed;
  };
}

/** DriverStore falso: guarda el viaje en un signal como el real. */
function fakeDriver() {
  const trip = signal<AssignedTrip | null>(assigned);
  const events: string[] = [];
  return {
    assigned: trip,
    events,
    updateAssigned: async (next: AssignedTrip) => void trip.set(next),
    showSummary: async () => void (trip.set(null), events.push('summary')),
    releaseTrip: async () => void (trip.set(null), events.push('release')),
  };
}

describe('DriverTripStore', () => {
  let api: FakeApi;
  let driver: ReturnType<typeof fakeDriver>;
  const position = signal<{ lat: number; lng: number } | null>(PARQUE_93);
  const toast = { info: vi.fn(), success: vi.fn(), error: vi.fn() };
  const haptics = { tap: vi.fn(), success: vi.fn(), error: vi.fn() };

  function setup(): DriverTripStore {
    TestBed.configureTestingModule({
      providers: [
        DriverTripStore,
        { provide: DriverApi, useValue: api },
        { provide: DriverStore, useValue: driver },
        { provide: LocationService, useValue: { position } },
        { provide: ToastService, useValue: toast },
        { provide: HapticsService, useValue: haptics },
      ],
    });
    return TestBed.inject(DriverTripStore);
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 6, 15, 0) });
    api = new FakeApi();
    driver = fakeDriver();
    position.set(PARQUE_93);
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  /** El conductor avanza: se mueve por el mapa y el effect del rastro corre con la detección de cambios. */
  const drive = (meters: number, seconds: number): void => {
    vi.advanceTimersByTime(seconds * 1000);
    position.set(north(meters));
    TestBed.tick();
  };

  it('guides the driver through arrive, start and complete with the real distance and time', async () => {
    const store = setup();
    expect(store.action()?.label).toBe('Llegué al punto');

    await store.advance();
    expect(store.status()).toBe('driver_arrived');
    expect(store.action()?.label).toBe('Iniciar viaje');

    await store.advance();
    expect(store.status()).toBe('in_progress');
    expect(store.trail()?.points).toBe(1);

    drive(600, 120);
    drive(1450, 240);
    expect(store.trail()?.distanceKm).toBeCloseTo(1.45, 2);

    await store.advance();

    expect(api.calls).toEqual(['arrive 30', 'start 30', 'complete 30']);
    expect(api.completeBody).toEqual({ actual_distance_km: 1.45, actual_duration_min: 6 });
    expect(store.summary()).toEqual(expect.objectContaining({ distanceSource: 'gps' }));
    expect(store.summary()?.completed.final_fare).toBe(7300);
    expect(driver.events).toEqual(['summary']);
    expect(haptics.success).toHaveBeenCalledTimes(3);

    await store.finish();
    expect(store.summary()).toBeNull();
    expect(driver.events).toEqual(['summary', 'release']);
  });

  it('does not count GPS movement before the ride starts', async () => {
    const store = setup();
    drive(900, 60);
    await store.advance();
    await store.advance();

    expect(store.trail()?.distanceKm).toBe(0);
  });

  it('reports the estimated distance when the GPS recorded no movement', async () => {
    driver.assigned.set({ ...assigned, status: 'driver_arrived' });
    const store = setup();
    await store.advance();
    vi.advanceTimersByTime(4 * 60_000);

    await store.advance();

    expect(api.completeBody).toEqual({ actual_distance_km: 1.28, actual_duration_min: 4 });
    expect(store.summary()?.distanceSource).toBe('estimate');
  });

  it('releases the trip when the passenger cancelled it', async () => {
    api.error = new ApiError(
      400,
      'Transición de estado no permitida: cancelled → driver_arrived.',
      {},
      {
        current_status: 'cancelled',
      },
    );
    const store = setup();

    await store.advance();

    expect(toast.error).toHaveBeenCalledWith('El pasajero canceló el viaje.');
    expect(driver.events).toEqual(['release']);
    expect(haptics.error).toHaveBeenCalled();
  });

  it('catches up when the trip was already further along', async () => {
    api.error = new ApiError(400, 'Transición no permitida', {}, { current_status: 'in_progress' });
    const store = setup();

    await store.advance();

    expect(store.status()).toBe('in_progress');
    expect(store.trail()).not.toBeNull();
    expect(store.action()?.label).toBe('Finalizar viaje');
  });

  it('keeps the trip and explains other errors', async () => {
    api.error = new ApiError(0, 'Sin conexión');
    const store = setup();

    await store.advance();

    expect(store.status()).toBe('assigned');
    expect(toast.error).toHaveBeenCalledWith('Sin conexión');
    expect(store.busy()).toBe(false);
  });
});
