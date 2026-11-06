import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import localeEsCo from '@angular/common/locales/es-CO';
import { DEFAULT_CURRENCY_CODE, LOCALE_ID, type ApplicationConfig } from '@angular/core';
import {
  PreloadAllModules,
  RouteReuseStrategy,
  provideRouter,
  withComponentInputBinding,
  withPreloading,
} from '@angular/router';
import { environment } from '@env/environment';
import { IonicRouteStrategy } from '@ionic/angular/ionic-route-strategy';
import { provideIonicAngular } from '@ionic/angular/provide';

import { routes } from './app.routes';
import { APP_CONFIG } from './core/config/app-config';

// Números, fechas y moneda en formato colombiano: $ 22.750
registerLocaleData(localeEsCo);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: APP_CONFIG, useValue: environment },
    { provide: LOCALE_ID, useValue: 'es-CO' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'COP' },
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    provideHttpClient(),
  ],
};
