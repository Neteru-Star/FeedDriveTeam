import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ROLE_HOME } from '@core/auth/auth.models';
import { AuthStore } from '@core/auth/auth.store';
import { ApiError } from '@core/http/api-error';
import { IonButton } from '@ionic/angular/ion-button';
import { NavController } from '@ionic/angular/nav-controller';
import { applyServerErrors } from '@shared/forms/server-errors';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';

import { AuthLayoutComponent } from '../ui/auth-layout.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, IonButton, AuthLayoutComponent, TextFieldComponent],
  template: `
    <app-auth-layout>
      @if (registered()) {
        <p class="app-banner app-banner--success" role="status">Cuenta creada. Ya puedes iniciar sesión.</p>
      }
      <h1>Bienvenido de nuevo</h1>
      <p class="app-muted intro">Inicia sesión para pedir o atender un viaje.</p>

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-text-field
          [control]="form.controls.login"
          label="Correo o teléfono"
          autocomplete="username"
          inputmode="email"
        />
        <app-text-field
          [control]="form.controls.password"
          label="Contraseña"
          type="password"
          autocomplete="current-password"
        />
        <a routerLink="/recuperar-clave" class="forgot app-link">¿Olvidaste tu contraseña?</a>

        <ion-button type="submit" expand="block" [disabled]="loading()">
          {{ loading() ? 'Ingresando…' : 'Iniciar sesión' }}
        </ion-button>
        @if (error()) {
          <p class="app-banner app-banner--error" role="alert">{{ error() }}</p>
        }
      </form>

      <p class="switch app-muted">¿No tienes cuenta? <a routerLink="/registro" class="app-link">Regístrate</a></p>
    </app-auth-layout>
  `,
  styles: `
    h1 {
      margin: 0;
      font-size: 28px;
    }
    .intro {
      margin: 6px 0 20px;
    }
    .forgot {
      display: block;
      margin: 0 0 18px;
      text-align: right;
      font-size: 14px;
    }
    ion-button {
      margin-bottom: 14px;
    }
    .switch {
      margin: 6px 0 0;
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly store = inject(AuthStore);
  private readonly nav = inject(NavController);

  /** Query params (withComponentInputBinding). */
  readonly returnUrl = input<string>();
  readonly registered = input<string>();

  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(NonNullableFormBuilder).group({
    login: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const user = await this.store.login({ ...this.form.getRawValue(), login: this.form.value.login?.trim() ?? '' });
      // Raíz nueva: el botón atrás no vuelve al login.
      await this.nav.navigateRoot(this.safeReturnUrl() ?? ROLE_HOME[user.role]);
    } catch (e) {
      this.error.set(this.messageFor(e));
    } finally {
      this.loading.set(false);
    }
  }

  private messageFor(e: unknown): string {
    if (!(e instanceof ApiError)) return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
    if (e.status === 401) return 'Correo o contraseña incorrectos';
    if (e.status === 422) return applyServerErrors(this.form, e)[0] ?? '';
    return e.message;
  }

  /** Solo rutas internas, para no redirigir a otro sitio. */
  private safeReturnUrl(): string | null {
    const url = this.returnUrl();
    return url && url.startsWith('/') && !url.startsWith('//') ? url : null;
  }
}
