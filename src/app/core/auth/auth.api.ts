import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '@core/config/app-config';
import { firstValueFrom } from 'rxjs';

import type { AuthResponse, ForgotPasswordPayload, LoginPayload, RegisterPayload, User } from './auth.models';

/** Endpoints de `/api/auth`. Los errores llegan como ApiError gracias al interceptor. */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_CONFIG).apiBaseUrl}/auth`;

  login(payload: LoginPayload): Promise<AuthResponse> {
    return firstValueFrom(this.http.post<AuthResponse>(`${this.base}/login`, payload));
  }

  register(payload: RegisterPayload): Promise<AuthResponse> {
    return firstValueFrom(this.http.post<AuthResponse>(`${this.base}/register`, payload));
  }

  async me(): Promise<User> {
    const res = await firstValueFrom(this.http.get<{ success: boolean; user: User }>(`${this.base}/me`));
    return res.user;
  }

  /** Recibe el token porque la sesión local ya se limpió antes de avisar al backend. */
  logout(token: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.base}/logout`, {}, { headers: { Authorization: `Bearer ${token}` } }));
  }

  forgotPassword(payload: ForgotPasswordPayload): Promise<{ success: boolean; message: string }> {
    return firstValueFrom(
      this.http.post<{ success: boolean; message: string }>(`${this.base}/forgot-password`, payload),
    );
  }
}
