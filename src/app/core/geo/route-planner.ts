import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '@core/config/app-config';
import type { LatLng } from '@shared/utils/geo';
import { catchError, map, of, shareReplay, tap, timeout, type Observable } from 'rxjs';

/** Ruta por calles entre dos puntos. */
export interface RoadRoute {
  /** Trazado que sigue las vías, del origen al destino. */
  path: LatLng[];
  distanceKm: number;
  durationMin: number;
}

/**
 * Cálculo de rutas intercambiable: el mapa depende de esta clase abstracta,
 * así cambiar OSRM por Mapbox o Google no toca las pantallas.
 */
export abstract class RoutePlanner {
  /** Emite la ruta por calles, o `null` si no se pudo calcular (sin conexión, sin vías entre los puntos). */
  abstract route(from: LatLng, to: LatLng): Observable<RoadRoute | null>;
}

interface OsrmResponse {
  code: string;
  routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
}

/** El servidor público de OSRM puede tardar; pasado este tiempo el mapa deja el trazo aproximado. */
export const ROUTE_TIMEOUT_MS = 8_000;
const MAX_CACHED = 30;
/** ~1 m de precisión: suficiente para reconocer la misma ruta entre consultas. */
const KEY_DECIMALS = 5;

export const routeKey = (from: LatLng, to: LatLng): string =>
  [from.lat, from.lng, to.lat, to.lng].map((v) => v.toFixed(KEY_DECIMALS)).join(',');

/** OSRM (datos de OpenStreetMap), perfil de carro. Recuerda las últimas rutas para no repetir consultas. */
@Injectable()
export class OsrmRoutePlanner extends RoutePlanner {
  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_CONFIG).routingUrl;
  private readonly cache = new Map<string, Observable<RoadRoute | null>>();

  route(from: LatLng, to: LatLng): Observable<RoadRoute | null> {
    const key = routeKey(from, to);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const request = this.http
      .get<OsrmResponse>(`${this.base}/route/v1/driving/${coords}`, {
        params: { overview: 'full', geometries: 'geojson' },
      })
      .pipe(
        timeout(ROUTE_TIMEOUT_MS),
        map(toRoadRoute),
        catchError(() => of(null)),
        // Un fallo no se recuerda: la próxima vez se vuelve a intentar.
        tap((road) => !road && this.cache.delete(key)),
        shareReplay(1),
      );
    this.cache.set(key, request);
    if (this.cache.size > MAX_CACHED) this.cache.delete(this.cache.keys().next().value!);
    return request;
  }
}

function toRoadRoute(response: OsrmResponse): RoadRoute | null {
  const best = response.code === 'Ok' ? response.routes?.[0] : undefined;
  const coordinates = best?.geometry.coordinates ?? [];
  if (!best || coordinates.length < 2) return null;
  return {
    // GeoJSON entrega [longitud, latitud].
    path: coordinates.map(([lng, lat]) => ({ lat, lng })),
    distanceKm: best.distance / 1000,
    durationMin: best.duration / 60,
  };
}
