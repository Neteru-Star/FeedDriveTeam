import { DestroyRef, Injectable, Injector, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { LocationService } from '@core/location/location.service';
import type { LatLng } from '@shared/utils/geo';
import { EMPTY, asyncScheduler, catchError, exhaustMap, filter, from, throttleTime, type Subscription } from 'rxjs';

import { DriverApi } from './driver.api';

/** Un reporte cada 5 s como máximo: suficiente para el seguimiento del pasajero sin saturar el backend. */
export const REPORT_INTERVAL_MS = 5_000;

/**
 * Envía la posición del conductor a `POST /driver/location` mientras está en línea o en un viaje.
 * Sigue el GPS de forma continua y limita los envíos con throttle (el primero sale de inmediato y el último no se pierde).
 */
@Injectable()
export class LocationReporter {
  private readonly location = inject(LocationService);
  private readonly api = inject(DriverApi);
  private readonly position$ = toObservable(this.location.position, { injector: inject(Injector) });

  private subscription?: Subscription;
  private tripId: number | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => void this.stop());
  }

  get active(): boolean {
    return this.subscription !== undefined;
  }

  /** El viaje en curso viaja con cada reporte para que el backend lo asocie (null si solo está en línea). */
  setTrip(tripId: number | null): void {
    this.tripId = tripId;
  }

  start(): void {
    if (this.subscription) return;
    void this.location.watch();
    this.subscription = this.position$
      .pipe(
        filter((position): position is LatLng => position !== null),
        throttleTime(REPORT_INTERVAL_MS, asyncScheduler, { leading: true, trailing: true }),
        exhaustMap((position) => from(this.send(position)).pipe(catchError(() => EMPTY))),
      )
      .subscribe();
  }

  async stop(): Promise<void> {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    await this.location.stopWatch();
  }

  private send(position: LatLng): Promise<unknown> {
    const heading = this.location.heading();
    const speed = this.location.speedKmh();
    return this.api.sendLocation({
      latitude: Number(position.lat.toFixed(6)),
      longitude: Number(position.lng.toFixed(6)),
      ...(heading === null ? {} : { heading: Math.round(heading * 10) / 10 }),
      ...(speed === null ? {} : { speed: Math.round(speed * 10) / 10 }),
      ...(this.tripId === null ? {} : { trip_id: this.tripId }),
    });
  }
}
