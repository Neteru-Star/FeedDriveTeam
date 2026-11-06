import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { AuthStore } from '@core/auth/auth.store';
import { LocationService } from '@core/location/location.service';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonMenuToggle } from '@ionic/angular/ion-menu-toggle';
import { MapPageComponent } from '@layout/map-page.component';
import { LocationNoticeComponent } from '@shared/ui/location-notice/location-notice.component';
import { MapComponent } from '@shared/ui/map/map.component';
import type { MapMarker } from '@shared/ui/map/map.models';
import { BOGOTA, type LatLng } from '@shared/utils/geo';

/** Estructura del conductor: su posición en el mapa y el panel de disponibilidad (HU-04, Fase 7). */
@Component({
  selector: 'app-driver-home',
  imports: [IonIcon, IonMenuToggle, MapPageComponent, MapComponent, LocationNoticeComponent],
  template: `
    <app-map-page sheetLabel="Disponibilidad">
      <app-map [center]="center()" [markers]="markers()" />

      <div top class="top">
        <ion-menu-toggle menu="conductor" [autoHide]="false">
          <button type="button" class="fd-fab" aria-label="Abrir menú">
            <ion-icon name="menu-outline" aria-hidden="true" />
          </button>
        </ion-menu-toggle>
        <div class="card">
          <span class="avatar" aria-hidden="true">{{ initials() }}</span>
          <strong>{{ store.user()?.name }}</strong>
          <span class="state">Fuera de línea</span>
        </div>
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

      <h2>Estás fuera de línea</h2>
      <p class="app-muted">No recibirás viajes mientras estés fuera de línea.</p>
    </app-map-page>
  `,
  styles: `
    .top {
      align-items: center;
    }
    .card {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      padding: 8px 12px 8px 8px;
      border-radius: 999px;
      border: 1px solid var(--color-card-border);
      background: var(--color-card);
      backdrop-filter: var(--blur-glass);
      -webkit-backdrop-filter: var(--blur-glass);
      box-shadow: var(--shadow-float);
    }
    .card strong {
      flex: 1;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .avatar {
      flex: none;
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--color-primary);
      color: #0f1a14;
      font-size: 13px;
      font-weight: 700;
    }
    .state {
      flex: none;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-muted);
      background: color-mix(in srgb, var(--color-ink) 7%, transparent);
    }
    p {
      margin: -6px 0 0;
    }
    @media (min-width: 900px) {
      .card {
        flex: 0 1 360px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverHomePage {
  protected readonly store = inject(AuthStore);
  protected readonly location = inject(LocationService);
  private readonly map = viewChild.required(MapComponent);

  protected readonly center = signal<LatLng>(BOGOTA);
  protected readonly showNotice = computed(() => ['denied', 'unavailable'].includes(this.location.status()));
  protected readonly markers = computed<MapMarker[]>(() => {
    const position = this.location.position();
    return position ? [{ id: 'me', kind: 'driver', position, heading: this.location.heading(), label: 'Tú' }] : [];
  });
  protected readonly initials = computed(() =>
    (this.store.user()?.name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );

  constructor() {
    void this.locate();
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
}
