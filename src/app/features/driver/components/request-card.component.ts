import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { CurrencyCopPipe } from '@shared/pipes/format.pipes';
import { RouteLineComponent } from '@shared/ui/route-line/route-line.component';
import { CITY_SPEED_KMH, DETOUR_FACTOR, formatDistance } from '@shared/utils/geo';

import type { NearbyRequest } from '../data-access/driver.store';

/** Solicitud pendiente para el conductor: recogida, ruta, distancia y ganancia, con Aceptar y Rechazar. */
@Component({
  selector: 'app-request-card',
  imports: [IonButton, IonIcon, IonSpinner, CurrencyCopPipe, RouteLineComponent],
  template: `
    <article class="card" [class.taken]="taken()" [attr.aria-label]="label()">
      @if (taken()) {
        <p class="taken-note" role="alert">
          <ion-icon name="close-circle-outline" aria-hidden="true" />
          Otro conductor tomó este viaje
        </p>
      }
      <div class="head">
        <div>
          <strong class="fare mono">{{ request().estimated_fare | currencyCop }}</strong>
          <span class="app-muted">Ganancia estimada</span>
        </div>
        <div class="pickup">
          @if (pickup(); as p) {
            <strong>{{ p.distance }}</strong>
            <span class="app-muted">~{{ p.minutes }} min para recoger</span>
          }
        </div>
      </div>
      <app-route-line [origin]="request().origin_name" [destination]="request().destination_name" />
      <p class="meta app-muted">{{ request().client.name }} · Viaje de {{ tripDistance() }}</p>
      <div class="actions">
        <ion-button fill="clear" color="dark" [disabled]="busy()" (click)="reject.emit()">Rechazar</ion-button>
        <ion-button [disabled]="busy()" (click)="accept.emit()">
          @if (accepting()) {
            <ion-spinner name="crescent" aria-hidden="true" />
            Aceptando…
          } @else {
            Aceptar
          }
        </ion-button>
      </div>
    </article>
  `,
  styles: `
    .card {
      padding: 14px 16px 8px;
      border: 1px solid var(--color-card-border);
      border-radius: 18px;
      background: var(--color-surface);
      transition:
        opacity var(--motion-base),
        transform var(--motion-base);
    }
    .card.taken {
      opacity: 0.6;
      transform: scale(0.98);
      border-color: var(--color-danger);
    }
    .taken-note {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 10px;
      font-size: 13px;
      font-weight: 600;
      color: var(--color-danger);
    }
    .head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .head div {
      display: grid;
    }
    .head span {
      font-size: 12px;
    }
    .fare {
      font-size: 22px;
    }
    .pickup {
      text-align: right;
    }
    .meta {
      margin: 10px 0 4px;
      font-size: 13px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
    }
    ion-spinner {
      width: 16px;
      height: 16px;
      margin-right: 6px;
    }
    @media (prefers-reduced-motion: reduce) {
      .card {
        transition: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestCardComponent {
  readonly request = input.required<NearbyRequest>();
  readonly accepting = input(false);
  /** Otra solicitud se está aceptando o esta ya fue tomada. */
  readonly disabled = input(false);
  readonly taken = input(false);

  readonly accept = output();
  readonly reject = output();

  protected readonly busy = computed(() => this.disabled() || this.accepting() || this.taken());
  protected readonly tripDistance = computed(() => formatDistance(this.request().estimated_distance_km));
  /** Distancia y tiempo hasta el punto de recogida, si el backend envía sus coordenadas. */
  protected readonly pickup = computed(() => {
    const km = this.request().pickupKm;
    if (km === null) return null;
    return {
      distance: formatDistance(km),
      minutes: Math.max(1, Math.round(((km * DETOUR_FACTOR) / CITY_SPEED_KMH) * 60)),
    };
  });
  protected readonly label = computed(
    () => `Solicitud de ${this.request().origin_name} a ${this.request().destination_name}`,
  );
}
