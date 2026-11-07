import type { AppConfig } from '@core/config/app-config';

import { GEOCODER_URL, MAP_TILES } from './map-tiles';

/** URL del backend que se inyecta al compilar el APK (`scripts/build-apk.mjs` usa `--define`). */
declare const FEEDDRIVE_API_URL: string;

// APK de prueba en un celular: apunta al backend que se indique al compilar (el simulado en el computador o el real).
export const environment: AppConfig = {
  production: true,
  apiBaseUrl: FEEDDRIVE_API_URL,
  mapTiles: MAP_TILES,
  geocoderUrl: GEOCODER_URL,
  pollIntervalMs: 5000,
};
