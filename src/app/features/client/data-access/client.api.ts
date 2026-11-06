import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '@core/config/app-config';
import { firstValueFrom, map } from 'rxjs';

import type { ClientActive, Fare, FareEstimate, RideRequest, RideRequestPayload, RouteCoords } from './client.models';

/** Endpoints del pasajero (`/api/client`) y la tarifa pública. Adapta las respuestas `{ success, ... }` a modelos. */
@Injectable({ providedIn: 'root' })
export class ClientApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_CONFIG).apiBaseUrl;

  activeFare(): Promise<Fare> {
    return firstValueFrom(this.http.get<{ fare: Fare }>(`${this.base}/fares/active`).pipe(map((r) => r.fare)));
  }

  estimate(route: RouteCoords): Promise<FareEstimate> {
    return firstValueFrom(
      this.http
        .post<{ estimate: FareEstimate }>(`${this.base}/client/estimate-fare`, route)
        .pipe(map((r) => r.estimate)),
    );
  }

  requestRide(payload: RideRequestPayload): Promise<RideRequest> {
    return firstValueFrom(
      this.http
        .post<{ ride_request: RideRequest }>(`${this.base}/client/ride-requests`, payload)
        .pipe(map((r) => r.ride_request)),
    );
  }

  active(): Promise<ClientActive> {
    return firstValueFrom(this.http.get<ClientActive>(`${this.base}/client/active`));
  }

  /** Cancela la solicitud o el viaje antes de iniciar el recorrido. */
  cancel(id: number, reason: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.base}/client/cancel/${id}`, { reason }));
  }
}
