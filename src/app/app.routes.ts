import type { Routes } from '@angular/router';
import { environment } from '@env/environment';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./features/home/pages/home.page').then((m) => m.HomePage),
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
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
