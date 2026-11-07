import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiError } from '@core/http/api-error';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { PageHeaderComponent } from '@layout/page-header.component';
import { ToastService } from '@shared/ui/toast/toast.service';

import { AdminApi } from '../data-access/admin.api';
import type { AuditLog } from '../data-access/admin.models';

const normalize = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Registro de auditoría (HU-09): cronológico, con búsqueda y carga de páginas anteriores. */
@Component({
  selector: 'app-admin-audit',
  imports: [DatePipe, IonButton, IonContent, PageHeaderComponent],
  template: `
    <app-page-header title="Auditoría" />
    <ion-content>
      <main class="adm-page">
        <div class="adm-filters">
          <label>
            Buscar
            <input
              type="search"
              placeholder="Acción, usuario o descripción"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
            />
          </label>
        </div>
        <div class="adm-table-wrap">
          <table class="adm-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Descripción</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              @for (log of visible(); track log.id) {
                <tr>
                  <td>{{ log.created_at | date: 'd MMM y, h:mm:ss a' }}</td>
                  <td>{{ log.user?.name ?? 'Sistema' }}</td>
                  <td>
                    <span class="adm-badge">{{ log.action }}</span>
                  </td>
                  <td>
                    {{ log.description }}
                    @if (log.entity_type) {
                      <small>{{ log.entity_type }} #{{ log.entity_id }}</small>
                    }
                  </td>
                  <td class="mono">{{ log.ip_address ?? '—' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="adm-empty">{{ loading() ? 'Cargando registro…' : 'Sin resultados.' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (page() < lastPage()) {
          <div class="adm-pager">
            <span>{{ logs().length }} registros cargados</span>
            <ion-button fill="outline" color="dark" [disabled]="loading()" (click)="loadMore()"
              >Cargar anteriores</ion-button
            >
          </div>
        }
      </main>
    </ion-content>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuditPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);

  protected readonly logs = signal<AuditLog[]>([]);
  protected readonly page = signal(0);
  protected readonly lastPage = signal(1);
  protected readonly loading = signal(false);
  protected readonly query = signal('');

  /** Más reciente primero; la búsqueda ignora tildes y mayúsculas. */
  protected readonly visible = computed(() => {
    const q = normalize(this.query().trim());
    const sorted = [...this.logs()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (!q) return sorted;
    return sorted.filter((l) =>
      normalize(`${l.action} ${l.description} ${l.user?.name ?? ''} ${l.entity_type ?? ''}`).includes(q),
    );
  });

  constructor() {
    void this.loadMore();
  }

  protected async loadMore(): Promise<void> {
    this.loading.set(true);
    try {
      const next = await this.api.auditLogs(this.page() + 1);
      const known = new Set(this.logs().map((l) => l.id));
      this.logs.update((list) => [...list, ...next.items.filter((l) => !known.has(l.id))]);
      this.page.set(next.page);
      this.lastPage.set(next.lastPage);
    } catch (error) {
      void this.toast.error(error instanceof ApiError ? error.message : 'No pudimos cargar la auditoría.');
    } finally {
      this.loading.set(false);
    }
  }
}
