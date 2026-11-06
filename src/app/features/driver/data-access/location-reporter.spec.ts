import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LocationService } from '@core/location/location.service';

import { DriverApi } from './driver.api';
import type { LocationReport } from './driver.models';
import { LocationReporter, REPORT_INTERVAL_MS } from './location-reporter';

describe('LocationReporter', () => {
  const position = signal<{ lat: number; lng: number } | null>(null);
  const heading = signal<number | null>(null);
  const speedKmh = signal<number | null>(null);
  let sent: LocationReport[];
  let watching: boolean;

  function setup(): LocationReporter {
    TestBed.configureTestingModule({
      providers: [
        LocationReporter,
        { provide: DriverApi, useValue: { sendLocation: async (r: LocationReport) => void sent.push(r) } },
        {
          provide: LocationService,
          useValue: {
            position,
            heading,
            speedKmh,
            watch: async () => void (watching = true),
            stopWatch: async () => void (watching = false),
          },
        },
      ],
    });
    return TestBed.inject(LocationReporter);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    watching = false;
    position.set(null);
    heading.set(null);
    speedKmh.set(null);
  });

  afterEach(() => vi.useRealTimers());

  /** toObservable emite dentro de un effect: hay que dejar correr la detección de cambios. */
  const move = async (lat: number): Promise<void> => {
    position.set({ lat, lng: -74.0483 });
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
  };

  it('sends the first position at once and then at most one every 5 seconds, keeping the last one', async () => {
    const reporter = setup();
    reporter.start();
    expect(watching).toBe(true);

    await move(4.6766);
    await move(4.677);
    await move(4.678);
    expect(sent.map((r) => r.latitude)).toEqual([4.6766]);

    await vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS);
    expect(sent.map((r) => r.latitude)).toEqual([4.6766, 4.678]);
  });

  it('includes the heading, the speed and the trip when known', async () => {
    const reporter = setup();
    heading.set(120.54);
    speedKmh.set(34.27);
    reporter.setTrip(3);
    reporter.start();

    await move(4.6715);

    expect(sent).toEqual([{ latitude: 4.6715, longitude: -74.0483, heading: 120.5, speed: 34.3, trip_id: 3 }]);
  });

  it('stops sending and following the GPS when stopped', async () => {
    const reporter = setup();
    reporter.start();
    await move(4.6766);

    await reporter.stop();
    await move(4.69);
    await vi.advanceTimersByTimeAsync(REPORT_INTERVAL_MS * 2);

    expect(sent).toHaveLength(1);
    expect(watching).toBe(false);
    expect(reporter.active).toBe(false);
  });
});
