import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Geocoder, type Place } from '@core/geo/geocoder';
import { IonIcon } from '@ionic/angular/ion-icon';
import type { LatLng } from '@shared/utils/geo';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';

import type { PointKind } from '../data-access/trip-draft.store';

/** Nominatim pide como máximo una petición por segundo: se espera a que el usuario deje de escribir. */
const DEBOUNCE_MS = 600;
const MIN_CHARS = 3;

interface SearchState {
  loading: boolean;
  places: Place[];
  failed: boolean;
}

const IDLE: SearchState = { loading: false, places: [], failed: false };

/** Campos de origen y destino con sugerencias de direcciones y la opción de elegir en el mapa. */
@Component({
  selector: 'app-place-search',
  imports: [IonIcon],
  templateUrl: 'place-search.component.html',
  styleUrl: 'place-search.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceSearchComponent {
  private readonly geocoder = inject(Geocoder);

  readonly originLabel = input('');
  readonly destinationLabel = input('');
  /** Posición para priorizar resultados cercanos. */
  readonly near = input<LatLng | null>(null);

  readonly selected = output<{ kind: PointKind; place: Place }>();
  readonly pickOnMap = output<PointKind>();

  protected readonly originText = linkedSignal(() => this.originLabel());
  protected readonly destinationText = linkedSignal(() => this.destinationLabel());
  protected readonly active = signal<PointKind | null>(null);

  private readonly query = signal({ kind: 'destination' as PointKind, text: '' });

  protected readonly search = toSignal(
    toObservable(this.query).pipe(
      debounceTime(DEBOUNCE_MS),
      map((q) => q.text.trim()),
      distinctUntilChanged(),
      switchMap((text) =>
        text.length < MIN_CHARS
          ? of(IDLE)
          : this.geocoder.search(text, this.near()).pipe(
              map((places): SearchState => ({ loading: false, places, failed: false })),
              catchError(() => of<SearchState>({ loading: false, places: [], failed: true })),
              startWith<SearchState>({ loading: true, places: [], failed: false }),
            ),
      ),
    ),
    { initialValue: IDLE },
  );

  protected type(kind: PointKind, event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    (kind === 'origin' ? this.originText : this.destinationText).set(text);
    this.active.set(kind);
    this.query.set({ kind, text });
  }

  protected focus(kind: PointKind): void {
    this.active.set(kind);
    const text = kind === 'origin' ? this.originText() : this.destinationText();
    // Al volver a un campo ya elegido no se busca su etiqueta ("Mi ubicación actual · …").
    const label = kind === 'origin' ? this.originLabel() : this.destinationLabel();
    this.query.set({ kind, text: text === label ? '' : text });
  }

  protected choose(place: Place): void {
    const kind = this.active();
    if (!kind) return;
    this.selected.emit({ kind, place });
    this.close();
  }

  protected chooseOnMap(): void {
    const kind = this.active() ?? 'destination';
    this.pickOnMap.emit(kind);
    this.close();
  }

  protected typedEnough(): boolean {
    const text = this.active() === 'origin' ? this.originText() : this.destinationText();
    return text.trim().length >= MIN_CHARS;
  }

  private close(): void {
    this.active.set(null);
    this.query.set({ kind: 'destination', text: '' });
  }
}
