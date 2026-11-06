import { inject } from '@angular/core';
import type { Routes } from '@angular/router';
import { guestGuard, roleGuard } from '@core/auth/auth.guards';
import { AuthStore } from '@core/auth/auth.store';
import { environment } from '@env/environment';

export const routes: Routes = [
  // La raíz lleva al inicio del rol, o al login si no hay sesión.
  { path: '', pathMatch: 'full', redirectTo: () => inject(AuthStore).home() },

  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/pages/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'registro',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/pages/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'recuperar-clave',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/pages/forgot-password.page').then((m) => m.ForgotPasswordPage),
  },

  {
    path: 'pasajero',
    canActivate: [roleGuard('client')],
    loadChildren: () => import('./features/client/client.routes').then((m) => m.CLIENT_ROUTES),
  },
  {
    path: 'conductor',
    canActivate: [roleGuard('driver')],
    loadChildren: () => import('./features/driver/driver.routes').then((m) => m.DRIVER_ROUTES),
  },
  {
    path: 'admin',
    canActivate: [roleGuard('admin')],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },

  {
    path: 'acceso-denegado',
    loadComponent: () => import('./features/errors/access-denied.page').then((m) => m.AccessDeniedPage),
  },
  ...(environment.production
    ? []
    : [
        {
          path: 'design-system',
          loadComponent: () => import('./features/design-system/design-system.page').then((m) => m.DesignSystemPage),
        },
      ]),
  {
    path: '**',
    loadComponent: () => import('./features/errors/not-found.page').then((m) => m.NotFoundPage),
  },
];
