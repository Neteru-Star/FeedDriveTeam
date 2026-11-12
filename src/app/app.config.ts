import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeEsCo from '@angular/common/locales/es-CO';
import { DEFAULT_CURRENCY_CODE, LOCALE_ID, inject, provideAppInitializer, type ApplicationConfig } from '@angular/core';
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
import { AuthStore } from './core/auth/auth.store';
import { APP_CONFIG } from './core/config/app-config';
import { Geocoder, NominatimGeocoder } from './core/geo/geocoder';
import { OsrmRoutePlanner, RoutePlanner } from './core/geo/route-planner';
import { authInterceptor, errorInterceptor } from './core/http/interceptors';

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
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    { provide: Geocoder, useClass: NominatimGeocoder },
    { provide: RoutePlanner, useClass: OsrmRoutePlanner },
    // La sesión guardada se recupera antes de la primera navegación, para que los guards la vean.
    provideAppInitializer(() => inject(AuthStore).restore()),
  ],
};
