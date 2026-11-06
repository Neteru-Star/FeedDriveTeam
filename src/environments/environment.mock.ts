import type { AppConfig } from '@core/config/app-config';

import { GEOCODER_URL, MAP_TILES } from './map-tiles';

// Backend simulado local (mock-api/server.mjs). En un celular, cambia localhost por la IP del computador.
export const environment: AppConfig = {
  production: false,
  apiBaseUrl: 'http://localhost:8000/api',
  mapTiles: MAP_TILES,
  geocoderUrl: GEOCODER_URL,
  pollIntervalMs: 5000,
};
