import type { Routes } from '@angular/router';
import { RoleShellComponent, type ShellData } from '@layout/role-shell.component';

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
    children: [
      { path: '', loadComponent: () => import('./pages/driver-home.page').then((m) => m.DriverHomePage) },
      { path: 'cuenta', loadComponent: () => import('@features/account/account.page').then((m) => m.AccountPage) },
    ],
  },
];
