import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '@core/config/app-config';
import { firstValueFrom, map } from 'rxjs';

import type { AcceptedTrip, Availability, CompletedTrip, DriverRideRequest, LocationReport } from './driver.models';

/** Endpoints del conductor (`/api/driver`). Adapta las respuestas `{ success, ... }` a modelos. */
@Injectable({ providedIn: 'root' })
export class DriverApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_CONFIG).apiBaseUrl}/driver`;

  setAvailability(status: Availability): Promise<Availability> {
    return firstValueFrom(
      this.http
        .put<{ availability_status: Availability }>(`${this.base}/availability`, { status })
        .pipe(map((r) => r.availability_status ?? status)),
    );
  }

  rideRequests(): Promise<DriverRideRequest[]> {
    return firstValueFrom(
      this.http.get<{ requests: DriverRideRequest[] }>(`${this.base}/ride-requests`).pipe(map((r) => r.requests)),
    );
  }

  accept(requestId: number): Promise<AcceptedTrip> {
    return firstValueFrom(
      this.http
        .post<{ trip: AcceptedTrip }>(`${this.base}/ride-requests/${requestId}/accept`, {})
        .pipe(map((r) => r.trip)),
    );
  }

  /** Llegó al punto de recogida o inició el recorrido (`/arrive`, `/start`). */
  advance(tripId: number, action: 'arrive' | 'start'): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.base}/trips/${tripId}/${action}`, {}));
  }

  complete(
    tripId: number,
    actual: { actual_distance_km: number; actual_duration_min: number },
  ): Promise<CompletedTrip> {
    return firstValueFrom(
      this.http.post<{ trip: CompletedTrip }>(`${this.base}/trips/${tripId}/complete`, actual).pipe(map((r) => r.trip)),
    );
  }

  sendLocation(report: LocationReport): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.base}/location`, report));
  }
}
