import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthStore } from '@core/auth/auth.store';
import { APP_CONFIG } from '@core/config/app-config';
import { firstValueFrom } from 'rxjs';

import { ApiError } from './api-error';
import { authInterceptor, errorInterceptor } from './interceptors';

const API = 'http://api.test/api';

describe('HTTP interceptors', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const token = signal<string | null>('jwt-123');
  const expire = vi.fn();

  beforeEach(() => {
    token.set('jwt-123');
    expire.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: API } },
        { provide: AuthStore, useValue: { token, expire } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  async function failWith(status: number, body: object, url = `${API}/client/active`): Promise<ApiError> {
    const request = firstValueFrom(http.get(url));
    backend.expectOne(url).flush(body, { status, statusText: 'Error' });
    try {
      await request;
    } catch (e) {
      return e as ApiError;
    }
    throw new Error('la petición debía fallar');
  }

  it('adds the bearer token and JSON accept header to API calls', () => {
    http.get(`${API}/auth/me`).subscribe();
    const req = backend.expectOne(`${API}/auth/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush({});
  });

  it('does not send the token to other hosts', () => {
    http.get('https://nominatim.openstreetmap.org/search').subscribe();
    const req = backend.expectOne('https://nominatim.openstreetmap.org/search');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('closes the session on 401 for an authenticated request', async () => {
    const error = await failWith(401, { message: 'Unauthenticated.' });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(expire).toHaveBeenCalledOnce();
  });

  it('only reports a 401 from a failed login', async () => {
    token.set(null);
    const error = await failWith(401, { success: false, message: 'Credenciales inválidas' }, `${API}/auth/login`);
    expect(error.message).toBe('Credenciales inválidas');
    expect(expire).not.toHaveBeenCalled();
  });

  it('maps a 422 to messages per field', async () => {
    const error = await failWith(422, {
      message: 'The email has already been taken.',
      errors: { email: ['The email has already been taken.'], phone: ['El campo phone es obligatorio.'] },
    });
    expect(error.status).toBe(422);
    expect(error.fieldErrors).toEqual({ email: 'El correo ya está en uso.', phone: 'El campo phone es obligatorio.' });
  });

  it('keeps the backend message and extra data on 403', async () => {
    const error = await failWith(403, {
      success: false,
      message: 'Solo conductores aprobados pueden activar su disponibilidad.',
      approval_status: 'pending',
    });
    expect(error.message).toBe('Solo conductores aprobados pueden activar su disponibilidad.');
    expect(error.body['approval_status']).toBe('pending');
    expect(expire).not.toHaveBeenCalled();
  });

  it('explains a network failure', async () => {
    const request = firstValueFrom(http.get(`${API}/fares/active`));
    backend.expectOne(`${API}/fares/active`).error(new ProgressEvent('error'), { status: 0 });
    await expect(request).rejects.toMatchObject({ status: 0, message: expect.stringContaining('No hay conexión') });
  });
});
