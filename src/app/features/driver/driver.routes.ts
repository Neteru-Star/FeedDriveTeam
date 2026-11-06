import type { Routes } from '@angular/router';
import { RoleShellComponent, type ShellData } from '@layout/role-shell.component';

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
    providers: [DriverStore, LocationReporter],
    children: [
      { path: '', loadComponent: () => import('./pages/driver-home.page').then((m) => m.DriverHomePage) },
      { path: 'cuenta', loadComponent: () => import('@features/account/account.page').then((m) => m.AccountPage) },
    ],
  },
];
