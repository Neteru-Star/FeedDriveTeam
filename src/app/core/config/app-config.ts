import { InjectionToken } from '@angular/core';

export interface MapTilesConfig {
  /** Plantilla de teselas raster para Leaflet ({s}, {z}, {x}, {y}, {r}). */
  light: string;
  dark: string;
  attribution: string;
}

export interface AppConfig {
  production: boolean;
  apiBaseUrl: string;
  mapTiles: MapTilesConfig;
  /** Servicio de geocodificación compatible con Nominatim. */
  geocoderUrl: string;
  /** Servicio de rutas por calles compatible con OSRM. */
  routingUrl: string;
  pollIntervalMs: number;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
