import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '@core/auth/auth.store';
import { APP_CONFIG } from '@core/config/app-config';
import { catchError, throwError } from 'rxjs';

import { ApiError } from './api-error';

/** Agrega el token JWT y `Accept: application/json` a las peticiones dirigidas a la API. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(inject(APP_CONFIG).apiBaseUrl)) return next(req);
  const token = inject(AuthStore).token();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token && !req.headers.has('Authorization')) headers['Authorization'] = `Bearer ${token}`;
  return next(req.clone({ setHeaders: headers }));
};

/**
 * Convierte cualquier error HTTP en ApiError. Un 401 en una petición autenticada significa que el token
 * venció o fue invalidado: se cierra la sesión. Un 401 sin token (login fallido) solo se informa.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
      if (error.status === 401 && req.headers.has('Authorization')) void store.expire(router.url);
      return throwError(() => ApiError.from(error));
    }),
  );
};
