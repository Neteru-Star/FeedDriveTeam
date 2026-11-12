import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { APP_CONFIG } from '@core/config/app-config';
import { RoutePlanner, routeKey } from '@core/geo/route-planner';
import { ThemeService } from '@core/theme/theme.service';
import { BOGOTA, bearing, haversineKm, type LatLng } from '@shared/utils/geo';
import * as L from 'leaflet';
import type { Subscription } from 'rxjs';

import type { MapFocus, MapMarker, MapPadding, MapRoute } from './map.models';

const ICON_HTML: Record<MapMarker['kind'], string> = {
  user: '<span class="fd-mk-user"><i></i></span>',
  origin: '<span class="fd-mk-origin"></span>',
  destination: '<span class="fd-mk-destination"></span>',
  driver:
    '<span class="fd-mk-driver"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 18-7-4-7 4z"/></svg></span>',
};

const ICON_SIZE: Record<MapMarker['kind'], number> = { user: 22, origin: 18, destination: 18, driver: 34 };

/** Duración del deslizamiento del conductor entre dos posiciones reportadas. */
export const GLIDE_MS = 1200;
/** Movimientos menores no cambian el rumbo (ruido del GPS). */
const MIN_HEADING_METERS = 5;

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Mapa Leaflet con teselas claras u oscuras según el tema, marcadores propios y ruta curva con pulso.
 * Las posiciones entran por inputs; la página decide qué mostrar.
 */
@Component({
  selector: 'app-map',
  template: `<div #host class="fd-map" role="application" aria-label="Mapa"></div>`,
  // Estilos en src/theme/map.scss: Leaflet crea marcadores y rutas fuera del template.
  host: { class: 'fd-map-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapComponent {
  readonly center = input<LatLng>(BOGOTA);
  readonly zoom = input(15);
  readonly markers = input<MapMarker[]>([]);
  readonly route = input<MapRoute | null>(null);
  /** Ajusta la vista para que la ruta quede completa cuando cambia. */
  readonly fitRoute = input(true);
  /** Zona tapada por paneles al encuadrar la ruta. */
  readonly fitPadding = input<MapPadding>({ top: 60, right: 60, bottom: 60, left: 60 });
  /** Encuadra estos puntos (por ejemplo, el conductor y las solicitudes cercanas). */
  readonly focus = input<MapFocus | null>(null);

  readonly mapClick = output<LatLng>();
  /** Centro del mapa cada vez que el usuario termina de moverlo. */
  readonly moveEnd = output<LatLng>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly config = inject(APP_CONFIG).mapTiles;
  private readonly theme = inject(ThemeService);
  private readonly planner = inject(RoutePlanner);

  private map?: L.Map;
  private tiles?: L.TileLayer;
  private tileUrl = '';
  private readonly markerLayers = new Map<string, L.Marker>();
  /** HTML del ícono vigente por marcador: solo se reemplaza si cambia, para no cortar transiciones CSS. */
  private readonly iconHtml = new Map<string, string>();
  /** Rumbo calculado del movimiento cuando el backend no lo envía. */
  private readonly headings = new Map<string, number>();
  private readonly glides = new Map<string, number>();
  private readonly reduceMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private routeLayer?: L.LayerGroup;
  /** Ruta dibujada: si llega la misma (por ejemplo, en cada consulta del viaje) no se redibuja ni se reencuadra. */
  private routeKey = '';
  private routeRequest?: Subscription;
  private focusKey: string | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.init();
      destroyRef.onDestroy(() => {
        for (const frame of this.glides.values()) cancelAnimationFrame(frame);
        this.routeRequest?.unsubscribe();
        this.map?.remove();
      });
    });

    effect(() => this.setTiles(this.theme.dark()));
    effect(() => {
      const center = this.center();
      untracked(() => this.map?.setView([center.lat, center.lng], this.map.getZoom(), { animate: true }));
    });
    effect(() => this.syncMarkers(this.markers()));
    effect(() => this.drawRoute(this.route()));
    effect(() => this.applyFocus(this.focus()));
  }

  /** Mueve el mapa a un punto con animación. */
  flyTo(point: LatLng, zoom?: number): void {
    this.map?.flyTo([point.lat, point.lng], zoom ?? this.map.getZoom(), { duration: 0.6 });
  }

  getCenter(): LatLng | null {
    const c = this.map?.getCenter();
    return c ? { lat: c.lat, lng: c.lng } : null;
  }

  private init(): void {
    const center = this.center();
    this.map = L.map(this.host().nativeElement, {
      center: [center.lat, center.lng],
      zoom: this.zoom(),
      zoomControl: false,
      attributionControl: true,
    });
    // Arriba a la derecha: abajo lo taparía la hoja inferior de las pantallas con mapa.
    this.map.attributionControl.setPrefix(false).setPosition('topright');
    this.setTiles(this.theme.dark());
    this.syncMarkers(this.markers());
    this.drawRoute(this.route());
    this.applyFocus(this.focus());
    this.map.on('click', (e: L.LeafletMouseEvent) => this.mapClick.emit({ lat: e.latlng.lat, lng: e.latlng.lng }));
    this.map.on('moveend', () => {
      const c = this.map!.getCenter();
      this.moveEnd.emit({ lat: c.lat, lng: c.lng });
    });
    // El contenedor puede cambiar de tamaño (rotación, panel lateral): Leaflet necesita recalcular.
    const observer = new ResizeObserver(() => this.map?.invalidateSize());
    observer.observe(this.host().nativeElement);
    this.map.on('unload', () => observer.disconnect());
  }

  private setTiles(dark: boolean): void {
    if (!this.map) return;
    // Los filtros de color de cada tema están en map.component.scss (.fd-dark).
    this.host().nativeElement.classList.toggle('fd-dark', dark);
    const url = dark ? this.config.dark : this.config.light;
    if (this.tiles && this.tileUrl === url) return;
    this.tiles?.remove();
    this.tileUrl = url;
    this.tiles = L.tileLayer(url, { attribution: this.config.attribution, maxZoom: 19 }).addTo(this.map);
  }

  private syncMarkers(markers: MapMarker[]): void {
    if (!this.map) return;
    const ids = new Set(markers.map((m) => m.id));
    for (const [id, layer] of this.markerLayers) {
      if (!ids.has(id)) {
        this.stopGlide(id);
        layer.remove();
        this.markerLayers.delete(id);
        this.iconHtml.delete(id);
        this.headings.delete(id);
      }
    }
    for (const marker of markers) {
      const existing = this.markerLayers.get(marker.id);
      if (existing) {
        const from = existing.getLatLng();
        const start = { lat: from.lat, lng: from.lng };
        if (marker.kind === 'driver' && haversineKm(start, marker.position) * 1000 >= MIN_HEADING_METERS) {
          this.headings.set(marker.id, bearing(start, marker.position));
        }
        this.updateIcon(existing, marker);
        if (marker.kind === 'driver' && !this.reduceMotion) this.glide(marker.id, existing, start, marker.position);
        else existing.setLatLng([marker.position.lat, marker.position.lng]);
      } else {
        const layer = L.marker([marker.position.lat, marker.position.lng], {
          icon: this.icon(marker),
          keyboard: false,
          title: marker.label ?? '',
          zIndexOffset: marker.kind === 'driver' ? 500 : 0,
        });
        this.markerLayers.set(marker.id, layer.addTo(this.map));
      }
    }
  }

  /** Desliza el marcador hasta la nueva posición en lugar de saltar entre reportes del GPS. */
  private glide(id: string, layer: L.Marker, from: LatLng, to: LatLng): void {
    this.stopGlide(id);
    if (from.lat === to.lat && from.lng === to.lng) return;
    const started = performance.now();
    const step = (now: number): void => {
      const t = easeInOut(Math.min(1, (now - started) / GLIDE_MS));
      layer.setLatLng([from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t]);
      if (t < 1) this.glides.set(id, requestAnimationFrame(step));
      else this.glides.delete(id);
    };
    this.glides.set(id, requestAnimationFrame(step));
  }

  private stopGlide(id: string): void {
    const frame = this.glides.get(id);
    if (frame !== undefined) cancelAnimationFrame(frame);
    this.glides.delete(id);
  }

  private updateIcon(layer: L.Marker, marker: MapMarker): void {
    const icon = this.icon(marker);
    const html = String(icon.options.html);
    if (this.iconHtml.get(marker.id) === html) return;
    const element = layer.getElement();
    const arrow = element?.firstElementChild as HTMLElement | null;
    // Mismo tipo de ícono con otro rumbo: se gira la flecha existente para que la transición CSS se vea.
    if (marker.kind === 'driver' && arrow?.classList.contains('fd-mk-driver')) {
      arrow.style.setProperty('--heading', `${this.headingOf(marker)}deg`);
    } else {
      layer.setIcon(icon);
    }
    this.iconHtml.set(marker.id, html);
  }

  private headingOf(marker: MapMarker): number {
    return Math.round(marker.heading ?? this.headings.get(marker.id) ?? 0);
  }

  private icon(marker: MapMarker): L.DivIcon {
    const size = ICON_SIZE[marker.kind];
    const heading = marker.kind === 'driver' ? ` style="--heading:${this.headingOf(marker)}deg"` : '';
    const html = ICON_HTML[marker.kind].replace('<span', `<span${heading}`);
    if (!this.iconHtml.has(marker.id)) this.iconHtml.set(marker.id, html);
    return L.divIcon({ className: 'fd-mk', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }

  private applyFocus(focus: MapFocus | null): void {
    if (!this.map || !focus || focus.key === this.focusKey || focus.points.length === 0) return;
    this.focusKey = focus.key;
    const { top, right, bottom, left } = this.fitPadding();
    const bounds = L.latLngBounds(focus.points.map((p) => [p.lat, p.lng] as L.LatLngTuple));
    this.map.fitBounds(bounds, { paddingTopLeft: [left, top], paddingBottomRight: [right, bottom], maxZoom: 16 });
  }

  /**
   * Dibuja la ruta por las calles. Mientras el servicio de rutas responde (o si falla) se muestra una línea
   * punteada directa, para no presentar como ruta real un trazo que atraviesa manzanas.
   */
  private drawRoute(route: MapRoute | null): void {
    if (!this.map) return;
    const key = route ? routeKey(route.from, route.to) : '';
    if (key === this.routeKey) return;
    this.routeKey = key;
    this.routeRequest?.unsubscribe();
    this.routeLayer?.remove();
    this.routeLayer = undefined;
    if (!route) return;

    this.showRoute([route.from, route.to], false);
    this.routeRequest = this.planner.route(route.from, route.to).subscribe((road) => {
      if (road && key === this.routeKey) this.showRoute(road.path, true);
    });
  }

  private showRoute(path: LatLng[], onRoads: boolean): void {
    if (!this.map) return;
    const points = path.map((p) => [p.lat, p.lng] as L.LatLngTuple);
    this.routeLayer?.remove();
    this.routeLayer = L.layerGroup(
      onRoads
        ? [
            L.polyline(points, { className: 'fd-route', interactive: false }),
            L.polyline(points, { className: 'fd-route-pulse', interactive: false }),
          ]
        : [L.polyline(points, { className: 'fd-route-pending', interactive: false })],
    ).addTo(this.map);
    if (this.fitRoute()) {
      const { top, right, bottom, left } = this.fitPadding();
      this.map.fitBounds(L.latLngBounds(points), {
        paddingTopLeft: [left, top],
        paddingBottomRight: [right, bottom],
        maxZoom: 16,
      });
    }
  }
}
