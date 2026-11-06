import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error';

import { ClientApi } from './client.api';
import type { FareEstimate } from './client.models';
import { FareQuoteStore } from './fare-quote.store';

const route = { from: { lat: 4.6766, lng: -74.0483 }, to: { lat: 4.6664, lng: -74.0536 } };
const estimate: FareEstimate = {
  distance_km: 1.28,
  duration_min: 4,
  estimated_fare: 6500,
  currency: 'COP',
  fare_breakdown: {
    base_fare: 3800,
    price_per_km: 1250,
    price_per_minute: 250,
    minimum_fare: 6500,
    surge_multiplier: 1,
  },
};

describe('FareQuoteStore', () => {
  function setup(api: Partial<ClientApi>): FareQuoteStore {
    TestBed.configureTestingModule({ providers: [FareQuoteStore, { provide: ClientApi, useValue: api }] });
    return TestBed.inject(FareQuoteStore);
  }

  it('quotes the route with the backend coordinates format', async () => {
    let sent: unknown;
    const store = setup({ estimate: async (r) => ((sent = r), estimate) });

    await store.estimate(route);

    expect(sent).toEqual({
      origin_latitude: 4.6766,
      origin_longitude: -74.0483,
      destination_latitude: 4.6664,
      destination_longitude: -74.0536,
    });
    expect(store.quoteFor(route)).toEqual(expect.objectContaining({ status: 'ready', estimate }));
  });

  it('forgets the quote when the destination changes, so it is recalculated', async () => {
    const store = setup({ estimate: async () => estimate });
    await store.estimate(route);

    const otherRoute = { ...route, to: { lat: 4.7, lng: -74.03 } };

    expect(store.quoteFor(otherRoute).status).toBe('idle');
  });

  it('explains a 422 and a network failure differently', async () => {
    const invalid = setup({ estimate: () => Promise.reject(new ApiError(422, 'invalid')) });
    await invalid.estimate(route);
    expect(invalid.quoteFor(route)).toEqual(
      expect.objectContaining({ status: 'error', message: expect.stringContaining('ubicación válida') }),
    );

    TestBed.resetTestingModule();
    const offline = setup({ estimate: () => Promise.reject(new ApiError(0, 'offline')) });
    await offline.estimate(route);
    expect(offline.quoteFor(route)).toEqual(
      expect.objectContaining({ status: 'error', message: expect.stringContaining('conexión') }),
    );
  });

  it('reads the surge multiplier of the active fare', async () => {
    const store = setup({
      activeFare: async () => ({
        ...estimate.fare_breakdown,
        surge_multiplier: 1.3,
        id: 2,
        name: 'Hora pico',
        active: true,
      }),
    });

    await store.loadActiveFare();

    expect(store.surge()).toBe(1.3);
  });
});
