import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { IS_NATIVE_PLATFORM } from '@core/location/location.service';
import { NavController } from '@ionic/angular/nav-controller';
import { Platform } from '@ionic/angular/platform';

import { AuthStore } from '../auth/auth.store';

import { BackButtonService, CAPACITOR_APP, FALLBACK_PRIORITY } from './back-button.service';

describe('BackButtonService', () => {
  const home = signal<string | null>('/pasajero');
  let url = '/pasajero';
  const navigated: string[] = [];
  let minimized = 0;
  let registered: { priority: number; handler: () => void } | null = null;

  function setup(isNative = true): BackButtonService {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Router,
          useValue: {
            get url() {
              return url;
            },
          },
        },
        { provide: NavController, useValue: { navigateRoot: async (p: string) => void navigated.push(p) } },
        { provide: AuthStore, useValue: { home } },
        { provide: CAPACITOR_APP, useValue: { minimizeApp: async () => void minimized++ } },
        { provide: IS_NATIVE_PLATFORM, useValue: isNative },
        {
          provide: Platform,
          useValue: {
            backButton: {
              subscribeWithPriority: (priority: number, handler: () => void) =>
                void (registered = { priority, handler }),
            },
          },
        },
      ],
    });
    return TestBed.inject(BackButtonService);
  }

  beforeEach(() => {
    navigated.length = 0;
    minimized = 0;
    registered = null;
    home.set('/pasajero');
  });

  it('runs after Ionic handles menus, modals and history', () => {
    setup().init();
    expect(registered?.priority).toBe(FALLBACK_PRIORITY);
  });

  it('does nothing in the browser', () => {
    setup(false).init();
    expect(registered).toBeNull();
  });

  it('returns to the role home from another section', async () => {
    url = '/pasajero/viajes/3';
    await setup().handle();
    expect(navigated).toEqual(['/pasajero']);
    expect(minimized).toBe(0);
  });

  it('minimizes the app from the home screen or the login', async () => {
    url = '/pasajero?x=1';
    await setup().handle();
    url = '/login';
    home.set(null);
    await TestBed.inject(BackButtonService).handle();
    expect(minimized).toBe(2);
    expect(navigated).toEqual([]);
  });
});
