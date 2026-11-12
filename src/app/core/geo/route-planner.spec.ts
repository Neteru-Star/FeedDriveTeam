import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '@core/config/app-config';
import { firstValueFrom } from 'rxjs';

import { OsrmRoutePlanner, ROUTE_TIMEOUT_MS } from './route-planner';

const OSRM = 'https://osrm.test';
const FET = { lat: 2.8905, lng: -75.2935 };
const CENTRO = { lat: 2.9345, lng: -75.289 };
const URL = `${OSRM}/route/v1/driving/-75.2935,2.8905;-75.289,2.9345?overview=full&geometries=geojson`;
const ok = {
  code: 'Ok',
  routes: [
    {
      distance: 6243,
      duration: 448,
      geometry: {
        coordinates: [
          [-75.2935, 2.8905],
          [-75.2951, 2.91],
          [-75.289, 2.9345],
        ],
      },
    },
  ],
};

describe('OsrmRoutePlanner', () => {
  let planner: OsrmRoutePlanner;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        OsrmRoutePlanner,
        { provide: APP_CONFIG, useValue: { routingUrl: OSRM } },
      ],
    });
    planner = TestBed.inject(OsrmRoutePlanner);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  it('returns the path along the roads with its distance and time', async () => {
    const route = firstValueFrom(planner.route(FET, CENTRO));
    backend.expectOne(URL).flush(ok);

    const road = await route;
    // OSRM entrega [longitud, latitud]; el mapa usa latitud y longitud.
    expect(road?.path[1]).toEqual({ lat: 2.91, lng: -75.2951 });
    expect(road?.distanceKm).toBeCloseTo(6.24, 2);
    expect(road?.durationMin).toBeCloseTo(7.47, 2);
  });

  it('asks only once for the same route', async () => {
    const first = firstValueFrom(planner.route(FET, CENTRO));
    backend.expectOne(URL).flush(ok);
    await first;

    const again = await firstValueFrom(planner.route({ ...FET }, { ...CENTRO }));

    expect(again?.path).toHaveLength(3);
    backend.expectNone(URL);
  });

  it('gives null when there is no road between the points, and tries again next time', async () => {
    const first = firstValueFrom(planner.route(FET, CENTRO));
    backend.expectOne(URL).flush({ code: 'NoRoute', routes: [] });
    expect(await first).toBeNull();

    const second = firstValueFrom(planner.route(FET, CENTRO));
    backend.expectOne(URL).flush(ok);
    expect((await second)?.path).toHaveLength(3);
  });

  it('gives null when the service fails or takes too long', async () => {
    const failed = firstValueFrom(planner.route(FET, CENTRO));
    backend.expectOne(URL).flush('error', { status: 500, statusText: 'Server Error' });
    expect(await failed).toBeNull();

    vi.useFakeTimers();
    const slow = firstValueFrom(planner.route(FET, CENTRO));
    const pending = backend.expectOne(URL);
    vi.advanceTimersByTime(ROUTE_TIMEOUT_MS + 1);
    expect(await slow).toBeNull();
    expect(pending.cancelled).toBe(true);
  });
});
