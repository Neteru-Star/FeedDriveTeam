import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '@core/config/app-config';

import { ClientApi } from './client.api';

const API = 'http://api.test/api';

describe('ClientApi', () => {
  let api: ClientApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: API } },
      ],
    });
    api = TestBed.inject(ClientApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('unwraps the active fare, the estimate and the ride request', async () => {
    const fare = api.activeFare();
    backend.expectOne(`${API}/fares/active`).flush({ success: true, fare: { id: 1, surge_multiplier: 1 } });
    expect((await fare).id).toBe(1);

    const estimate = api.estimate({
      origin_latitude: 1,
      origin_longitude: 2,
      destination_latitude: 3,
      destination_longitude: 4,
    });
    const estimateReq = backend.expectOne(`${API}/client/estimate-fare`);
    expect(estimateReq.request.method).toBe('POST');
    estimateReq.flush({ success: true, estimate: { estimated_fare: 6500 } });
    expect((await estimate).estimated_fare).toBe(6500);

    const ride = api.requestRide({
      origin_name: 'A',
      origin_latitude: 1,
      origin_longitude: 2,
      destination_name: 'B',
      destination_latitude: 3,
      destination_longitude: 4,
    });
    backend
      .expectOne(`${API}/client/ride-requests`)
      .flush({ success: true, ride_request: { id: 9, status: 'requested' } });
    expect((await ride).id).toBe(9);
  });

  it('reads the active ride and cancels with a reason', async () => {
    const active = api.active();
    backend.expectOne(`${API}/client/active`).flush({ success: true, has_active: false, type: null, data: null });
    expect((await active).has_active).toBe(false);

    const cancel = api.cancel(9, 'Cambio de planes');
    const req = backend.expectOne(`${API}/client/cancel/9`);
    expect(req.request.body).toEqual({ reason: 'Cambio de planes' });
    req.flush({ success: true });
    await cancel;
  });

  it('reads a page of the trip history', async () => {
    const trips = api.trips(2);
    backend
      .expectOne(`${API}/client/trips?page=2`)
      .flush({ success: true, trips: { data: [{ id: 3, status: 'completed', final_fare: 9300 }] } });

    expect(await trips).toEqual([{ id: 3, status: 'completed', final_fare: 9300 }]);
  });
});
