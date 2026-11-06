import { TestBed } from '@angular/core/testing';

import { GEOLOCATION, IS_NATIVE_PLATFORM, LocationService } from './location.service';

const coords = { latitude: 4.6766, longitude: -74.0483, heading: 90, accuracy: 5 };

describe('LocationService', () => {
  function setup(geolocation: object, isNative = false): LocationService {
    TestBed.configureTestingModule({
      providers: [
        { provide: GEOLOCATION, useValue: geolocation },
        { provide: IS_NATIVE_PLATFORM, useValue: isNative },
      ],
    });
    return TestBed.inject(LocationService);
  }

  it('stores the position and heading when the user grants access', async () => {
    const service = setup({ getCurrentPosition: async () => ({ coords }) });

    const position = await service.locate();

    expect(position).toEqual({ lat: 4.6766, lng: -74.0483 });
    expect(service.status()).toBe('granted');
    expect(service.heading()).toBe(90);
  });

  it('reports "denied" when the browser refuses the permission', async () => {
    const service = setup({
      getCurrentPosition: () => Promise.reject({ code: 1, message: 'User denied Geolocation' }),
    });

    expect(await service.locate()).toBeNull();
    expect(service.status()).toBe('denied');
  });

  it('reports "unavailable" when the GPS times out', async () => {
    const service = setup({ getCurrentPosition: () => Promise.reject(new Error('Timeout expired')) });

    await service.locate();

    expect(service.status()).toBe('unavailable');
  });

  it('asks for the permission on Android before reading the GPS', async () => {
    const getCurrentPosition = vi.fn(async () => ({ coords }));
    const service = setup(
      {
        checkPermissions: async () => ({ location: 'prompt' }),
        requestPermissions: async () => ({ location: 'denied' }),
        getCurrentPosition,
      },
      true,
    );

    await service.locate();

    expect(service.status()).toBe('denied');
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('follows the position continuously and stops when asked', async () => {
    type Callback = (position: { coords: object } | null, error?: unknown) => void;
    let callback: Callback = () => undefined;
    const cleared: string[] = [];
    const service = setup({
      watchPosition: async (_options: object, cb: Callback) => ((callback = cb), 'watch-1'),
      clearWatch: async ({ id }: { id: string }) => void cleared.push(id),
    });

    await service.watch();
    await service.watch();
    callback({ coords: { ...coords, speed: 10 } });

    expect(service.position()).toEqual({ lat: 4.6766, lng: -74.0483 });
    expect(service.speedKmh()).toBe(36);
    expect(service.watching()).toBe(true);

    callback(null, { code: 1, message: 'denied' });
    expect(service.status()).toBe('denied');

    await service.stopWatch();
    expect(cleared).toEqual(['watch-1']);
    expect(service.watching()).toBe(false);
  });
});
