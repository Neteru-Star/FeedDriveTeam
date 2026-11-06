import type { AppConfig } from '@core/config/app-config';

// Backend simulado local (mock-api/server.mjs). En un celular, cambia localhost por la IP del computador.
export const environment: AppConfig = {
  production: false,
  apiBaseUrl: 'http://localhost:8000/api',
  mapStyleUrl: 'https://tiles.openfreemap.org/styles/positron',
  pollIntervalMs: 5000,
};
