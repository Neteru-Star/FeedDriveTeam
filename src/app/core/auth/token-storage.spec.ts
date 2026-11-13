import { TestBed } from '@angular/core/testing';
import { IS_NATIVE_PLATFORM } from '@core/location/location.service';

import { TokenStorage } from './token-storage';

// Capacitor Preferences guarda en localStorage con el prefijo "CapacitorStorage." cuando corre en la web.
const SHARED_KEY = 'CapacitorStorage.feeddrive.session';
const TAB_KEY = 'feeddrive.session';
const session = {
  token: 'jwt-1',
  expiresAt: 1_900_000_000_000,
  user: { id: 2, name: 'Juan Pérez', email: 'cliente@uber.com', role: 'client' as const, status: 'active' },
};

describe('TokenStorage', () => {
  function setup(isNative: boolean): TokenStorage {
    TestBed.configureTestingModule({ providers: [{ provide: IS_NATIVE_PLATFORM, useValue: isNative }] });
    return TestBed.inject(TokenStorage);
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps the web session in the tab, not shared with other tabs', async () => {
    const storage = setup(false);

    await storage.save(session);

    expect(JSON.parse(sessionStorage.getItem(TAB_KEY)!)).toEqual(session);
    expect(localStorage.getItem(SHARED_KEY)).toBeNull();
    expect(await storage.load()).toEqual(session);

    await storage.clear();
    expect(await storage.load()).toBeNull();
  });

  it('removes the shared session left by previous versions', async () => {
    localStorage.setItem(SHARED_KEY, JSON.stringify(session));
    const storage = setup(false);

    expect(await storage.load()).toBeNull();
    expect(localStorage.getItem(SHARED_KEY)).toBeNull();
  });

  it('uses Capacitor Preferences on the phone', async () => {
    const storage = setup(true);

    await storage.save(session);

    expect(JSON.parse(localStorage.getItem(SHARED_KEY)!)).toEqual(session);
    expect(await storage.load()).toEqual(session);
    await storage.clear();
    expect(localStorage.getItem(SHARED_KEY)).toBeNull();
  });

  it('discards a corrupted session instead of failing', async () => {
    sessionStorage.setItem(TAB_KEY, '{no es json');
    const storage = setup(false);

    expect(await storage.load()).toBeNull();
    expect(sessionStorage.getItem(TAB_KEY)).toBeNull();
  });
});
