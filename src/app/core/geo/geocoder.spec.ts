import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '@core/config/app-config';
import { firstValueFrom } from 'rxjs';

import { NominatimGeocoder } from './geocoder';

const BASE = 'https://geo.test';

describe('NominatimGeocoder', () => {
  let geocoder: NominatimGeocoder;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        NominatimGeocoder,
        { provide: APP_CONFIG, useValue: { geocoderUrl: BASE } },
      ],
    });
    geocoder = TestBed.inject(NominatimGeocoder);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('searches in Colombia, in Spanish, limited to the area around the user', async () => {
    const result = firstValueFrom(geocoder.search('Parque El Virrey', { lat: 4.67, lng: -74.05 }));
    const req = backend.expectOne((r) => r.url === `${BASE}/search`);

    expect(req.request.params.get('countrycodes')).toBe('co');
    expect(req.request.params.get('accept-language')).toBe('es');
    expect(req.request.params.get('bounded')).toBe('1');
    expect(req.request.params.get('viewbox')).toBe('-74.3500,4.9700,-73.7500,4.3700');

    req.flush([
      {
        lat: '4.6732',
        lon: '-74.0539',
        name: 'Parque El Virrey',
        display_name: 'Parque El Virrey, Chicó, Bogotá',
        address: { neighbourhood: 'Chicó', city: 'Bogotá' },
      },
    ]);
    expect(await result).toEqual([
      { label: 'Parque El Virrey', detail: 'Chicó, Bogotá', position: { lat: 4.6732, lng: -74.0539 } },
    ]);
  });

  it('builds the label from the street when the place has no name', async () => {
    const result = firstValueFrom(geocoder.reverse({ lat: 4.6766, lng: -74.0483 }));
    backend
      .expectOne((r) => r.url === `${BASE}/reverse`)
      .flush({
        lat: '4.6766',
        lon: '-74.0483',
        name: '',
        display_name: 'Calle 93A, Chicó, Bogotá',
        address: { road: 'Calle 93A', house_number: '12-50', suburb: 'Chicó', city: 'Bogotá' },
      });

    expect((await result)?.label).toBe('Calle 93A #12-50');
  });

  it('returns null when Nominatim cannot find the point', async () => {
    const result = firstValueFrom(geocoder.reverse({ lat: 0, lng: 0 }));
    backend.expectOne((r) => r.url === `${BASE}/reverse`).flush({ error: 'Unable to geocode' });

    expect(await result).toBeNull();
  });
});
