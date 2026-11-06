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
import { ThemeService } from '@core/theme/theme.service';
import { BOGOTA, curvedRoute, type LatLng } from '@shared/utils/geo';
import * as L from 'leaflet';

import type { MapMarker, MapPadding, MapRoute } from './map.models';

const ICON_HTML: Record<MapMarker['kind'], string> = {
  user: '<span class="fd-mk-user"><i></i></span>',
  origin: '<span class="fd-mk-origin"></span>',
  destination: '<span class="fd-mk-destination"></span>',
  driver:
    '<span class="fd-mk-driver"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 18-7-4-7 4z"/></svg></span>',
};

const ICON_SIZE: Record<MapMarker['kind'], number> = { user: 22, origin: 18, destination: 18, driver: 34 };

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

  readonly mapClick = output<LatLng>();
  /** Centro del mapa cada vez que el usuario termina de moverlo. */
  readonly moveEnd = output<LatLng>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly config = inject(APP_CONFIG).mapTiles;
  private readonly theme = inject(ThemeService);

  private map?: L.Map;
  private tiles?: L.TileLayer;
  private tileUrl = '';
  private readonly markerLayers = new Map<string, L.Marker>();
  private routeLayer?: L.LayerGroup;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.init();
      destroyRef.onDestroy(() => this.map?.remove());
    });

    effect(() => this.setTiles(this.theme.dark()));
    effect(() => {
      const center = this.center();
      untracked(() => this.map?.setView([center.lat, center.lng], this.map.getZoom(), { animate: true }));
    });
    effect(() => this.syncMarkers(this.markers()));
    effect(() => this.drawRoute(this.route()));
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
    this.map.attributionControl.setPrefix(false);
    this.setTiles(this.theme.dark());
    this.syncMarkers(this.markers());
    this.drawRoute(this.route());
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
        layer.remove();
        this.markerLayers.delete(id);
      }
    }
    for (const marker of markers) {
      const existing = this.markerLayers.get(marker.id);
      const latLng: L.LatLngExpression = [marker.position.lat, marker.position.lng];
      if (existing) {
        existing.setLatLng(latLng);
        existing.setIcon(this.icon(marker));
      } else {
        const layer = L.marker(latLng, {
          icon: this.icon(marker),
          keyboard: false,
          title: marker.label ?? '',
          zIndexOffset: marker.kind === 'driver' ? 500 : 0,
        });
        this.markerLayers.set(marker.id, layer.addTo(this.map));
      }
    }
  }

  private icon(marker: MapMarker): L.DivIcon {
    const size = ICON_SIZE[marker.kind];
    const heading = marker.kind === 'driver' ? ` style="--heading:${marker.heading ?? 0}deg"` : '';
    return L.divIcon({
      className: 'fd-mk',
      html: ICON_HTML[marker.kind].replace('<span', `<span${heading}`),
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  private drawRoute(route: MapRoute | null): void {
    if (!this.map) return;
    this.routeLayer?.remove();
    this.routeLayer = undefined;
    if (!route) return;
    const points = curvedRoute(route.from, route.to).map((p) => [p.lat, p.lng] as L.LatLngTuple);
    this.routeLayer = L.layerGroup([
      L.polyline(points, { className: 'fd-route', interactive: false }),
      L.polyline(points, { className: 'fd-route-pulse', interactive: false }),
    ]).addTo(this.map);
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
