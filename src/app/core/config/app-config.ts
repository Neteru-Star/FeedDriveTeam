import { InjectionToken } from '@angular/core';

export interface AppConfig {
  production: boolean;
  apiBaseUrl: string;
  mapStyleUrl: string;
  pollIntervalMs: number;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
