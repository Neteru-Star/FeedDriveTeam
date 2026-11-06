import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  Router,
  provideRouter,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';

import { authGuard, guestGuard, roleGuard } from './auth.guards';
import { ROLE_HOME, type Role } from './auth.models';
import { AuthStore } from './auth.store';

describe('auth guards', () => {
  const role = signal<Role | null>(null);
  const store = {
    role,
    isAuthenticated: computed(() => role() !== null),
    home: computed(() => (role() ? ROLE_HOME[role()!] : '/login')),
  };

  const run = (guard: typeof authGuard, url: string) =>
    TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));
  const serialize = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

  beforeEach(() => {
    role.set(null);
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthStore, useValue: store }] });
  });

  it('sends a visitor to the login and keeps the requested route', () => {
    expect(serialize(run(authGuard, '/pasajero'))).toBe('/login?returnUrl=%2Fpasajero');
    expect(serialize(run(roleGuard('client'), '/pasajero'))).toBe('/login?returnUrl=%2Fpasajero');
  });

  it('lets each role into its own section', () => {
    role.set('driver');
    expect(run(roleGuard('driver'), '/conductor')).toBe(true);
  });

  it('shows access denied when a passenger opens /admin', () => {
    role.set('client');
    expect(serialize(run(roleGuard('admin'), '/admin'))).toBe('/acceso-denegado?ruta=%2Fadmin');
  });

  it('sends a logged-in user from the login to the home of their role', () => {
    role.set('driver');
    expect(serialize(run(guestGuard, '/login'))).toBe('/conductor');
    role.set(null);
    expect(run(guestGuard, '/login')).toBe(true);
  });
});
