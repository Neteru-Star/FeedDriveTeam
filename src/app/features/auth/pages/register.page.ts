import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { RegisterPayload } from '@core/auth/auth.models';
import { AuthStore } from '@core/auth/auth.store';
import { ApiError } from '@core/http/api-error';
import { IonButton } from '@ionic/angular/ion-button';
import { applyServerErrors } from '@shared/forms/server-errors';
import { AppValidators } from '@shared/forms/validators';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';

import { AuthLayoutComponent } from '../ui/auth-layout.component';

type RegisterRole = 'client' | 'driver';

const MAX_YEAR = new Date().getFullYear() + 1;

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, IonButton, AuthLayoutComponent, TextFieldComponent],
  template: `
    <app-auth-layout backLink="/login">
      <h1>Crea tu cuenta</h1>

      <div class="roles" role="group" aria-label="Tipo de cuenta">
        <button
          type="button"
          [class.on]="role() === 'client'"
          [attr.aria-pressed]="role() === 'client'"
          (click)="setRole('client')"
        >
          Pasajero
        </button>
        <button
          type="button"
          [class.on]="role() === 'driver'"
          [attr.aria-pressed]="role() === 'driver'"
          (click)="setRole('driver')"
        >
          Conductor
        </button>
      </div>
      <p class="app-muted hint">
        @if (role() === 'client') {
          Como pasajero solo necesitas tus datos personales.
        } @else {
          Paso {{ step() }} de 2 · {{ step() === 1 ? 'tus datos' : 'tu vehículo' }}. Un administrador aprobará tu
          cuenta.
        }
      </p>

      <form [formGroup]="form" (ngSubmit)="next()" novalidate>
        @if (step() === 1) {
          <app-text-field [control]="account.controls.name" label="Nombre completo" autocomplete="name" />
          <app-text-field
            [control]="account.controls.email"
            label="Correo"
            type="email"
            autocomplete="email"
            inputmode="email"
          />
          <app-text-field
            [control]="account.controls.phone"
            label="Celular"
            type="tel"
            autocomplete="tel"
            inputmode="tel"
            helper="10 dígitos, por ejemplo 3014442210"
          />
          <app-text-field
            [control]="account.controls.password"
            label="Contraseña"
            type="password"
            autocomplete="new-password"
            helper="Mínimo 8 caracteres"
          />
        } @else {
          <app-text-field [control]="vehicle.controls.license_number" label="Número de licencia" autocomplete="off" />
          <div class="pair">
            <app-text-field [control]="vehicle.controls.plate" label="Placa" autocomplete="off" placeholder="KZT-482" />
            <app-text-field [control]="vehicle.controls.color" label="Color" autocomplete="off" />
          </div>
          <div class="pair">
            <app-text-field [control]="vehicle.controls.brand" label="Marca" autocomplete="off" />
            <app-text-field [control]="vehicle.controls.model" label="Modelo" autocomplete="off" />
          </div>
          <div class="pair">
            <app-text-field [control]="vehicle.controls.year" label="Año" type="number" inputmode="numeric" />
            <app-text-field [control]="vehicle.controls.capacity" label="Pasajeros" type="number" inputmode="numeric" />
          </div>
        }

        <ion-button type="submit" expand="block" [disabled]="loading()">{{ submitLabel() }}</ion-button>
        @if (step() === 2) {
          <ion-button fill="clear" color="dark" expand="block" (click)="step.set(1)">Volver a mis datos</ion-button>
        }
        @if (error()) {
          <p class="app-banner app-banner--error" role="alert">{{ error() }}</p>
        }
      </form>

      <p class="switch app-muted">¿Ya tienes cuenta? <a routerLink="/login" class="app-link">Inicia sesión</a></p>
    </app-auth-layout>
  `,
  styles: `
    h1 {
      margin: 0 0 16px;
      font-size: 28px;
    }
    .roles {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      padding: 4px;
      border-radius: 14px;
      background: color-mix(in srgb, var(--color-ink) 6%, transparent);
    }
    .roles button {
      padding: 10px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: var(--color-muted);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition:
        background var(--motion-fast),
        color var(--motion-fast);
    }
    .roles button.on {
      background: var(--color-ink);
      color: var(--color-surface);
    }
    .hint {
      margin: 8px 0 18px;
      font-size: 13px;
    }
    .pair {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    ion-button {
      margin-bottom: 8px;
    }
    .switch {
      margin: 10px 0 0;
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly role = signal<RegisterRole>('client');
  protected readonly step = signal<1 | 2>(1);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly submitLabel = computed(() => {
    if (this.loading()) return 'Creando cuenta…';
    return this.role() === 'driver' && this.step() === 1 ? 'Siguiente' : 'Crear cuenta';
  });

  protected readonly account = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, AppValidators.email]],
    phone: ['', [Validators.required, AppValidators.phone]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly vehicle = this.fb.group({
    license_number: ['', [Validators.required, Validators.maxLength(50)]],
    plate: ['', [Validators.required, AppValidators.plate]],
    brand: ['', Validators.required],
    model: ['', Validators.required],
    color: ['', Validators.required],
    year: ['', [Validators.required, Validators.min(1990), Validators.max(MAX_YEAR)]],
    capacity: ['4', [Validators.required, Validators.min(1), Validators.max(8)]],
  });

  /** Los dos pasos juntos, para ubicar los errores 422 del backend en cualquiera de ellos. */
  protected readonly form = this.fb.group({ account: this.account, vehicle: this.vehicle });

  protected setRole(role: RegisterRole): void {
    this.role.set(role);
    this.step.set(1);
    this.error.set('');
  }

  protected async next(): Promise<void> {
    if (this.step() === 1) {
      this.account.markAllAsTouched();
      if (this.account.invalid) return;
      if (this.role() === 'driver') {
        this.step.set(2);
        return;
      }
    } else {
      this.vehicle.markAllAsTouched();
      if (this.vehicle.invalid) return;
    }
    await this.submit();
  }

  private async submit(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.store.register(this.payload());
      await this.router.navigate(['/login'], { queryParams: { registered: 1 } });
    } catch (e) {
      this.handleError(e);
    } finally {
      this.loading.set(false);
    }
  }

  private payload(): RegisterPayload {
    const a = this.account.getRawValue();
    const base = {
      name: a.name.trim(),
      email: a.email.trim().toLowerCase(),
      phone: a.phone.trim(),
      password: a.password,
    };
    if (this.role() === 'client') return { ...base, role: 'client' };
    const v = this.vehicle.getRawValue();
    return {
      ...base,
      role: 'driver',
      license_number: v.license_number.trim(),
      plate: v.plate.trim().toUpperCase(),
      brand: v.brand.trim(),
      model: v.model.trim(),
      color: v.color.trim(),
      year: Number(v.year),
      capacity: Number(v.capacity),
    };
  }

  private handleError(e: unknown): void {
    if (!(e instanceof ApiError)) {
      this.error.set('Ocurrió un error inesperado. Inténtalo de nuevo.');
      return;
    }
    if (e.status !== 422) {
      this.error.set(e.message);
      return;
    }
    const missing = applyServerErrors(this.form, e);
    // Si el error está en los datos personales y el conductor ya va en el paso 2, vuelve al paso 1 para verlo.
    if (this.account.invalid) this.step.set(1);
    this.error.set(missing[0] ?? '');
  }
}
