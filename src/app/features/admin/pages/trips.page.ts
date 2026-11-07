import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '@core/http/api-error';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { PageHeaderComponent } from '@layout/page-header.component';
import { TRIP_STATUS, TRIP_STATUSES, type TripStatus } from '@shared/models/trip-status';
import { CurrencyCopPipe } from '@shared/pipes/format.pipes';
import { StatusPillComponent } from '@shared/ui/status-pill/status-pill.component';
import { ToastService } from '@shared/ui/toast/toast.service';

import { AdminApi } from '../data-access/admin.api';
import type { AdminTrip, Page, TripFilters } from '../data-access/admin.models';

/** Viajes de la plataforma (HU-09) con filtros sincronizados a la URL: estado, conductor, pasajero y fecha. */
@Component({
  selector: 'app-admin-trips',
  imports: [DatePipe, IonButton, IonContent, PageHeaderComponent, CurrencyCopPipe, StatusPillComponent],
  template: `
    <app-page-header title="Viajes" />
    <ion-content>
      <main class="adm-page">
        <form class="adm-filters" (submit)="$event.preventDefault()" aria-label="Filtros de viajes">
          <label>
            Estado
            <select [value]="status() ?? ''" (change)="apply({ status: $any($event.target).value })">
              <option value="" [selected]="!status()">Todos</option>
              @for (s of statuses; track s) {
                <option [value]="s" [selected]="s === status()">{{ labels[s].label }}</option>
              }
            </select>
          </label>
          <label>
            Fecha
            <input type="date" [value]="date() ?? ''" (change)="apply({ date: $any($event.target).value })" />
          </label>
          <label>
            ID conductor
            <input
              type="number"
              inputmode="numeric"
              min="1"
              [value]="driver_id() ?? ''"
              (change)="apply({ driver_id: $any($event.target).value })"
            />
          </label>
          <label>
            ID pasajero
            <input
              type="number"
              inputmode="numeric"
              min="1"
              [value]="client_id() ?? ''"
              (change)="apply({ client_id: $any($event.target).value })"
            />
          </label>
          <ion-button fill="clear" color="dark" (click)="clear()">Limpiar</ion-button>
        </form>

        <div class="adm-table-wrap" tabindex="0" role="region" aria-label="Tabla de viajes">
          <table class="adm-table">
            <thead>
              <tr>
                <th class="num">#</th>
                <th>Fecha</th>
                <th>Ruta</th>
                <th>Pasajero</th>
                <th>Conductor</th>
                <th>Estado</th>
                <th class="num">Tarifa</th>
              </tr>
            </thead>
            <tbody>
              @for (t of result().items; track t.id) {
                <tr>
                  <td class="num">{{ t.id }}</td>
                  <td>{{ t.created_at | date: 'd MMM y, h:mm a' }}</td>
                  <td>
                    {{ t.origin_name ?? '—' }}
                    @if (t.destination_name) {
                      <small>→ {{ t.destination_name }}</small>
                    }
                    @if (t.cancel_reason) {
                      <small>Motivo: {{ t.cancel_reason }}</small>
                    }
                  </td>
                  <td>
                    {{ t.client?.name ?? '#' + t.client_id }}
                    <small>ID {{ t.client?.id ?? t.client_id }}</small>
                  </td>
                  <td>
                    {{ t.driver?.user?.name ?? '#' + t.driver_id }}
                    @if (t.vehicle?.plate; as plate) {
                      <small class="mono">{{ plate }}</small>
                    }
                  </td>
                  <td><app-status-pill [status]="t.status" /></td>
                  <td class="num">{{ t.final_fare ?? t.estimated_fare ?? 0 | currencyCop }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="adm-empty">
                    {{ loading() ? 'Cargando viajes…' : 'No hay viajes con estos filtros.' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <nav class="adm-pager" aria-label="Páginas">
          <ion-button
            fill="clear"
            color="dark"
            [disabled]="result().page <= 1"
            (click)="apply({ page: result().page - 1 })"
            >Anterior</ion-button
          >
          <span>
            Página {{ result().page }} de {{ result().lastPage }}
            @if (result().total !== null) {
              · {{ result().total }} viajes
            }
          </span>
          <ion-button
            fill="clear"
            color="dark"
            [disabled]="result().page >= result().lastPage"
            (click)="apply({ page: result().page + 1 })"
          >
            Siguiente
          </ion-button>
        </nav>
      </main>
    </ion-content>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTripsPage {
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  // Query params enlazados a inputs (withComponentInputBinding): la URL es la fuente de los filtros.
  readonly status = input<TripStatus | ''>();
  readonly driver_id = input<string>();
  readonly client_id = input<string>();
  readonly date = input<string>();
  readonly page = input<string>();

  protected readonly statuses = TRIP_STATUSES;
  protected readonly labels = TRIP_STATUS;
  protected readonly loading = signal(true);
  protected readonly result = signal<Page<AdminTrip>>({ items: [], page: 1, lastPage: 1, total: null });

  constructor() {
    effect(() => {
      const filters: TripFilters = {
        status: this.status() ?? '',
        driver_id: this.driver_id(),
        client_id: this.client_id(),
        date: this.date(),
        page: Number(this.page()) || 1,
      };
      untracked(() => void this.load(filters));
    });
  }

  /** Cambiar un filtro vuelve a la primera página; cambiar de página conserva los filtros. */
  protected apply(change: Partial<Record<keyof TripFilters, string | number>>): void {
    const queryParams: Record<string, string | number | null> = { page: null };
    for (const [key, value] of Object.entries(change)) queryParams[key] = value === '' ? null : value;
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }

  protected clear(): void {
    void this.router.navigate([], { queryParams: {} });
  }

  private async load(filters: TripFilters): Promise<void> {
    this.loading.set(true);
    try {
      this.result.set(await this.api.trips(filters));
    } catch (error) {
      void this.toast.error(error instanceof ApiError ? error.message : 'No pudimos cargar los viajes.');
    } finally {
      this.loading.set(false);
    }
  }
}
