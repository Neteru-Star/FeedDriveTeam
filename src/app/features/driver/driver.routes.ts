import { inject, provideEnvironmentInitializer } from '@angular/core';
import type { Routes } from '@angular/router';
import { RoleShellComponent, type ShellData } from '@layout/role-shell.component';

import { DriverTripStore } from './data-access/driver-trip.store';
import { DriverStore } from './data-access/driver.store';
import { LocationReporter } from './data-access/location-reporter';

const shell: ShellData = {
  menuId: 'conductor',
  items: [
    { label: 'Conducir', icon: 'car-outline', link: '/conductor', exact: true },
    { label: 'Cuenta', icon: 'person-circle-outline', link: '/conductor/cuenta' },
  ],
};

export const DRIVER_ROUTES: Routes = [
  {
    path: '',
    component: RoleShellComponent,
    data: shell,
    // Estado del conductor: vive mientras tenga la sesión abierta y se descarta al cerrarla.
    providers: [
      DriverStore,
      DriverTripStore,
      LocationReporter,
      // El store existe desde que se entra a la sección (no solo en el mapa): así se desconecta al cerrar sesión
      // aunque la app se haya abierto directamente en "Cuenta".
      provideEnvironmentInitializer(() => inject(DriverStore)),
    ],
    children: [
      { path: '', loadComponent: () => import('./pages/driver-home.page').then((m) => m.DriverHomePage) },
      { path: 'cuenta', loadComponent: () => import('@features/account/account.page').then((m) => m.AccountPage) },
    ],
  },
];
