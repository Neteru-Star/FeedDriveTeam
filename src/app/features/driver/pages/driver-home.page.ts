import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { AuthStore } from '@core/auth/auth.store';
import { LocationService } from '@core/location/location.service';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonMenuToggle } from '@ionic/angular/ion-menu-toggle';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { IonToggle } from '@ionic/angular/ion-toggle';
import type { ToggleCustomEvent } from '@ionic/core';
import { MapPageComponent } from '@layout/map-page.component';
import { LocationNoticeComponent } from '@shared/ui/location-notice/location-notice.component';
import { MapComponent } from '@shared/ui/map/map.component';
import type { MapFocus, MapMarker, MapRoute } from '@shared/ui/map/map.models';
import { BOGOTA, formatDistance, type LatLng } from '@shared/utils/geo';

import { DriverStatusBarComponent } from '../components/driver-status-bar.component';
import { DriverTripPanelComponent } from '../components/driver-trip-panel.component';
import { DriverTripSummaryComponent } from '../components/driver-trip-summary.component';
import { RequestCardComponent } from '../components/request-card.component';
import { DriverTripStore } from '../data-access/driver-trip.store';
import type { ApprovalStatus } from '../data-access/driver.models';
import { DriverStore } from '../data-access/driver.store';

const REVIEW_TEXT: Record<ApprovalStatus, { title: string; message: string }> = {
  pending: {
    title: 'Tu cuenta está en revisión',
    message: 'Un administrador debe aprobar tus documentos y tu vehículo antes de que puedas recibir viajes.',
  },
  rejected: {
    title: 'Tu solicitud fue rechazada',
    message: 'Tu cuenta de conductor no fue aprobada. Comunícate con soporte para conocer el motivo.',
  },
  suspended: {
    title: 'Tu cuenta está suspendida',
    message: 'No puedes recibir viajes por ahora. Comunícate con soporte para reactivar tu cuenta.',
  },
  approved: { title: 'Cuenta aprobada', message: '' },
};

/** Pantalla del conductor (HU-04): disponibilidad, GPS y solicitudes cercanas. */
@Component({
  selector: 'app-driver-home',
  imports: [
    IonButton,
    IonIcon,
    IonMenuToggle,
    IonSkeletonText,
    IonToggle,
    MapPageComponent,
    MapComponent,
    LocationNoticeComponent,
    RequestCardComponent,
    DriverStatusBarComponent,
    DriverTripPanelComponent,
    DriverTripSummaryComponent,
  ],
  template: `
    <app-map-page [sheetLabel]="sheetLabel()">
      <app-map
        [center]="center()"
        [markers]="markers()"
        [route]="route()"
        [fitRoute]="false"
        [focus]="focus()"
        [fitPadding]="routePadding"
      />

      <div top class="top">
        <ion-menu-toggle menu="conductor" [autoHide]="false">
          <button type="button" class="fd-fab" aria-label="Abrir menú">
            <ion-icon name="menu-outline" aria-hidden="true" />
          </button>
        </ion-menu-toggle>
        <app-driver-status-bar [name]="auth.user()?.name ?? ''" [mode]="store.mode()" />
        <button type="button" class="fd-fab" aria-label="Centrar en mi ubicación" (click)="recenter()">
          <ion-icon name="locate-outline" aria-hidden="true" />
        </button>
      </div>

      @if (showNotice()) {
        <app-location-notice
          overlay
          [status]="location.status()"
          purpose="que los pasajeros vean dónde estás"
          (retry)="locate()"
        />
      }

      <p class="sr-only" aria-live="polite">{{ store.announcement() }}</p>

      @switch (store.mode()) {
        @case ('checking') {
          <div class="skeleton" aria-busy="true" aria-label="Consultando tu cuenta">
            <ion-skeleton-text [animated]="true" style="width: 55%; height: 22px" />
            <ion-skeleton-text [animated]="true" style="width: 85%" />
          </div>
        }

        @case ('review') {
          <div class="center">
            <span class="badge-icon" aria-hidden="true"><ion-icon name="time-outline" /></span>
            <h2>{{ review().title }}</h2>
            <p class="app-muted">{{ review().message }}</p>
          </div>
          <ion-button expand="block" fill="outline" color="dark" (click)="store.recheckApproval()">
            Volver a consultar
          </ion-button>
        }

        @case ('assigned') {
          <app-driver-trip-panel />
        }

        @case ('summary') {
          <app-driver-trip-summary />
        }

        @default {
          <div class="availability">
            <div>
              <h2>{{ online() ? 'Estás en línea' : 'Estás fuera de línea' }}</h2>
              <p class="app-muted">
                {{
                  online()
                    ? 'Te mostramos las solicitudes cercanas.'
                    : 'No recibirás viajes mientras estés fuera de línea.'
                }}
              </p>
            </div>
            <ion-toggle
              aria-label="En línea"
              [checked]="online()"
              [disabled]="store.mode() === 'switching'"
              (ionChange)="toggle($event)"
            />
          </div>

          @if (online()) {
            @if (store.requests().length) {
              <h3 class="list-title">Solicitudes cercanas ({{ store.requests().length }})</h3>
              <ul aria-label="Solicitudes cercanas">
                @for (request of store.requests(); track request.id) {
                  <li>
                    <app-request-card
                      [request]="request"
                      [accepting]="store.accepting() === request.id"
                      [disabled]="store.accepting() !== null"
                      [taken]="store.taken().has(request.id)"
                      (accept)="store.accept(request)"
                      (reject)="store.reject(request.id)"
                    />
                  </li>
                }
              </ul>
            } @else {
              <div class="waiting">
                <span class="radar" aria-hidden="true"></span>
                <p class="app-muted">Buscando solicitudes cerca de ti…</p>
              </div>
            }
          } @else if (store.mode() === 'offline') {
            <ion-button expand="block" (click)="store.goOnline()">Conectarme</ion-button>
          }
        }
      }
    </app-map-page>
  `,
  styleUrl: 'driver-home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverHomePage {
  protected readonly auth = inject(AuthStore);
  protected readonly location = inject(LocationService);
  protected readonly store = inject(DriverStore);
  private readonly tripStore = inject(DriverTripStore);
  private readonly map = viewChild.required(MapComponent);

  protected readonly center = signal<LatLng>(BOGOTA);
  protected readonly online = computed(() => this.store.mode() === 'online');
  protected readonly showNotice = computed(() => ['denied', 'unavailable'].includes(this.location.status()));
  protected readonly sheetLabel = computed(() =>
    this.store.mode() === 'assigned' || this.store.mode() === 'summary' ? 'Viaje' : 'Disponibilidad',
  );
  protected readonly review = computed(() => REVIEW_TEXT[this.store.approval() ?? 'pending']);
  // El panel con la lista ocupa cerca del 60 % de la pantalla.
  protected readonly routePadding = { top: 90, right: 40, bottom: Math.round(window.innerHeight * 0.62), left: 40 };

  /** Ruta del viaje aceptado, si el backend envió las coordenadas de la solicitud. */
  protected readonly route = computed<MapRoute | null>(() => {
    const r = this.store.assigned()?.request;
    if (!r || r.origin_latitude === undefined || r.destination_latitude === undefined) return null;
    return {
      from: { lat: r.origin_latitude, lng: r.origin_longitude! },
      to: { lat: r.destination_latitude, lng: r.destination_longitude! },
    };
  });

  /**
   * Puntos a la vista sobre el panel. En línea: el conductor y las recogidas (se reencuadra al cambiar la lista).
   * En un viaje: el conductor y el punto al que va (recogida o destino).
   */
  protected readonly focus = computed<MapFocus | null>(() => {
    const me = this.location.position();
    if (!me) return null;
    const route = this.route();
    if (this.store.mode() === 'assigned' && route) {
      const status = this.tripStore.status();
      const to = status === 'in_progress' ? route.to : route.from;
      return { key: `${this.store.assigned()?.trip.id}-${status}`, points: [me, to] };
    }
    if (!this.online()) return null;
    const origins = this.store
      .requests()
      .filter((r) => r.origin_latitude !== undefined && r.origin_longitude !== undefined)
      .slice(0, 5);
    return {
      key: origins.map((r) => r.id).join(',') || 'solo',
      points: [me, ...origins.map((r) => ({ lat: r.origin_latitude!, lng: r.origin_longitude! }))],
    };
  });

  protected readonly markers = computed<MapMarker[]>(() => {
    const markers: MapMarker[] = [];
    const position = this.location.position();
    if (position) markers.push({ id: 'me', kind: 'driver', position, heading: this.location.heading(), label: 'Tú' });
    const route = this.route();
    if (route) {
      markers.push({ id: 'origin', kind: 'origin', position: route.from, label: 'Recogida' });
      markers.push({ id: 'destination', kind: 'destination', position: route.to, label: 'Destino' });
    } else if (this.online()) {
      // Puntos de recogida de las solicitudes visibles.
      for (const r of this.store.requests()) {
        if (r.origin_latitude === undefined || r.origin_longitude === undefined) continue;
        markers.push({
          id: `request-${r.id}`,
          kind: 'origin',
          position: { lat: r.origin_latitude, lng: r.origin_longitude },
          label: `${r.origin_name} · ${r.pickupKm === null ? '' : formatDistance(r.pickupKm)}`,
        });
      }
    }
    return markers;
  });

  constructor() {
    void this.locate();
    void this.store.init();
  }

  protected async locate(): Promise<void> {
    const position = await this.location.locate();
    if (position) this.center.set(position);
  }

  protected recenter(): void {
    const me = this.location.position();
    if (me) this.map().flyTo(me, 16);
    else void this.locate();
  }

  /** El toggle refleja el estado real: si el cambio falla, vuelve a su posición. */
  protected async toggle(event: ToggleCustomEvent): Promise<void> {
    if (event.detail.checked) await this.store.goOnline();
    else await this.store.goOffline();
    event.target.checked = this.online();
  }
}
