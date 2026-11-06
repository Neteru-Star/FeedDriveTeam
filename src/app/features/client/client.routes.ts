import type { Routes } from '@angular/router';
import { RoleShellComponent, type ShellData } from '@layout/role-shell.component';

import { ActiveRideStore } from './data-access/active-ride.store';
import { FareQuoteStore } from './data-access/fare-quote.store';
import { TripDraftStore } from './data-access/trip-draft.store';
import { TripHistoryStore } from './data-access/trip-history.store';

const shell: ShellData = {
  menuId: 'pasajero',
  items: [
    { label: 'Viajar', icon: 'map-outline', link: '/pasajero', exact: true },
    { label: 'Mis viajes', icon: 'time-outline', link: '/pasajero/viajes' },
    { label: 'Cuenta', icon: 'person-circle-outline', link: '/pasajero/cuenta' },
  ],
};

export const CLIENT_ROUTES: Routes = [
  {
    path: '',
    component: RoleShellComponent,
    data: shell,
    // Estado del pasajero: vive mientras tenga la sesión abierta y se descarta al cerrarla.
    providers: [TripDraftStore, FareQuoteStore, ActiveRideStore, TripHistoryStore],
    children: [
      { path: '', loadComponent: () => import('./pages/client-home.page').then((m) => m.ClientHomePage) },
      { path: 'viajes', loadComponent: () => import('./pages/trips.page').then((m) => m.TripsPage) },
      {
        path: 'viajes/:id',
        loadComponent: () => import('./pages/trip-detail.page').then((m) => m.TripDetailPage),
      },
      { path: 'cuenta', loadComponent: () => import('@features/account/account.page').then((m) => m.AccountPage) },
    ],
  },
];
