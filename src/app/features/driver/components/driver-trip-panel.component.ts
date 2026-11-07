import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocationService } from '@core/location/location.service';
import { AlertController } from '@ionic/angular/alert-controller';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { CurrencyCopPipe } from '@shared/pipes/format.pipes';
import { RouteLineComponent } from '@shared/ui/route-line/route-line.component';
import { TripTimelineComponent } from '@shared/ui/trip-timeline/trip-timeline.component';
import { etaMinutes, formatDistance, haversineKm, type LatLng } from '@shared/utils/geo';
import { interval, map } from 'rxjs';

import { DriverTripStore } from '../data-access/driver-trip.store';

const TICK_MS = 1000;

/** Enlace de navegación giro a giro en Google Maps (la app no tiene rutas por calles propias). */
const navigationUrl = (to: LatLng): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=driving`;

/** Panel del viaje del conductor (HU-05): un paso a la vez, con la acción que corresponde al estado. */
@Component({
  selector: 'app-driver-trip-panel',
  imports: [IonButton, IonIcon, IonSpinner, CurrencyCopPipe, RouteLineComponent, TripTimelineComponent],
  template: `
    @if (store.trip(); as t) {
      <app-trip-timeline class="timeline" [status]="store.status()" />
      <p class="sr-only" aria-live="polite">{{ headline().title }}</p>
      <h2>{{ headline().title }}</h2>
      <p class="app-muted detail">{{ headline().detail }}</p>

      @if (store.status() === 'in_progress') {
        <dl class="live">
          <div>
            <dt>Recorrido</dt>
            <dd class="mono">{{ travelled() }}</dd>
          </div>
          <div>
            <dt>Tiempo</dt>
            <dd class="mono">{{ elapsed() }}</dd>
          </div>
        </dl>
      }

      <div class="passenger">
        <div>
          <strong>{{ t.request.client.name }}</strong>
          <small class="app-muted">Pasajero · {{ t.trip.estimated_fare | currencyCop }} estimado</small>
        </div>
        <a
          class="app-call"
          [href]="'tel:' + t.request.client.phone"
          [attr.aria-label]="'Llamar a ' + t.request.client.name"
        >
          <ion-icon name="call-outline" aria-hidden="true" /> Llamar
        </a>
      </div>
      <app-route-line [origin]="t.request.origin_name" [destination]="t.request.destination_name" />

      <div class="actions">
        @if (store.action(); as action) {
          <ion-button expand="block" [disabled]="store.busy()" (click)="run()">
            @if (store.busy()) {
              <ion-spinner name="crescent" aria-hidden="true" />
            }
            {{ action.label }}
          </ion-button>
        }
        @if (target(); as to) {
          <ion-button expand="block" fill="clear" color="dark" [href]="navigation()" target="_blank" rel="noopener">
            <ion-icon slot="start" name="navigate-outline" aria-hidden="true" />
            Navegar {{ store.status() === 'in_progress' ? 'al destino' : 'al punto de partida' }}
          </ion-button>
        }
      </div>
    }
  `,
  styles: `
    .timeline {
      display: block;
      margin: 4px 0 16px;
    }
    h2 {
      margin: 0 0 4px;
    }
    .detail {
      margin: 0 0 14px;
    }
    .live {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 0 0 14px;
    }
    .live div {
      padding: 10px 12px;
      border-radius: 14px;
      background: color-mix(in srgb, var(--color-ink) 5%, transparent);
    }
    dt {
      font-size: 12px;
      color: var(--color-muted);
    }
    dd {
      margin: 2px 0 0;
      font-size: 20px;
      font-weight: 700;
    }
    .passenger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }
    .passenger strong,
    .passenger small {
      display: block;
    }
    .actions {
      margin-top: 16px;
    }
    ion-spinner {
      width: 16px;
      height: 16px;
      margin-right: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverTripPanelComponent {
  protected readonly store = inject(DriverTripStore);
  private readonly location = inject(LocationService);
  private readonly alerts = inject(AlertController);
  private readonly now = toSignal(interval(TICK_MS).pipe(map(() => Date.now())), { initialValue: Date.now() });

  /** Punto al que va el conductor ahora: la recogida o, en el recorrido, el destino (si el backend dio coordenadas). */
  protected readonly target = computed<LatLng | null>(() => {
    const r = this.store.trip()?.request;
    if (!r) return null;
    const toDestination = this.store.status() === 'in_progress';
    const lat = toDestination ? r.destination_latitude : r.origin_latitude;
    const lng = toDestination ? r.destination_longitude : r.origin_longitude;
    return lat === undefined || lng === undefined ? null : { lat, lng };
  });
  protected readonly navigation = computed(() => {
    const to = this.target();
    return to ? navigationUrl(to) : null;
  });

  protected readonly headline = computed(() => {
    const t = this.store.trip();
    if (!t) return { title: '', detail: '' };
    const me = this.location.position();
    const to = this.target();
    const away = me && to ? ` Estás a ${formatDistance(haversineKm(me, to))}, ~${etaMinutes(me, to)} min.` : '';
    switch (this.store.status()) {
      case 'driver_arrived':
        return {
          title: `Esperando a ${t.request.client.name}`,
          detail: `Le avisamos que llegaste a ${t.request.origin_name}. Inicia el viaje cuando suba.`,
        };
      case 'in_progress':
        return { title: `En camino a ${t.request.destination_name}`, detail: `Finaliza al llegar al destino.${away}` };
      default:
        return { title: `Recoge a ${t.request.client.name}`, detail: `Ve a ${t.request.origin_name}.${away}` };
    }
  });

  protected readonly travelled = computed(() => formatDistance(this.store.trail()?.distanceKm ?? 0));
  protected readonly elapsed = computed(() => {
    const started = this.store.trail()?.startedAt;
    if (!started) return '0:00';
    const seconds = Math.max(0, Math.floor((this.now() - started) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  });

  /** Finalizar se confirma: cierra el viaje y calcula la tarifa definitiva. */
  protected async run(): Promise<void> {
    if (this.store.action()?.action !== 'complete') {
      await this.store.advance();
      return;
    }
    const alert = await this.alerts.create({
      header: '¿Finalizar el viaje?',
      message: `Confirma que llegaste a ${this.store.trip()?.request.destination_name}. Se calculará la tarifa definitiva.`,
      buttons: [
        { text: 'Todavía no', role: 'cancel' },
        { text: 'Finalizar', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') await this.store.advance();
  }
}
