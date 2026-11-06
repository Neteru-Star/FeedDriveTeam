import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { CurrencyCopPipe } from '@shared/pipes/format.pipes';
import { PlateComponent } from '@shared/ui/plate/plate.component';
import { RatingStarsComponent } from '@shared/ui/rating-stars/rating-stars.component';
import { RouteLineComponent } from '@shared/ui/route-line/route-line.component';
import { StatusPillComponent } from '@shared/ui/status-pill/status-pill.component';
import { interval, map } from 'rxjs';

import { SEARCH_TIMEOUT_MS, type RideState } from '../data-access/active-ride.store';

const TICK_MS = 1000;

/** Panel del viaje pedido: buscando conductor, sin conductores o conductor asignado (HU-03). */
@Component({
  selector: 'app-ride-status',
  imports: [
    IonButton,
    IonIcon,
    CurrencyCopPipe,
    PlateComponent,
    RatingStarsComponent,
    RouteLineComponent,
    StatusPillComponent,
  ],
  templateUrl: 'ride-status.component.html',
  styleUrl: 'ride-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RideStatusComponent {
  readonly state = input.required<RideState>();

  readonly cancelSearch = output();
  readonly retry = output();
  readonly dismiss = output();

  private readonly now = toSignal(interval(TICK_MS).pipe(map(() => Date.now())), { initialValue: Date.now() });

  /** Avance de la búsqueda hacia el límite de 2 minutos, de 0 a 1. */
  protected readonly progress = computed(() => {
    const state = this.state();
    if (state.kind !== 'searching') return 0;
    return Math.min(1, (this.now() - state.since) / SEARCH_TIMEOUT_MS);
  });

  protected readonly route = computed(() => {
    const state = this.state();
    const request = 'request' in state ? state.request : null;
    return request
      ? { origin: request.origin_name, destination: request.destination_name, fare: request.estimated_fare }
      : null;
  });

  protected readonly trip = computed(() => {
    const state = this.state();
    return state.kind === 'trip' ? state.trip : null;
  });

  protected readonly initials = computed(() =>
    (this.trip()?.driver.user.name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );
}
