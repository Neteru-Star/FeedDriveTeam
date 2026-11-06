import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthApi } from '@core/auth/auth.api';
import { ApiError } from '@core/http/api-error';
import { IonButton } from '@ionic/angular/ion-button';
import { applyServerErrors } from '@shared/forms/server-errors';
import { AppValidators } from '@shared/forms/validators';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';
import { ToastService } from '@shared/ui/toast/toast.service';

import { AuthLayoutComponent } from '../ui/auth-layout.component';

/** El backend cambia la clave solo con el correo, sin código de verificación (riesgo reportado en la documentación). */
@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, IonButton, AuthLayoutComponent, TextFieldComponent],
  template: `
    <app-auth-layout backLink="/login">
      <h1>Restablece tu contraseña</h1>
      <p class="app-muted intro">Escribe el correo de tu cuenta y la nueva contraseña.</p>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-text-field
          [control]="form.controls.email"
          label="Correo"
          type="email"
          autocomplete="email"
          inputmode="email"
        />
        <app-text-field
          [control]="form.controls.password"
          label="Nueva contraseña"
          type="password"
          autocomplete="new-password"
          helper="Mínimo 8 caracteres"
        />
        <app-text-field
          [control]="form.controls.confirm"
          label="Repite la contraseña"
          type="password"
          autocomplete="new-password"
        />
        <ion-button type="submit" expand="block" [disabled]="loading()">
          {{ loading() ? 'Guardando…' : 'Cambiar contraseña' }}
        </ion-button>
        @if (error()) {
          <p class="app-banner app-banner--error" role="alert">{{ error() }}</p>
        }
      </form>
    </app-auth-layout>
  `,
  styles: `
    h1 {
      margin: 0;
      font-size: 26px;
    }
    .intro {
      margin: 6px 0 20px;
    }
    ion-button {
      margin: 6px 0 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPage {
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      email: ['', [Validators.required, AppValidators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required],
    },
    { validators: AppValidators.matches('password', 'confirm') },
  );

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    try {
      await this.api.forgotPassword({ email: email.trim().toLowerCase(), new_password: password });
      void this.toast.success('Contraseña actualizada. Ya puedes iniciar sesión.');
      await this.router.navigateByUrl('/login');
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        this.error.set(applyServerErrors(this.form, e)[0] ?? '');
      } else {
        this.error.set(e instanceof ApiError ? e.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
