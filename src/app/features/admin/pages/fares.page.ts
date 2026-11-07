import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '@core/http/api-error';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { PageHeaderComponent } from '@layout/page-header.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { CurrencyCopPipe } from '@shared/pipes/format.pipes';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';
import { ToastService } from '@shared/ui/toast/toast.service';

import { AdminApi } from '../data-access/admin.api';
import { previewFare, type Fare, type NewFare } from '../data-access/admin.models';

/** Viajes de ejemplo para la vista previa: corto, típico y largo. */
const SAMPLES = [
  { label: '2 km · 6 min', km: 2, min: 6 },
  { label: '5 km · 15 min', km: 5, min: 15 },
  { label: '12 km · 35 min', km: 12, min: 35 },
];

/** Tarifas (HU-09): listado y creación con vista previa del cálculo. */
@Component({
  selector: 'app-admin-fares',
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonContent,
    IonToggle,
    PageHeaderComponent,
    CurrencyCopPipe,
    TextFieldComponent,
  ],
  template: `
    <app-page-header title="Tarifas" />
    <ion-content>
      <main class="adm-page">
        <div class="adm-table-wrap" tabindex="0" role="region" aria-label="Tabla de tarifas">
          <table class="adm-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th class="num">Base</th>
                <th class="num">Por km</th>
                <th class="num">Por minuto</th>
                <th class="num">Mínima</th>
                <th class="num">Demanda</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (f of fares(); track f.id) {
                <tr>
                  <td>
                    <strong>{{ f.name }}</strong>
                  </td>
                  <td class="num">{{ f.base_fare | currencyCop }}</td>
                  <td class="num">{{ f.price_per_km | currencyCop }}</td>
                  <td class="num">{{ f.price_per_minute | currencyCop }}</td>
                  <td class="num">{{ f.minimum_fare | currencyCop }}</td>
                  <td class="num">×{{ f.surge_multiplier }}</td>
                  <td>
                    <span class="adm-badge" [attr.data-status]="f.active ? 'active' : ''">{{
                      f.active ? 'Activa' : 'Inactiva'
                    }}</span>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="adm-empty">No hay tarifas configuradas.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="adm-grid">
          <form class="adm-card" [formGroup]="form" (ngSubmit)="create()">
            <h2>Nueva tarifa</h2>
            <div class="adm-form">
              <app-text-field [control]="form.controls.name" label="Nombre" />
              <app-text-field
                [control]="form.controls.base_fare"
                label="Tarifa base ($)"
                type="number"
                inputmode="numeric"
              />
              <app-text-field
                [control]="form.controls.price_per_km"
                label="Precio por km ($)"
                type="number"
                inputmode="numeric"
              />
              <app-text-field
                [control]="form.controls.price_per_minute"
                label="Precio por minuto ($)"
                type="number"
                inputmode="numeric"
              />
              <app-text-field
                [control]="form.controls.minimum_fare"
                label="Tarifa mínima ($)"
                type="number"
                inputmode="numeric"
              />
              <app-text-field
                [control]="form.controls.surge_multiplier"
                label="Multiplicador de demanda"
                type="number"
                inputmode="decimal"
                helper="1 = normal; 1,3 = hora pico"
              />
            </div>
            <ion-toggle [formControl]="form.controls.active" justify="space-between" class="active">
              Activar al crearla (reemplaza la activa)
            </ion-toggle>
            <ion-button type="submit" expand="block" [disabled]="saving()">
              {{ saving() ? 'Guardando…' : 'Crear tarifa' }}
            </ion-button>
          </form>

          <section class="adm-card" aria-live="polite">
            <h2>Vista previa del cálculo</h2>
            <p class="adm-intro">(base + km × precio + minutos × precio) × demanda, sin bajar de la mínima.</p>
            <ul class="adm-bars">
              @for (s of preview(); track s.label) {
                <li>
                  <div class="row">
                    <span>{{ s.label }}</span>
                    <strong class="mono">{{ s.fare | currencyCop }}</strong>
                  </div>
                  @if (s.current !== null) {
                    <small class="app-muted">Con la tarifa activa: {{ s.current | currencyCop }}</small>
                  }
                </li>
              }
            </ul>
          </section>
        </div>
      </main>
    </ion-content>
  `,
  styles: `
    .active {
      margin: 12px 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFaresPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly fares = signal<Fare[]>([]);
  protected readonly saving = signal(false);
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    base_fare: [3800, [Validators.required, Validators.min(0)]],
    price_per_km: [1250, [Validators.required, Validators.min(0)]],
    price_per_minute: [250, [Validators.required, Validators.min(0)]],
    minimum_fare: [6500, [Validators.required, Validators.min(0)]],
    surge_multiplier: [1, [Validators.required, Validators.min(1), Validators.max(5)]],
    active: [true],
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  private readonly activeFare = computed(() => this.fares().find((f) => f.active) ?? null);
  protected readonly preview = computed(() => {
    const v = { ...this.form.getRawValue(), ...this.values() };
    const draft = {
      base_fare: Number(v.base_fare) || 0,
      price_per_km: Number(v.price_per_km) || 0,
      price_per_minute: Number(v.price_per_minute) || 0,
      minimum_fare: Number(v.minimum_fare) || 0,
      surge_multiplier: Number(v.surge_multiplier) || 1,
    };
    const active = this.activeFare();
    return SAMPLES.map((s) => ({
      label: s.label,
      fare: previewFare(draft, s.km, s.min),
      current: active ? previewFare(active, s.km, s.min) : null,
    }));
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      this.fares.set(await this.api.fares());
    } catch (error) {
      void this.toast.error(error instanceof ApiError ? error.message : 'No pudimos cargar las tarifas.');
    }
  }

  protected async create(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    const fare: NewFare = {
      name: v.name.trim(),
      base_fare: Number(v.base_fare),
      price_per_km: Number(v.price_per_km),
      price_per_minute: Number(v.price_per_minute),
      minimum_fare: Number(v.minimum_fare),
      surge_multiplier: Number(v.surge_multiplier),
      active: v.active,
    };
    try {
      await this.api.createFare(fare);
      void this.toast.success(`Tarifa "${fare.name}" creada.`);
      this.form.controls.name.reset('');
      await this.load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) applyServerErrors(this.form, error);
      void this.toast.error(error instanceof ApiError ? error.message : 'No pudimos crear la tarifa.');
    } finally {
      this.saving.set(false);
    }
  }
}
