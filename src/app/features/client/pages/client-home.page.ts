import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Geocoder, type Place } from '@core/geo/geocoder';
import { RoutePlanner } from '@core/geo/route-planner';
import { LocationService } from '@core/location/location.service';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { AlertController } from '@ionic/angular/alert-controller';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonMenuToggle } from '@ionic/angular/ion-menu-toggle';
import { IonModal } from '@ionic/angular/ion-modal';
import { MapPageComponent } from '@layout/map-page.component';
import { LocationNoticeComponent } from '@shared/ui/location-notice/location-notice.component';
import { MapComponent } from '@shared/ui/map/map.component';
import type { MapMarker, MapPadding, MapRoute } from '@shared/ui/map/map.models';
import { RouteLineComponent } from '@shared/ui/route-line/route-line.component';
import { ToastService } from '@shared/ui/toast/toast.service';
import { BOGOTA, formatDistance, type LatLng } from '@shared/utils/geo';
import { catchError, debounceTime, filter, of, startWith, switchMap } from 'rxjs';

import { FareConfirmComponent } from '../components/fare-confirm.component';
import { PlaceSearchComponent } from '../components/place-search.component';
import { RateTripComponent } from '../components/rate-trip.component';
import { RideStatusComponent } from '../components/ride-status.component';
import { ActiveRideStore, CANCEL_REASON_MAX } from '../data-access/active-ride.store';
import type { RideRequest, RideRequestPayload } from '../data-access/client.models';
import { FareQuoteStore } from '../data-access/fare-quote.store';
import { CURRENT_LOCATION, LOCATION_SEPARATOR, pickupName } from '../data-access/pickup-name';
import { TripDraftStore, type PointKind } from '../data-access/trip-draft.store';
import { TripHistoryStore } from '../data-access/trip-history.store';
import type { RateTarget } from '../data-access/trip-record';

/** Mismo punto de corte que la hoja lateral de map-page.component.scss. */
const WIDE_SCREEN_PX = 900;
const REVERSE_DEBOUNCE_MS = 500;
const SAME_PLACE_ERROR = 'El origen y el destino no pueden ser el mismo lugar.';
const SEARCH_CANCEL_REASONS = ['Cambié de planes', 'Pedí el viaje por error', 'Tarda mucho en encontrar conductor'];
const TRIP_CANCEL_REASONS = ['Cambié de planes', 'El conductor tarda demasiado', 'Encontré otro transporte'];
const OTHER_REASON = 'Otro motivo';

const requestRoute = (r: RideRequest): MapRoute => ({
  from: { lat: r.origin_latitude, lng: r.origin_longitude },
  to: { lat: r.destination_latitude, lng: r.destination_longitude },
});

/**
 * Pantalla principal del pasajero.
 * HU-02: mapa y elección de origen y destino. HU-03: tarifa estimada, solicitud y espera del conductor.
 */
@Component({
  selector: 'app-client-home',
  imports: [
    IonButton,
    IonIcon,
    IonMenuToggle,
    IonModal,
    MapPageComponent,
    MapComponent,
    LocationNoticeComponent,
    PlaceSearchComponent,
    RouteLineComponent,
    FareConfirmComponent,
    RideStatusComponent,
    RateTripComponent,
  ],
  templateUrl: 'client-home.page.html',
  styleUrl: 'client-home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientHomePage {
  protected readonly location = inject(LocationService);
  protected readonly draft = inject(TripDraftStore);
  protected readonly fares = inject(FareQuoteStore);
  protected readonly ride = inject(ActiveRideStore);
  private readonly history = inject(TripHistoryStore);
  private readonly geocoder = inject(Geocoder);
  private readonly planner = inject(RoutePlanner);
  private readonly toast = inject(ToastService);
  private readonly alerts = inject(AlertController);
  private readonly actionSheets = inject(ActionSheetController);
  private readonly map = viewChild.required(MapComponent);

  protected readonly center = signal<LatLng>(BOGOTA);
  /** Centro visible del mapa, actualizado al terminar cada movimiento. */
  private readonly visibleCenter = signal<LatLng>(BOGOTA);
  /** Zona para priorizar sugerencias: la ubicación del pasajero o, sin GPS, lo que está viendo en el mapa. */
  protected readonly searchNear = computed(() => this.location.position() ?? this.visibleCenter());
  /** Extremo que se está eligiendo moviendo el mapa, o null. */
  protected readonly picking = signal<PointKind | null>(null);
  private readonly pickCenter = signal<LatLng | null>(null);
  /** Paso del pasajero mientras no hay viaje: planear la ruta o confirmar la tarifa. */
  protected readonly step = signal<'plan' | 'confirm'>('plan');

  /** Viaje recién completado, para calificarlo (HU-08). */
  private readonly completedTrip = computed(() => {
    const state = this.ride.state();
    return state.kind === 'ended' && state.outcome === 'completed' ? state.trip : null;
  });
  protected readonly endedRating = computed(() => {
    const trip = this.completedTrip();
    return trip ? this.history.ratingOf({ id: trip.id, rating: null }) : null;
  });
  protected readonly rateTarget = computed<RateTarget | null>(() => {
    const trip = this.completedTrip();
    return trip
      ? { id: trip.id, driverName: trip.driver.user.name, plate: trip.vehicle?.plate, date: new Date().toISOString() }
      : null;
  });
  protected readonly rateOpen = signal(false);

  /** Hay una solicitud o un viaje en curso: el panel muestra su estado en lugar del planeador. */
  protected readonly rideActive = computed(() => !['idle', 'requesting'].includes(this.ride.state().kind));
  protected readonly quote = computed(() => this.fares.quoteFor(this.draft.route()));

  /** Dirección bajo el pin mientras se elige en el mapa. */
  protected readonly pickedPlace = toSignal(
    toObservable(this.pickCenter).pipe(
      filter((point): point is LatLng => point !== null),
      debounceTime(REVERSE_DEBOUNCE_MS),
      switchMap((point) => this.geocoder.reverse(point).pipe(catchError(() => of(null)))),
    ),
    { initialValue: null },
  );

  /** La ruta se encuadra en la parte visible: arriba de la hoja (móvil) o a la derecha del panel (escritorio). */
  protected readonly routePadding: MapPadding =
    window.innerWidth >= WIDE_SCREEN_PX
      ? { top: 80, right: 60, bottom: 60, left: 460 }
      : { top: 90, right: 40, bottom: Math.round(window.innerHeight * 0.55), left: 40 };

  protected readonly showNotice = computed(() => ['denied', 'unavailable'].includes(this.location.status()));
  /** Ruta por calles del viaje que se planea (la misma consulta que usa el mapa, que queda en caché). */
  private readonly road = toSignal(
    toObservable(this.draft.route).pipe(
      switchMap((route) => (route ? this.planner.route(route.from, route.to).pipe(startWith(null)) : of(null))),
    ),
    { initialValue: null },
  );
  /** "11,8 km · ~19 min" por carretera, o null mientras no se conoce. */
  protected readonly roadSummary = computed(() => {
    const road = this.road();
    return road ? `${formatDistance(road.distanceKm)} · ~${Math.max(1, Math.round(road.durationMin))} min` : null;
  });
  protected readonly distance = computed(() => {
    const km = this.draft.distanceKm();
    return km === null ? '' : formatDistance(km);
  });
  protected readonly sheetLabel = computed(() => {
    if (this.rideActive()) return 'Tu viaje';
    if (this.picking()) return 'Elegir en el mapa';
    return this.step() === 'confirm' ? 'Confirmar viaje' : 'Planear viaje';
  });

  /** Ruta en el mapa: la de la solicitud en curso o la que se está planeando. */
  protected readonly mapRoute = computed<MapRoute | null>(() => {
    const request = this.ride.request();
    if (this.rideActive()) return request ? requestRoute(request) : null;
    return this.picking() ? null : this.draft.route();
  });

  protected readonly markers = computed<MapMarker[]>(() => {
    const markers: MapMarker[] = [];
    const me = this.location.position();
    if (me) markers.push({ id: 'me', kind: 'user', position: me, label: CURRENT_LOCATION });
    const route = this.mapRoute();
    const state = this.ride.state();
    if (this.rideActive()) {
      if (route) {
        markers.push({ id: 'origin', kind: 'origin', position: route.from });
        markers.push({ id: 'destination', kind: 'destination', position: route.to });
      }
      const driver = state.kind === 'trip' ? state.trip.driver.latest_location : null;
      if (driver) {
        markers.push({ id: 'driver', kind: 'driver', position: { lat: driver.latitude, lng: driver.longitude } });
      }
      return markers;
    }
    const origin = this.draft.origin();
    const destination = this.draft.destination();
    // El origen tomado del GPS ya se ve como "mi ubicación" hasta que hay ruta.
    if (origin && this.picking() !== 'origin' && (origin.source !== 'gps' || destination)) {
      markers.push({ id: 'origin', kind: 'origin', position: origin.position, label: origin.label });
    }
    if (destination && this.picking() !== 'destination') {
      markers.push({
        id: 'destination',
        kind: 'destination',
        position: destination.position,
        label: destination.label,
      });
    }
    return markers;
  });

  constructor() {
    void this.locate();
    void this.ride.restore();
    void this.fares.loadActiveFare();

    // Al completar un viaje se pide la calificación una sola vez; el resumen permite hacerlo después.
    let askedFor: number | null = null;
    effect(() => {
      const trip = this.completedTrip();
      if (!trip || trip.id === askedFor) return;
      askedFor = trip.id;
      untracked(() => {
        if (this.history.ratingOf({ id: trip.id, rating: null }) === null) this.rateOpen.set(true);
      });
    });

    // Al terminar o cancelarse un viaje, el pasajero vuelve a planear desde su ubicación.
    let previous = this.ride.state().kind;
    effect(() => {
      const kind = this.ride.state().kind;
      if ((previous === 'trip' || previous === 'ended') && kind === 'idle') {
        untracked(() => {
          this.draft.clear('destination');
          this.step.set('plan');
        });
      }
      previous = kind;
    });
  }

  protected async locate(): Promise<void> {
    const position = await this.location.locate();
    if (!position) return;
    this.center.set(position);
    if (this.draft.origin()) return;
    this.draft.set('origin', { label: CURRENT_LOCATION, detail: '', position, source: 'gps' });
    this.geocoder
      .reverse(position)
      .pipe(catchError(() => of(null)))
      .subscribe((place) => {
        if (place && this.draft.origin()?.source === 'gps') {
          this.draft.relabel('origin', `${CURRENT_LOCATION}${LOCATION_SEPARATOR}${place.label}`, place.detail);
        }
      });
  }

  protected recenter(): void {
    const me = this.location.position();
    if (me) this.map().flyTo(me, 16);
    else void this.locate();
  }

  protected select(kind: PointKind, place: Place): void {
    if (!this.draft.set(kind, { ...place, source: 'search' })) void this.toast.error(SAME_PLACE_ERROR);
  }

  protected startPicking(kind: PointKind, at?: LatLng): void {
    this.picking.set(kind);
    const start = at ?? this.draft[kind]()?.position ?? this.map().getCenter() ?? this.center();
    this.map().flyTo(start);
    this.pickCenter.set(start);
  }

  protected cancelPicking(): void {
    this.picking.set(null);
    this.pickCenter.set(null);
  }

  protected onMapClick(point: LatLng): void {
    if (this.rideActive() || this.step() === 'confirm') return;
    // Tocar el mapa sin estar eligiendo empieza a elegir el destino en ese punto (HU-02).
    if (this.picking()) this.map().flyTo(point);
    else this.startPicking('destination', point);
  }

  protected onMoveEnd(point: LatLng): void {
    this.visibleCenter.set(point);
    if (this.picking()) this.pickCenter.set(point);
  }

  protected confirmPick(): void {
    const kind = this.picking();
    const point = this.pickCenter();
    if (!kind || !point) return;
    const place = this.pickedPlace();
    const label = place?.label ?? 'Punto en el mapa';
    const detail = place?.detail ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
    if (!this.draft.set(kind, { label, detail, position: point, source: 'map' })) {
      void this.toast.error(SAME_PLACE_ERROR);
      return;
    }
    this.cancelPicking();
  }

  /** "Ver tarifa": cotiza la ruta, salvo que ya esté cotizada y no haya cambiado. */
  protected showFare(): void {
    const route = this.draft.route();
    if (!route) return;
    this.step.set('confirm');
    if (this.quote().status !== 'ready') void this.fares.estimate(route);
  }

  protected retryEstimate(): void {
    const route = this.draft.route();
    if (route) void this.fares.estimate(route);
  }

  protected async requestRide(): Promise<void> {
    const origin = this.draft.origin();
    const destination = this.draft.destination();
    if (!origin || !destination) return;
    await this.submit({
      origin_name: pickupName(origin),
      origin_latitude: origin.position.lat,
      origin_longitude: origin.position.lng,
      destination_name: destination.label,
      destination_latitude: destination.position.lat,
      destination_longitude: destination.position.lng,
    });
  }

  /** "Reintentar" después de 2 minutos sin conductores: la misma ruta de la solicitud anterior. */
  protected async retryRide(): Promise<void> {
    const request = this.ride.request();
    if (!request) return;
    const {
      origin_name,
      origin_latitude,
      origin_longitude,
      destination_name,
      destination_latitude,
      destination_longitude,
    } = request;
    await this.submit({
      origin_name,
      origin_latitude,
      origin_longitude,
      destination_name,
      destination_latitude,
      destination_longitude,
    });
  }

  private async submit(payload: RideRequestPayload): Promise<void> {
    const result = await this.ride.requestRide(payload);
    if (result === 'ok') this.step.set('plan');
    if (result === 'already-active') await this.showActiveTripAlert();
  }

  /** Respuesta 400 del backend: ya hay una solicitud o un viaje en curso. */
  private async showActiveTripAlert(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Ya tienes un viaje activo',
      message: 'Espera a que termine tu viaje actual antes de solicitar otro.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Ver mi viaje', handler: () => void this.ride.restore() },
      ],
    });
    await alert.present();
  }

  /** HU-06: cancelar con motivo, solo mientras se busca conductor o antes de iniciar el recorrido. */
  protected async askCancelReason(): Promise<void> {
    const searching = this.ride.state().kind === 'searching';
    const sheet = await this.actionSheets.create({
      header: searching ? '¿Por qué cancelas la solicitud?' : '¿Por qué cancelas el viaje?',
      subHeader: searching ? undefined : 'Tu conductor ya va en camino.',
      buttons: [
        ...(searching ? SEARCH_CANCEL_REASONS : TRIP_CANCEL_REASONS).map((text) => ({ text, data: text })),
        { text: OTHER_REASON, data: OTHER_REASON },
        { text: 'No cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data, role } = await sheet.onDidDismiss<string>();
    if (role === 'cancel' || role === 'backdrop' || !data) return;
    const reason = data === OTHER_REASON ? await this.askOtherReason(searching) : data;
    if (reason) await this.ride.cancel(reason);
  }

  private async askOtherReason(searching: boolean): Promise<string | null> {
    const alert = await this.alerts.create({
      header: 'Cuéntanos el motivo',
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Escribe el motivo (opcional)',
          attributes: { maxlength: CANCEL_REASON_MAX, 'aria-label': 'Motivo de la cancelación' },
        },
      ],
      buttons: [
        { text: 'Volver', role: 'cancel' },
        { text: searching ? 'Cancelar solicitud' : 'Cancelar viaje', role: 'confirm' },
      ],
    });
    await alert.present();
    const { data, role } = await alert.onDidDismiss<{ values?: { reason?: string } }>();
    if (role !== 'confirm') return null;
    return data?.values?.reason?.trim() || OTHER_REASON;
  }
}
