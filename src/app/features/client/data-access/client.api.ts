import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '@core/config/app-config';
import { firstValueFrom, map } from 'rxjs';

import type {
  ClientActive,
  Fare,
  FareEstimate,
  RideRequest,
  RideRequestPayload,
  RatingPayload,
  RouteCoords,
  TripPage,
  TripRating,
  TripRecord,
} from './client.models';

/** Respuesta paginada de Laravel; la documentación solo muestra `data`, así que el resto es opcional. */
interface LaravelPage<T> {
  data: T[];
  current_page?: number;
  last_page?: number;
  next_page_url?: string | null;
}

/** Hay más páginas según lo que traiga el backend; sin metadatos, se sigue pidiendo hasta recibir una vacía. */
export function hasMorePages(page: LaravelPage<unknown>, requested: number): boolean {
  if (page.next_page_url !== undefined) return page.next_page_url !== null;
  if (page.last_page !== undefined) return (page.current_page ?? requested) < page.last_page;
  return page.data.length > 0;
}

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

  /** Una página del historial, del viaje más reciente al más antiguo. */
  trips(page = 1): Promise<TripPage> {
    return firstValueFrom(
      this.http.get<{ trips: LaravelPage<TripRecord> }>(`${this.base}/client/trips`, { params: { page } }).pipe(
        map(({ trips }) => ({
          items: trips.data,
          page: trips.current_page ?? page,
          hasMore: hasMorePages(trips, page),
        })),
      ),
    );
  }

  rate(tripId: number, payload: RatingPayload): Promise<{ message: string; rating: TripRating }> {
    return firstValueFrom(
      this.http.post<{ message: string; rating: TripRating }>(`${this.base}/client/trips/${tripId}/rating`, payload),
    );
  }

  /** Cancela la solicitud o el viaje antes de iniciar el recorrido. */
  cancel(id: number, reason: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.base}/client/cancel/${id}`, { reason }));
  }
}
