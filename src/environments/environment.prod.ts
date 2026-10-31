import type { AppConfig } from '@core/config/app-config';

export const environment: AppConfig = {
  production: true,
  apiBaseUrl: 'http://20.20.2.171:8000/api',
  mapStyleUrl: 'https://tiles.openfreemap.org/styles/positron',
  pollIntervalMs: 5000,
};
