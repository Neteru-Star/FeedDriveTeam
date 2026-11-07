import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import type { RefresherCustomEvent } from '@ionic/core';
import { PageHeaderComponent } from '@layout/page-header.component';
import { CurrencyCopPipe } from '@shared/pipes/format.pipes';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state.component';
import { StatusPillComponent } from '@shared/ui/status-pill/status-pill.component';

import { AdminApi } from '../data-access/admin.api';
import type { Dashboard } from '../data-access/admin.models';

/** Panel del administrador (HU-09): indicadores, viajes recientes e incidencias. */
@Component({
  selector: 'app-admin-dashboard',
  imports: [
    DatePipe,
    RouterLink,
    IonButton,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    PageHeaderComponent,
    CurrencyCopPipe,
    EmptyStateComponent,
    StatusPillComponent,
  ],
  template: `
    <app-page-header title="Dashboard" />
    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>
      <main class="adm-page">
        @if (data(); as d) {
          <section class="adm-kpis" aria-label="Indicadores">
            <div class="adm-kpi accent wide">
              <span>Ingresos totales</span>
              <strong>{{ d.stats.total_revenue | currencyCop }}</strong>
              <small>{{ d.stats.completed_trips }} viajes completados</small>
            </div>
            <a class="adm-kpi" routerLink="/admin/viajes" [queryParams]="{ status: 'in_progress' }">
              <span>Viajes activos</span>
              <strong>{{ d.stats.active_trips }}</strong>
              <small>{{ d.stats.pending_requests }} solicitudes esperando</small>
            </a>
            <a class="adm-kpi" routerLink="/admin/viajes" [queryParams]="{ status: 'cancelled' }">
              <span>Cancelados</span>
              <strong>{{ d.stats.cancelled_trips }}</strong>
            </a>
            <div class="adm-kpi">
              <span>Pasajeros</span>
              <strong>{{ d.stats.total_clients }}</strong>
            </div>
            <a class="adm-kpi" routerLink="/admin/conductores">
              <span>Conductores</span>
              <strong>{{ d.stats.total_drivers }}</strong>
              <small>{{ d.stats.approved_drivers }} aprobados</small>
            </a>
            <a
              class="adm-kpi"
              [class.warn]="d.stats.pending_drivers > 0"
              routerLink="/admin/conductores"
              [queryParams]="{ estado: 'pending' }"
            >
              <span>Por aprobar</span>
              <strong>{{ d.stats.pending_drivers }}</strong>
              <small>Revisar documentos</small>
            </a>
          </section>

          <div class="adm-grid">
            <section class="adm-card">
              <h2>Viajes recientes</h2>
              @if (d.recentTrips.length) {
                <ul class="list">
                  @for (t of d.recentTrips; track t.id) {
                    <li>
                      <div>
                        <strong>{{ t.origin_name ?? 'Viaje #' + t.id }}</strong>
                        @if (t.destination_name) {
                          <small>→ {{ t.destination_name }}</small>
                        }
                        <small>{{ t.created_at | date: 'd MMM, h:mm a' }}</small>
                      </div>
                      <div class="right">
                        <app-status-pill [status]="t.status" />
                        <span class="mono">{{ t.final_fare ?? t.estimated_fare ?? 0 | currencyCop }}</span>
                      </div>
                    </li>
                  }
                </ul>
                <ion-button fill="clear" color="dark" size="small" routerLink="/admin/viajes"
                  >Ver todos los viajes</ion-button
                >
              } @else {
                <p class="adm-empty">Aún no hay viajes.</p>
              }
            </section>
            <section class="adm-card">
              <h2>Incidencias recientes</h2>
              @if (d.recentIncidents.length) {
                <ul class="list">
                  @for (i of d.recentIncidents; track i.id) {
                    <li>
                      <div>
                        <strong>Viaje #{{ i.trip_id }}</strong>
                        <small>{{ i.description }}</small>
                        <small>{{ i.created_at | date: 'd MMM, h:mm a' }}</small>
                      </div>
                      <span class="adm-badge" [attr.data-status]="i.status === 'open' ? 'pending' : 'approved'">
                        {{ i.status === 'open' ? 'Abierta' : i.status }}
                      </span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="adm-empty">Sin incidencias reportadas.</p>
              }
            </section>
          </div>
        } @else if (failed()) {
          <app-empty-state title="No pudimos cargar el panel" message="Revisa tu conexión e inténtalo de nuevo.">
            <ion-button (click)="load()">Reintentar</ion-button>
          </app-empty-state>
        } @else {
          <div class="adm-kpis" aria-busy="true" aria-label="Cargando indicadores">
            @for (n of [1, 2, 3, 4, 5, 6]; track n) {
              <div class="adm-kpi"><ion-skeleton-text [animated]="true" style="height: 48px" /></div>
            }
          </div>
        }
      </main>
    </ion-content>
  `,
  styles: `
    .list {
      display: grid;
      gap: 10px;
      margin: 0 0 8px;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--color-card-border);
    }
    li:last-child {
      border-bottom: 0;
    }
    li small {
      display: block;
      font-size: 12px;
      color: var(--color-muted);
    }
    .right {
      display: grid;
      justify-items: end;
      gap: 6px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPage {
  private readonly api = inject(AdminApi);
  protected readonly data = signal<Dashboard | null>(null);
  protected readonly failed = signal(false);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.failed.set(false);
    try {
      this.data.set(await this.api.dashboard());
    } catch {
      this.failed.set(true);
    }
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.load();
    await event.target.complete();
  }
}
