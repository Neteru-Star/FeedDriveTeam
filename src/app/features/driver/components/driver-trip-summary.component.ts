import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { CurrencyCopPipe } from '@shared/pipes/format.pipes';
import { RouteLineComponent } from '@shared/ui/route-line/route-line.component';
import { formatDistance } from '@shared/utils/geo';

import { DriverTripStore } from '../data-access/driver-trip.store';

/** Resumen del viaje finalizado para el conductor: tarifa definitiva que cobra, distancia y duración reales. */
@Component({
  selector: 'app-driver-trip-summary',
  imports: [IonButton, IonIcon, CurrencyCopPipe, RouteLineComponent],
  template: `
    @if (store.summary(); as s) {
      <div class="center" role="status">
        <span class="badge-icon" aria-hidden="true"><ion-icon name="checkmark-circle-outline" /></span>
        <h2>Viaje finalizado</h2>
        <p class="app-muted">Cobra al pasajero en efectivo.</p>
      </div>
      <div class="total">
        <span>Tarifa definitiva</span>
        <strong class="mono">{{ s.completed.final_fare | currencyCop }}</strong>
      </div>
      <dl>
        <div>
          <dt>Distancia {{ s.distanceSource === 'gps' ? '(GPS)' : '(estimada)' }}</dt>
          <dd>{{ distance() }}</dd>
        </div>
        <div>
          <dt>Duración</dt>
          <dd>{{ s.completed.duration_travelled_min }} min</dd>
        </div>
      </dl>
      <app-route-line [origin]="s.request.origin_name" [destination]="s.request.destination_name" />
      <ion-button class="done" expand="block" (click)="store.finish()">Listo, seguir en línea</ion-button>
    }
  `,
  styles: `
    .center {
      text-align: center;
    }
    .center h2 {
      margin: 8px 0 2px;
    }
    .center p {
      margin: 0 0 14px;
    }
    .badge-icon {
      display: inline-grid;
      place-items: center;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      font-size: 26px;
      color: var(--color-primary-strong);
      background: var(--color-primary-soft);
    }
    .total {
      display: grid;
      justify-items: center;
      margin-bottom: 14px;
      padding: 14px;
      border-radius: 16px;
      background: color-mix(in srgb, var(--color-ink) 5%, transparent);
    }
    .total span {
      font-size: 13px;
      color: var(--color-muted);
    }
    .total strong {
      font-size: 30px;
    }
    dl {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 0 0 14px;
    }
    dt {
      font-size: 12px;
      color: var(--color-muted);
    }
    dd {
      margin: 2px 0 0;
      font-weight: 700;
    }
    .done {
      margin-top: 16px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverTripSummaryComponent {
  protected readonly store = inject(DriverTripStore);
  protected readonly distance = computed(() =>
    formatDistance(this.store.summary()?.completed.distance_travelled_km ?? 0),
  );
}
