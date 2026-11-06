import type { AppConfig } from '@core/config/app-config';

import { GEOCODER_URL, MAP_TILES } from './map-tiles';

export const environment: AppConfig = {
  production: false,
  apiBaseUrl: 'http://20.20.2.171:8000/api',
  mapTiles: MAP_TILES,
  geocoderUrl: GEOCODER_URL,
  pollIntervalMs: 5000,
};
