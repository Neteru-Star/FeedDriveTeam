import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TRIP_STATUS } from '@shared/models/trip-status';
import { CurrencyCopPipe } from '@shared/pipes/format.pipes';
import { PlateComponent } from '@shared/ui/plate/plate.component';
import { RatingStarsComponent } from '@shared/ui/rating-stars/rating-stars.component';
import { RouteLineComponent } from '@shared/ui/route-line/route-line.component';
import { TripTimelineComponent } from '@shared/ui/trip-timeline/trip-timeline.component';
import { etaMinutes, formatDistance, haversineKm, type LatLng } from '@shared/utils/geo';
import { interval, map } from 'rxjs';

import { SEARCH_TIMEOUT_MS, type RideState } from '../data-access/active-ride.store';

const TICK_MS = 1000;

/**
 * Panel del viaje del pasajero.
 * HU-03: buscando conductor y sin conductores. HU-06: seguimiento del viaje, llamada, cancelación y resumen final.
 */
@Component({
  selector: 'app-ride-status',
  imports: [
    NgTemplateOutlet,
    IonButton,
    IonIcon,
    CurrencyCopPipe,
    PlateComponent,
    RatingStarsComponent,
    RouteLineComponent,
    TripTimelineComponent,
  ],
  templateUrl: 'ride-status.component.html',
  styleUrl: 'ride-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RideStatusComponent {
  readonly state = input.required<RideState>();
  /** Lo que hay en pantalla todavía se puede cancelar. */
  readonly cancellable = input(false);

  readonly cancelRide = output();
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
      ? {
          origin: request.origin_name,
          destination: request.destination_name,
          fare: request.estimated_fare,
          from: { lat: request.origin_latitude, lng: request.origin_longitude },
          to: { lat: request.destination_latitude, lng: request.destination_longitude },
        }
      : null;
  });

  protected readonly trip = computed(() => {
    const state = this.state();
    return state.kind === 'trip' || state.kind === 'ended' ? state.trip : null;
  });

  protected readonly ended = computed(() => {
    const state = this.state();
    return state.kind === 'ended' ? state : null;
  });

  private readonly driverAt = computed<LatLng | null>(() => {
    const location = this.trip()?.driver.latest_location;
    return location ? { lat: location.latitude, lng: location.longitude } : null;
  });

  /** Texto principal y detalle del viaje en curso, con la llegada estimada si se conoce la posición del conductor. */
  protected readonly headline = computed(() => {
    const trip = this.trip();
    const route = this.route();
    const driver = this.driverAt();
    if (!trip) return null;
    switch (trip.status) {
      case 'assigned': {
        if (!driver || !route) return { title: 'Tu conductor va en camino', detail: 'Te avisaremos cuando llegue.' };
        const km = haversineKm(driver, route.from);
        return {
          title: `Llega en ~${etaMinutes(driver, route.from)} min`,
          detail: `Tu conductor está a ${formatDistance(km)} del punto de partida.`,
        };
      }
      case 'driver_arrived':
        return {
          title: 'Tu conductor llegó',
          detail: route ? `Te espera en ${route.origin}.` : 'Te espera en el punto de partida.',
        };
      case 'in_progress':
        return {
          title: route ? `En camino a ${route.destination}` : 'En camino a tu destino',
          detail: driver && route ? `Llegas en ~${etaMinutes(driver, route.to)} min.` : 'Disfruta el viaje.',
        };
      default:
        return { title: TRIP_STATUS[trip.status].label, detail: TRIP_STATUS[trip.status].clientMessage };
    }
  });

  /** Lo que se anuncia a los lectores de pantalla: solo cambia con el estado, no con cada posición del conductor. */
  protected readonly announcement = computed(() => {
    const state = this.state();
    switch (state.kind) {
      case 'searching':
        return TRIP_STATUS.requested.clientMessage;
      case 'trip':
        return TRIP_STATUS[state.trip.status].clientMessage;
      case 'ended':
        return TRIP_STATUS[state.outcome].clientMessage;
      default:
        return '';
    }
  });

  protected readonly initials = computed(() =>
    (this.trip()?.driver.user.name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );

  /** Enlace `tel:` solo con dígitos y "+", para que el marcador del teléfono lo entienda. */
  protected readonly phoneHref = computed(() => {
    const phone = this.trip()?.driver.user.phone.replace(/[^\d+]/g, '');
    return phone ? `tel:${phone}` : null;
  });
}
