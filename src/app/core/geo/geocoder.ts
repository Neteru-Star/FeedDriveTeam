import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '@core/config/app-config';
import type { LatLng } from '@shared/utils/geo';
import { map, type Observable } from 'rxjs';

export interface Place {
  /** Nombre corto: lugar o dirección ("Parque de la 93", "Cra. 7 #45-10"). */
  label: string;
  /** Barrio y ciudad. */
  detail: string;
  position: LatLng;
}

/**
 * Búsqueda de direcciones intercambiable: la UI depende de esta clase abstracta,
 * así cambiar Nominatim por Mapbox o Google no toca las pantallas.
 */
export abstract class Geocoder {
  abstract search(query: string, near?: LatLng | null): Observable<Place[]>;
  abstract reverse(position: LatLng): Observable<Place | null>;
}

interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
}

const MAX_RESULTS = 5;
// Zona de búsqueda alrededor del usuario o del mapa: unos 30 km a cada lado, cubre una ciudad y sus alrededores.
const NEARBY_DEGREES = 0.3;

/** Nominatim (OpenStreetMap), limitado a Colombia y en español. */
@Injectable()
export class NominatimGeocoder extends Geocoder {
  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_CONFIG).geocoderUrl;

  search(query: string, near?: LatLng | null): Observable<Place[]> {
    const params: Record<string, string> = {
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      countrycodes: 'co',
      'accept-language': 'es',
      limit: String(MAX_RESULTS),
    };
    if (near) {
      // Solo resultados de la zona: "Andino" debe ser el centro comercial de Bogotá, no un barrio de Pasto.
      const d = NEARBY_DEGREES;
      params['viewbox'] = [near.lng - d, near.lat + d, near.lng + d, near.lat - d].map((v) => v.toFixed(4)).join(',');
      params['bounded'] = '1';
    }
    return this.http
      .get<NominatimResult[]>(`${this.base}/search`, { params })
      .pipe(map((results) => results.map(toPlace)));
  }

  reverse(position: LatLng): Observable<Place | null> {
    const params = {
      lat: String(position.lat),
      lon: String(position.lng),
      format: 'jsonv2',
      addressdetails: '1',
      'accept-language': 'es',
      zoom: '18',
    };
    return this.http
      .get<NominatimResult & { error?: string }>(`${this.base}/reverse`, { params })
      .pipe(map((result) => (result.error ? null : toPlace(result))));
  }
}

function toPlace(result: NominatimResult): Place {
  const a = result.address ?? {};
  const street = [a['road'], a['house_number']].filter(Boolean).join(' #');
  const label = result.name || street || result.display_name.split(',')[0];
  const area = a['neighbourhood'] || a['suburb'] || a['city_district'];
  const city = a['city'] || a['town'] || a['village'] || a['state'];
  return {
    label,
    detail: [area, city].filter((part) => part && part !== label).join(', '),
    position: { lat: Number(result.lat), lng: Number(result.lon) },
  };
}
