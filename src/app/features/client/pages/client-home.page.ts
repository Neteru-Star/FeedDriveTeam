import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Geocoder, type Place } from '@core/geo/geocoder';
import { LocationService } from '@core/location/location.service';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonMenuToggle } from '@ionic/angular/ion-menu-toggle';
import { MapPageComponent } from '@layout/map-page.component';
import { LocationNoticeComponent } from '@shared/ui/location-notice/location-notice.component';
import { MapComponent } from '@shared/ui/map/map.component';
import type { MapMarker, MapPadding } from '@shared/ui/map/map.models';
import { RouteLineComponent } from '@shared/ui/route-line/route-line.component';
import { ToastService } from '@shared/ui/toast/toast.service';
import { BOGOTA, formatDistance, type LatLng } from '@shared/utils/geo';
import { catchError, debounceTime, filter, of, switchMap } from 'rxjs';

import { PlaceSearchComponent } from '../components/place-search.component';
import { TripDraftStore, type PointKind } from '../data-access/trip-draft.store';

const CURRENT_LOCATION = 'Mi ubicación actual';
/** Mismo punto de corte que la hoja lateral de map-page.component.scss. */
const WIDE_SCREEN_PX = 900;
const REVERSE_DEBOUNCE_MS = 500;

/** HU-02: mapa centrado en el pasajero y elección de origen y destino por búsqueda o en el mapa. */
@Component({
  selector: 'app-client-home',
  imports: [
    IonButton,
    IonIcon,
    IonMenuToggle,
    MapPageComponent,
    MapComponent,
    LocationNoticeComponent,
    PlaceSearchComponent,
    RouteLineComponent,
  ],
  templateUrl: 'client-home.page.html',
  styleUrl: 'client-home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientHomePage {
  protected readonly location = inject(LocationService);
  protected readonly draft = inject(TripDraftStore);
  private readonly geocoder = inject(Geocoder);
  private readonly toast = inject(ToastService);
  private readonly map = viewChild.required(MapComponent);

  protected readonly center = signal<LatLng>(BOGOTA);
  /** Centro visible del mapa, actualizado al terminar cada movimiento. */
  private readonly visibleCenter = signal<LatLng>(BOGOTA);
  /** Zona para priorizar sugerencias: la ubicación del pasajero o, sin GPS, lo que está viendo en el mapa. */
  protected readonly searchNear = computed(() => this.location.position() ?? this.visibleCenter());
  /** Extremo que se está eligiendo moviendo el mapa, o null. */
  protected readonly picking = signal<PointKind | null>(null);
  private readonly pickCenter = signal<LatLng | null>(null);

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
  protected readonly distance = computed(() => {
    const km = this.draft.distanceKm();
    return km === null ? '' : formatDistance(km);
  });

  protected readonly markers = computed<MapMarker[]>(() => {
    const markers: MapMarker[] = [];
    const me = this.location.position();
    if (me) markers.push({ id: 'me', kind: 'user', position: me, label: CURRENT_LOCATION });
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
          this.draft.relabel('origin', `${CURRENT_LOCATION} · ${place.label}`, place.detail);
        }
      });
  }

  protected recenter(): void {
    const me = this.location.position();
    if (me) this.map().flyTo(me, 16);
    else void this.locate();
  }

  protected select(kind: PointKind, place: Place): void {
    const accepted = this.draft.set(kind, { ...place, source: 'search' });
    if (!accepted) void this.toast.error('El origen y el destino no pueden ser el mismo lugar.');
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
      void this.toast.error('El origen y el destino no pueden ser el mismo lugar.');
      return;
    }
    this.cancelPicking();
  }
}
