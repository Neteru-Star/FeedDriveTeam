import { TestBed } from '@angular/core/testing';

import { TokenStorage } from './token-storage';

// En la web, Capacitor Preferences guarda en localStorage con el prefijo "CapacitorStorage.".
const KEY = 'CapacitorStorage.feeddrive.session';
const session = {
  token: 'jwt-1',
  expiresAt: 1_900_000_000_000,
  user: { id: 2, name: 'Juan Pérez', email: 'cliente@uber.com', role: 'client' as const, status: 'active' },
};

describe('TokenStorage', () => {
  let storage: TokenStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = TestBed.inject(TokenStorage);
  });

  it('saves, loads and clears the session', async () => {
    await storage.save(session);
    expect(await storage.load()).toEqual(session);

    await storage.clear();
    expect(await storage.load()).toBeNull();
  });

  it('discards a corrupted session instead of failing', async () => {
    localStorage.setItem(KEY, '{no es json');

    expect(await storage.load()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
