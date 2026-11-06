import type { Routes } from '@angular/router';
import { RoleShellComponent, type ShellData } from '@layout/role-shell.component';
import type { SectionData } from '@layout/section-placeholder.page';

import { ActiveRideStore } from './data-access/active-ride.store';
import { FareQuoteStore } from './data-access/fare-quote.store';
import { TripDraftStore } from './data-access/trip-draft.store';

const shell: ShellData = {
  menuId: 'pasajero',
  items: [
    { label: 'Viajar', icon: 'map-outline', link: '/pasajero', exact: true },
    { label: 'Mis viajes', icon: 'time-outline', link: '/pasajero/viajes' },
    { label: 'Cuenta', icon: 'person-circle-outline', link: '/pasajero/cuenta' },
  ],
};

const trips: SectionData = {
  title: 'Mis viajes',
  emptyTitle: 'Aún no tienes viajes',
  emptyMessage: 'Cuando pidas tu primer viaje, aparecerá aquí.',
};

export const CLIENT_ROUTES: Routes = [
  {
    path: '',
    component: RoleShellComponent,
    data: shell,
    // Estado del pasajero: vive mientras tenga la sesión abierta y se descarta al cerrarla.
    providers: [TripDraftStore, FareQuoteStore, ActiveRideStore],
    children: [
      { path: '', loadComponent: () => import('./pages/client-home.page').then((m) => m.ClientHomePage) },
      {
        path: 'viajes',
        data: trips,
        loadComponent: () => import('@layout/section-placeholder.page').then((m) => m.SectionPlaceholderPage),
      },
      { path: 'cuenta', loadComponent: () => import('@features/account/account.page').then((m) => m.AccountPage) },
    ],
  },
];
