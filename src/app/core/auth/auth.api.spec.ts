import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '@core/config/app-config';

import { AuthApi } from './auth.api';

const API = 'http://api.test/api';
const user = { id: 2, name: 'Juan Pérez', email: 'cliente@uber.com', role: 'client', status: 'active' };

describe('AuthApi', () => {
  let api: AuthApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: API } },
      ],
    });
    api = TestBed.inject(AuthApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('logs in with email or phone', async () => {
    const result = api.login({ login: '3001234567', password: 'cliente123' });
    const req = backend.expectOne(`${API}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ login: '3001234567', password: 'cliente123' });
    req.flush({ success: true, access_token: 'jwt', expires_in: 3600, user });

    expect((await result).access_token).toBe('jwt');
  });

  it('registers a driver with the vehicle fields', async () => {
    const payload = {
      role: 'driver' as const,
      name: 'Carlos Ruiz',
      email: 'carlos@correo.com',
      phone: '3105550192',
      password: 'clave1234',
      license_number: 'LC-1',
      plate: 'KZT482',
      brand: 'Chevrolet',
      model: 'Onix',
      year: 2022,
      capacity: 4,
      color: 'Gris',
    };
    const result = api.register(payload);
    const req = backend.expectOne(`${API}/auth/register`);
    expect(req.request.body).toEqual(payload);
    req.flush({ success: true, access_token: 'jwt', expires_in: 3600, user });
    await result;
  });

  it('unwraps the user from /auth/me', async () => {
    const result = api.me();
    backend.expectOne(`${API}/auth/me`).flush({ success: true, user });

    expect(await result).toEqual(user);
  });

  it('sends the token explicitly on logout, because the local session is already cleared', async () => {
    const result = api.logout('jwt-123');
    const req = backend.expectOne(`${API}/auth/logout`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    req.flush({ success: true });
    await result;
  });

  it('resets the password with the email and the new password', async () => {
    const result = api.forgotPassword({ email: 'cliente@uber.com', new_password: 'nueva1234' });
    const req = backend.expectOne(`${API}/auth/forgot-password`);
    expect(req.request.body).toEqual({ email: 'cliente@uber.com', new_password: 'nueva1234' });
    req.flush({ success: true, message: 'ok' });

    expect((await result).success).toBe(true);
  });
});
