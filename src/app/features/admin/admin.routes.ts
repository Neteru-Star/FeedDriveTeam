import type { Routes } from '@angular/router';
import { RoleShellComponent, type ShellData } from '@layout/role-shell.component';

const shell: ShellData = {
  menuId: 'admin',
  splitPane: true,
  items: [
    { label: 'Dashboard', icon: 'grid-outline', link: '/admin/dashboard' },
    { label: 'Conductores', icon: 'people-outline', link: '/admin/conductores' },
    { label: 'Tarifas', icon: 'pricetag-outline', link: '/admin/tarifas' },
    { label: 'Viajes', icon: 'list-outline', link: '/admin/viajes' },
    { label: 'Reportes', icon: 'stats-chart-outline', link: '/admin/reportes' },
    { label: 'Auditoría', icon: 'shield-checkmark-outline', link: '/admin/auditoria' },
    { label: 'Cuenta', icon: 'person-circle-outline', link: '/admin/cuenta' },
  ],
};

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: RoleShellComponent,
    data: shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard.page').then((m) => m.AdminDashboardPage) },
      { path: 'conductores', loadComponent: () => import('./pages/drivers.page').then((m) => m.AdminDriversPage) },
      { path: 'tarifas', loadComponent: () => import('./pages/fares.page').then((m) => m.AdminFaresPage) },
      { path: 'viajes', loadComponent: () => import('./pages/trips.page').then((m) => m.AdminTripsPage) },
      { path: 'reportes', loadComponent: () => import('./pages/reports.page').then((m) => m.AdminReportsPage) },
      { path: 'auditoria', loadComponent: () => import('./pages/audit.page').then((m) => m.AdminAuditPage) },
      { path: 'cuenta', loadComponent: () => import('@features/account/account.page').then((m) => m.AccountPage) },
    ],
  },
];
