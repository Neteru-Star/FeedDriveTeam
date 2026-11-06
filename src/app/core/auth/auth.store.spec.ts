import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ToastService } from '@shared/ui/toast/toast.service';

import { AuthApi } from './auth.api';
import type { AuthResponse, StoredSession } from './auth.models';
import { AuthStore } from './auth.store';
import { TokenStorage } from './token-storage';

const user = { id: 2, name: 'Juan Pérez', email: 'cliente@uber.com', role: 'client' as const, status: 'active' };
const response: AuthResponse = {
  success: true,
  message: 'ok',
  access_token: 'jwt-1',
  token_type: 'bearer',
  expires_in: 3600,
  user,
};

describe('AuthStore', () => {
  let saved: StoredSession | null;
  const api = { login: vi.fn(), register: vi.fn(), me: vi.fn(), logout: vi.fn() };
  const toast = { info: vi.fn(), error: vi.fn(), success: vi.fn() };
  const storage = {
    load: vi.fn(async () => saved),
    save: vi.fn(async (s: StoredSession) => void (saved = s)),
    clear: vi.fn(async () => void (saved = null)),
  };

  function setup(): AuthStore {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthApi, useValue: api },
        { provide: TokenStorage, useValue: storage },
        { provide: ToastService, useValue: toast },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    return TestBed.inject(AuthStore);
  }

  beforeEach(() => {
    saved = null;
    vi.clearAllMocks();
    api.me.mockResolvedValue(user);
    api.logout.mockResolvedValue({});
  });

  afterEach(() => vi.useRealTimers());

  it('saves the session with its expiry after login', async () => {
    api.login.mockResolvedValue(response);
    const store = setup();

    await store.login({ login: 'cliente@uber.com', password: 'cliente123' });

    expect(store.isAuthenticated()).toBe(true);
    expect(store.home()).toBe('/pasajero');
    expect(saved?.token).toBe('jwt-1');
    expect(saved!.expiresAt).toBeGreaterThan(Date.now() + 3500_000);
  });

  it('restores a saved session after restarting the app', async () => {
    saved = { token: 'jwt-1', expiresAt: Date.now() + 600_000, user };
    const store = setup();

    await store.restore();

    expect(store.token()).toBe('jwt-1');
    expect(api.me).toHaveBeenCalled();
  });

  it('discards an expired saved session', async () => {
    saved = { token: 'old', expiresAt: Date.now() - 1, user };
    const store = setup();

    await store.restore();

    expect(store.isAuthenticated()).toBe(false);
    expect(storage.clear).toHaveBeenCalled();
  });

  it('logs out locally even if the backend call fails', async () => {
    api.login.mockResolvedValue(response);
    api.logout.mockRejectedValue(new Error('offline'));
    const store = setup();
    await store.login({ login: 'x', password: 'y' });

    await store.logout();

    expect(store.isAuthenticated()).toBe(false);
    expect(saved).toBeNull();
    expect(api.logout).toHaveBeenCalledWith('jwt-1');
  });

  it('warns 2 minutes before the token expires and closes the session when it does', async () => {
    vi.useFakeTimers();
    api.login.mockResolvedValue({ ...response, expires_in: 300 });
    const store = setup();
    await store.login({ login: 'x', password: 'y' });

    await vi.advanceTimersByTimeAsync(180_000);
    expect(toast.info).toHaveBeenCalledWith('Tu sesión vence en 2 minutos.');
    expect(store.isAuthenticated()).toBe(true);

    await vi.advanceTimersByTimeAsync(120_000);
    expect(store.isAuthenticated()).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });
});
