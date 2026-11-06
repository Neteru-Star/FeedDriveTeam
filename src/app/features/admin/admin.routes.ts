import type { Route, Routes } from '@angular/router';
import { RoleShellComponent, type ShellData } from '@layout/role-shell.component';
import type { SectionData } from '@layout/section-placeholder.page';

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

/** Secciones del panel; las Fases 9 y 10 reemplazan cada una por su pantalla real. */
function section(path: string, data: SectionData): Route {
  return {
    path,
    data,
    loadComponent: () => import('@layout/section-placeholder.page').then((m) => m.SectionPlaceholderPage),
  };
}

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: RoleShellComponent,
    data: shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      section('dashboard', {
        title: 'Dashboard',
        emptyTitle: 'Métricas de la plataforma',
        emptyMessage: 'Aquí verás usuarios, conductores activos, viajes del día e ingresos.',
      }),
      section('conductores', {
        title: 'Conductores',
        emptyTitle: 'Conductores registrados',
        emptyMessage: 'Aquí podrás aprobar, suspender o rechazar conductores.',
      }),
      section('tarifas', {
        title: 'Tarifas',
        emptyTitle: 'Tarifas urbanas',
        emptyMessage: 'Aquí podrás consultar y crear las tarifas de la plataforma.',
      }),
      section('viajes', {
        title: 'Viajes',
        emptyTitle: 'Todos los viajes',
        emptyMessage: 'Aquí verás los viajes con filtros por estado, cliente, conductor y fecha.',
      }),
      section('reportes', {
        title: 'Reportes',
        emptyTitle: 'Reportes consolidados',
        emptyMessage: 'Aquí verás ingresos, cancelaciones y desempeño de los conductores.',
      }),
      section('auditoria', {
        title: 'Auditoría',
        emptyTitle: 'Registro de auditoría',
        emptyMessage: 'Aquí verás las acciones administrativas y de seguridad.',
      }),
      { path: 'cuenta', loadComponent: () => import('@features/account/account.page').then((m) => m.AccountPage) },
    ],
  },
];
