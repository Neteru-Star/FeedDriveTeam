import { signal } from '@angular/core';
import { APP_CONFIG } from '@core/config/app-config';
import { RoutePlanner, type RoadRoute } from '@core/geo/route-planner';
import { ThemeService } from '@core/theme/theme.service';
import { render } from '@testing-library/angular';
import { Subject, of, type Observable } from 'rxjs';

import { GLIDE_MS, MapComponent } from './map.component';
import type { MapMarker } from './map.models';

const tiles = {
  light: 'https://tiles.test/light/{z}/{x}/{y}.png',
  dark: 'https://tiles.test/dark/{z}/{x}/{y}.png',
  attribution: 'OSM',
};
const PARQUE_93 = { lat: 4.6766, lng: -74.0483 };
const ANDINO = { lat: 4.6664, lng: -74.0536 };

const VIRREY = { lat: 4.6732, lng: -74.0539 };
/** Ruta por calles de prueba: pasa por una esquina intermedia. */
const road: RoadRoute = { path: [PARQUE_93, VIRREY, ANDINO], distanceKm: 1.6, durationMin: 6 };

describe('MapComponent', () => {
  const dark = signal(false);
  let requested: string[];
  let plan: () => Observable<RoadRoute | null>;

  async function setup(inputs: Record<string, unknown> = {}) {
    const view = await render(MapComponent, {
      inputs,
      providers: [
        { provide: APP_CONFIG, useValue: { mapTiles: tiles } },
        { provide: ThemeService, useValue: { dark } },
        {
          provide: RoutePlanner,
          useValue: {
            route: (from: { lat: number }, to: { lat: number }) => (requested.push(`${from.lat}>${to.lat}`), plan()),
          },
        },
      ],
    });
    view.fixture.detectChanges();
    await view.fixture.whenStable();
    return view;
  }

  beforeEach(() => {
    dark.set(false);
    requested = [];
    plan = () => of(road);
  });

  it('draws a custom marker per point, with the driver pointing to its heading', async () => {
    const markers: MapMarker[] = [
      { id: 'me', kind: 'user', position: PARQUE_93 },
      { id: 'driver', kind: 'driver', position: ANDINO, heading: 135 },
    ];
    const { container } = await setup({ markers });

    expect(container.querySelector('.fd-mk-user')).not.toBeNull();
    expect(container.querySelector<HTMLElement>('.fd-mk-driver')?.style.getPropertyValue('--heading')).toBe('135deg');
  });

  it('moves a marker instead of drawing it twice when its position changes', async () => {
    const view = await setup({ markers: [{ id: 'driver', kind: 'driver', position: PARQUE_93 }] });

    view.fixture.componentRef.setInput('markers', [{ id: 'driver', kind: 'driver', position: ANDINO }]);
    view.fixture.detectChanges();

    expect(view.container.querySelectorAll('.fd-mk-driver')).toHaveLength(1);
  });

  it('glides the driver to its new position and turns it towards where it moves', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    try {
      const view = await setup({ markers: [{ id: 'driver', kind: 'driver', position: PARQUE_93 }] });
      const element = view.container.querySelector<HTMLElement>('.leaflet-marker-icon')!;
      // Leaflet ubica el marcador con transform o con left/top según el navegador: se compara el estilo completo.
      const position = (): string => `${element.style.transform}|${element.style.left}|${element.style.top}`;
      const before = position();

      view.fixture.componentRef.setInput('markers', [{ id: 'driver', kind: 'driver', position: ANDINO }]);
      view.fixture.detectChanges();
      vi.advanceTimersByTime(GLIDE_MS / 2);
      const halfway = position();
      vi.advanceTimersByTime(GLIDE_MS);

      expect(halfway).not.toBe(before);
      expect(position()).not.toBe(halfway);
      // Andino queda al sur-suroeste de Parque 93: rumbo entre 180° y 270°.
      const heading = parseFloat(
        element.querySelector<HTMLElement>('.fd-mk-driver')!.style.getPropertyValue('--heading'),
      );
      expect(heading).toBeGreaterThan(180);
      expect(heading).toBeLessThan(270);
    } finally {
      vi.useRealTimers();
    }
  });

  it('frames the focus points only when their key changes', async () => {
    const view = await setup({ focus: { key: 'a', points: [PARQUE_93, ANDINO] } });
    const map = view.container.querySelector<HTMLElement>('.leaflet-map-pane')!;
    const framed = map.style.transform;

    view.fixture.componentRef.setInput('focus', { key: 'a', points: [{ lat: 4.8, lng: -74.2 }, ANDINO] });
    view.fixture.detectChanges();
    expect(map.style.transform).toBe(framed);
  });

  it('draws the route along the roads, with its pulse', async () => {
    const { container } = await setup({ route: { from: PARQUE_93, to: ANDINO } });

    expect(container.querySelector('path.fd-route')).not.toBeNull();
    expect(container.querySelector('path.fd-route-pulse')).not.toBeNull();
    expect(container.querySelector('path.fd-route-pending')).toBeNull();
  });

  it('shows a dotted direct line while the road route is being calculated', async () => {
    const pending = new Subject<RoadRoute | null>();
    plan = () => pending;
    const { container, fixture } = await setup({ route: { from: PARQUE_93, to: ANDINO } });

    expect(container.querySelector('path.fd-route-pending')).not.toBeNull();
    expect(container.querySelector('path.fd-route')).toBeNull();

    pending.next(road);
    fixture.detectChanges();
    expect(container.querySelector('path.fd-route-pending')).toBeNull();
    expect(container.querySelector('path.fd-route')).not.toBeNull();
  });

  it('keeps the dotted line when the road route cannot be calculated', async () => {
    plan = () => of(null);
    const { container } = await setup({ route: { from: PARQUE_93, to: ANDINO } });

    expect(container.querySelector('path.fd-route-pending')).not.toBeNull();
    expect(container.querySelector('path.fd-route')).toBeNull();
  });

  it('does not redraw or ask again when the same route arrives in a new object', async () => {
    const { container, fixture } = await setup({ route: { from: PARQUE_93, to: ANDINO } });
    const drawn = container.querySelector('path.fd-route');

    fixture.componentRef.setInput('route', { from: { ...PARQUE_93 }, to: { ...ANDINO } });
    fixture.detectChanges();

    expect(requested).toHaveLength(1);
    expect(container.querySelector('path.fd-route')).toBe(drawn);

    fixture.componentRef.setInput('route', { from: PARQUE_93, to: VIRREY });
    fixture.detectChanges();
    expect(requested).toHaveLength(2);
  });

  it('ignores a late answer for a route that is no longer shown', async () => {
    const first = new Subject<RoadRoute | null>();
    plan = () => first;
    const { container, fixture } = await setup({ route: { from: PARQUE_93, to: ANDINO } });

    fixture.componentRef.setInput('route', null);
    fixture.detectChanges();
    first.next(road);

    expect(container.querySelector('path.fd-route')).toBeNull();
    expect(container.querySelector('path.fd-route-pending')).toBeNull();
  });

  it('switches the map style with the dark theme', async () => {
    const { container, fixture } = await setup();
    const map = container.querySelector('.fd-map')!;
    expect(map.classList.contains('fd-dark')).toBe(false);

    dark.set(true);
    fixture.detectChanges();

    expect(map.classList.contains('fd-dark')).toBe(true);
  });

  it('reports taps on the map', async () => {
    const { container, fixture } = await setup();
    const clicks: unknown[] = [];
    fixture.componentInstance.mapClick.subscribe((point) => clicks.push(point));

    container
      .querySelector('.fd-map')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));

    expect(clicks).toHaveLength(1);
  });
});
