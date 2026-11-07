import type { OnInit } from '@angular/core';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '@core/http/api-error';
import { AlertController } from '@ionic/angular/alert-controller';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { PageHeaderComponent } from '@layout/page-header.component';
import { ToastService } from '@shared/ui/toast/toast.service';

import { AdminApi } from '../data-access/admin.api';
import { APPROVAL_LABEL, type AdminDriver, type ApprovalStatus } from '../data-access/admin.models';

const FILTERS: { value: ApprovalStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobados' },
  { value: 'suspended', label: 'Suspendidos' },
  { value: 'rejected', label: 'Rechazados' },
];

/** Qué acciones tiene cada estado: aprobar a un pendiente o suspendido, suspender a un aprobado, rechazar a un pendiente. */
const ACTIONS: Record<ApprovalStatus, { to: ApprovalStatus; label: string; color: string }[]> = {
  pending: [
    { to: 'approved', label: 'Aprobar', color: 'primary' },
    { to: 'rejected', label: 'Rechazar', color: 'danger' },
  ],
  approved: [{ to: 'suspended', label: 'Suspender', color: 'danger' }],
  suspended: [{ to: 'approved', label: 'Reactivar', color: 'primary' }],
  rejected: [{ to: 'approved', label: 'Aprobar', color: 'primary' }],
};

const VERB: Record<ApprovalStatus, string> = {
  approved: 'aprobar',
  suspended: 'suspender',
  rejected: 'rechazar',
  pending: 'devolver a revisión',
};

/** Gestión de conductores (HU-09): filtro por estado y aprobar, suspender o rechazar con notas. */
@Component({
  selector: 'app-admin-drivers',
  imports: [IonButton, IonContent, PageHeaderComponent],
  template: `
    <app-page-header title="Conductores" />
    <ion-content>
      <main class="adm-page">
        <div class="adm-chips" role="group" aria-label="Filtrar por estado">
          @for (f of filters; track f.value) {
            <button type="button" [attr.aria-pressed]="(estado() ?? '') === f.value" (click)="filter(f.value)">
              {{ f.label }}
            </button>
          }
        </div>
        <div class="adm-table-wrap">
          <table class="adm-table">
            <thead>
              <tr>
                <th>Conductor</th>
                <th>Licencia</th>
                <th>Vehículo</th>
                <th class="num">Calificación</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (d of drivers(); track d.id) {
                <tr>
                  <td>
                    <strong>{{ d.user.name }}</strong>
                    <small>{{ d.user.email }}</small>
                    @if (d.admin_notes) {
                      <small>Nota: {{ d.admin_notes }}</small>
                    }
                  </td>
                  <td class="mono">{{ d.license_number }}</td>
                  <td>
                    @for (v of d.vehicles; track v.plate) {
                      <strong class="mono">{{ v.plate }}</strong>
                      <small>{{ v.brand }} {{ v.model }} {{ v.year }}</small>
                    } @empty {
                      <small>Sin vehículo</small>
                    }
                  </td>
                  <td class="num">{{ d.rating_average.toFixed(1) }} ★</td>
                  <td>
                    <span class="adm-badge" [attr.data-status]="d.approval_status">{{ label[d.approval_status] }}</span>
                  </td>
                  <td>
                    <div class="adm-actions">
                      @for (a of actions[d.approval_status]; track a.to) {
                        <ion-button
                          size="small"
                          [fill]="a.color === 'danger' ? 'outline' : 'solid'"
                          [color]="a.color"
                          [disabled]="busy() === d.id"
                          [attr.aria-label]="a.label + ' a ' + d.user.name"
                          (click)="change(d, a.to)"
                        >
                          {{ a.label }}
                        </ion-button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="adm-empty">
                    {{ loading() ? 'Cargando conductores…' : 'No hay conductores con este estado.' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </main>
    </ion-content>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDriversPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly alerts = inject(AlertController);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Filtro en la URL (`?estado=pending`) para poder compartir el enlace desde el dashboard. */
  readonly estado = input<ApprovalStatus | ''>();

  protected readonly filters = FILTERS;
  protected readonly actions = ACTIONS;
  protected readonly label = APPROVAL_LABEL;
  protected readonly drivers = signal<AdminDriver[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal<number | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  protected async filter(value: ApprovalStatus | ''): Promise<void> {
    await this.router.navigate([], { queryParams: { estado: value || null }, replaceUrl: true });
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.drivers.set(await this.api.drivers(this.estado() || undefined));
    } catch (error) {
      void this.toast.error(error instanceof ApiError ? error.message : 'No pudimos cargar los conductores.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Confirma el cambio con una nota opcional (obligatoria al suspender o rechazar, para dejar el motivo). */
  protected async change(driver: AdminDriver, to: ApprovalStatus): Promise<void> {
    const needsReason = to === 'suspended' || to === 'rejected';
    const alert = await this.alerts.create({
      header: `¿${VERB[to][0].toUpperCase()}${VERB[to].slice(1)} a ${driver.user.name}?`,
      message: needsReason ? 'Escribe el motivo: el conductor lo verá al consultar su cuenta.' : undefined,
      inputs: [
        {
          name: 'notes',
          type: 'textarea',
          placeholder: needsReason ? 'Motivo (obligatorio)' : 'Notas (opcional)',
          attributes: { maxlength: 500, 'aria-label': 'Notas del administrador' },
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: APPROVAL_LABEL[to] === 'Aprobado' ? 'Aprobar' : 'Confirmar', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{ values?: { notes?: string } }>();
    if (role !== 'confirm') return;
    const notes = data?.values?.notes?.trim() ?? '';
    if (needsReason && !notes) {
      void this.toast.error('Escribe el motivo para suspender o rechazar.');
      return;
    }
    this.busy.set(driver.id);
    try {
      await this.api.setApproval(driver.id, to, notes);
      void this.toast.success(`${driver.user.name}: ${APPROVAL_LABEL[to].toLowerCase()}.`);
      await this.load();
    } catch (error) {
      void this.toast.error(error instanceof ApiError ? error.message : 'No pudimos actualizar al conductor.');
    } finally {
      this.busy.set(null);
    }
  }
}
