import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiError } from '@core/http/api-error';
import { IonContent } from '@ionic/angular/ion-content';
import { PageHeaderComponent } from '@layout/page-header.component';
import { CurrencyCopPipe } from '@shared/pipes/format.pipes';
import { ToastService } from '@shared/ui/toast/toast.service';

import { AdminApi } from '../data-access/admin.api';
import { APPROVAL_LABEL, type Report } from '../data-access/admin.models';

/** Reportes (HU-09): ingresos, cancelaciones por motivo y desempeño de los conductores, con barras. */
@Component({
  selector: 'app-admin-reports',
  imports: [IonContent, PageHeaderComponent, CurrencyCopPipe],
  template: `
    <app-page-header title="Reportes" />
    <ion-content>
      <main class="adm-page">
        @if (report(); as r) {
          <section class="adm-kpis" aria-label="Resumen">
            <div class="adm-kpi accent">
              <span>Ingresos</span>
              <strong>{{ r.revenue.total | currencyCop }}</strong>
              <small>{{ r.revenue.completed_trips }} viajes completados</small>
            </div>
            <div class="adm-kpi">
              <span>Tarifa promedio</span>
              <strong>{{ r.revenue.average_fare | currencyCop }}</strong>
            </div>
            <div class="adm-kpi" [class.warn]="r.cancellations.rate > 0.2">
              <span>Tasa de cancelación</span>
              <strong>{{ (r.cancellations.rate * 100).toFixed(0) }} %</strong>
              <small>{{ r.cancellations.total }} solicitudes · {{ r.cancellations.cancelled_trips }} viajes</small>
            </div>
          </section>

          <div class="adm-grid">
            <section class="adm-card">
              <h2>Cancelaciones por motivo</h2>
              @if (reasons().length) {
                <ul class="adm-bars">
                  @for (c of reasons(); track c.reason) {
                    <li>
                      <div class="row">
                        <span>{{ c.reason }}</span>
                        <strong class="mono">{{ c.count }}</strong>
                      </div>
                      <div class="track" aria-hidden="true"><div class="fill" [style.width.%]="c.share"></div></div>
                    </li>
                  }
                </ul>
              } @else {
                <p class="adm-empty">Sin cancelaciones.</p>
              }
            </section>
            <section class="adm-card">
              <h2>Ingresos por conductor</h2>
              @if (drivers().length) {
                <ul class="adm-bars">
                  @for (d of drivers(); track d.driver_id) {
                    <li>
                      <div class="row">
                        <span>
                          {{ d.name }}
                          <small class="app-muted"
                            >· {{ d.completed_trips }} viajes · {{ d.rating_average.toFixed(1) }} ★</small
                          >
                        </span>
                        <strong class="mono">{{ d.revenue | currencyCop }}</strong>
                      </div>
                      <div class="track" aria-hidden="true"><div class="fill" [style.width.%]="d.share"></div></div>
                    </li>
                  }
                </ul>
              } @else {
                <p class="adm-empty">Sin conductores.</p>
              }
            </section>
          </div>

          <h2 class="table-title">Desempeño de conductores</h2>
          <div class="adm-table-wrap" tabindex="0" role="region" aria-label="Tabla de desempeño de conductores">
            <table class="adm-table">
              <thead>
                <tr>
                  <th>Conductor</th>
                  <th>Estado</th>
                  <th class="num">Viajes</th>
                  <th class="num">Ingresos</th>
                  <th class="num">Calificación</th>
                </tr>
              </thead>
              <tbody>
                @for (d of drivers(); track d.driver_id) {
                  <tr>
                    <td>{{ d.name }}</td>
                    <td>
                      @if (d.approval_status) {
                        <span class="adm-badge" [attr.data-status]="d.approval_status">{{
                          approval[d.approval_status]
                        }}</span>
                      }
                    </td>
                    <td class="num">{{ d.completed_trips }}</td>
                    <td class="num">{{ d.revenue | currencyCop }}</td>
                    <td class="num">{{ d.rating_average.toFixed(2) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="adm-empty">{{ failed() ? 'No pudimos cargar los reportes.' : 'Generando el reporte…' }}</p>
        }
      </main>
    </ion-content>
  `,
  styles: `
    .table-title {
      margin: 20px 0 10px;
      font-size: 16px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReportsPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);

  protected readonly approval = APPROVAL_LABEL;
  protected readonly report = signal<Report | null>(null);
  protected readonly failed = signal(false);

  /** Motivos de cancelación de mayor a menor, con su proporción para la barra. */
  protected readonly reasons = computed(() => {
    const list = [...(this.report()?.cancellations.by_reason ?? [])].sort((a, b) => b.count - a.count);
    const max = Math.max(1, ...list.map((c) => c.count));
    return list.map((c) => ({ ...c, share: (c.count / max) * 100 }));
  });

  /** Conductores ordenados por ingresos. */
  protected readonly drivers = computed(() => {
    const list = [...(this.report()?.drivers ?? [])].sort((a, b) => b.revenue - a.revenue);
    const max = Math.max(1, ...list.map((d) => d.revenue));
    return list.map((d) => ({ ...d, share: (d.revenue / max) * 100 }));
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.report.set(await this.api.reports());
    } catch (error) {
      this.failed.set(true);
      void this.toast.error(error instanceof ApiError ? error.message : 'No pudimos cargar los reportes.');
    }
  }
}
