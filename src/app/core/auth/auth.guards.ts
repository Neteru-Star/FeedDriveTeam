import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import type { Role } from './auth.models';
import { AuthStore } from './auth.store';

const toLogin = (returnUrl: string) => inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl } });

/** Solo usuarios con sesión; sin sesión va al login y conserva la ruta pedida. */
export const authGuard: CanActivateFn = (_route, state) => inject(AuthStore).isAuthenticated() || toLogin(state.url);

/** Solo el rol indicado; con otro rol muestra la página de acceso denegado. */
export function roleGuard(role: Role): CanActivateFn {
  return (_route, state) => {
    const store = inject(AuthStore);
    if (!store.isAuthenticated()) return toLogin(state.url);
    if (store.role() === role) return true;
    return inject(Router).createUrlTree(['/acceso-denegado'], { queryParams: { ruta: state.url } });
  };
}

/** Login y registro: con sesión abierta lleva directo al inicio del rol. */
export const guestGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  return !store.isAuthenticated() || inject(Router).parseUrl(store.home());
};
