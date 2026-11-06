import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { APP_CONFIG } from '@core/config/app-config';
import { ApiError } from '@core/http/api-error';
import { ToastService } from '@shared/ui/toast/toast.service';
import {
  EMPTY,
  catchError,
  exhaustMap,
  from,
  fromEvent,
  map,
  startWith,
  switchMap,
  timer,
  type Subscription,
} from 'rxjs';

import { ActiveRideStorage } from './active-ride.storage';
import { ClientApi } from './client.api';
import type { ActiveTrip, ClientActive, RideRequest, RideRequestPayload } from './client.models';

/** Si nadie acepta en este tiempo, la solicitud se cancela (HU-03). */
export const SEARCH_TIMEOUT_MS = 2 * 60_000;

export type RideState =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'searching'; request: RideRequest; since: number }
  | { kind: 'no-drivers'; request: RideRequest }
  | { kind: 'trip'; trip: ActiveTrip; request: RideRequest | null };

/** Resultado de pedir un viaje: el 400 de "ya tienes un viaje activo" se resuelve en la pantalla. */
export type RequestResult = 'ok' | 'already-active' | 'failed';

/**
 * Solicitud y viaje activos del pasajero. No hay WebSocket: mientras hay algo activo se consulta
 * `GET /client/active` cada `pollIntervalMs`, y se pausa cuando la app pasa a segundo plano.
 */
@Injectable()
export class ActiveRideStore {
  private readonly api = inject(ClientApi);
  private readonly storage = inject(ActiveRideStorage);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly interval = inject(APP_CONFIG).pollIntervalMs;

  readonly state = signal<RideState>({ kind: 'idle' });
  /** Solicitud a la que pertenece lo que se muestra (para la ruta y el precio). */
  readonly request = computed(() => {
    const state = this.state();
    return 'request' in state ? state.request : null;
  });

  private polling?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  /** Al abrir la app: retoma una solicitud o un viaje en curso. */
  async restore(): Promise<void> {
    try {
      await this.apply(await this.api.active(), await this.storage.load());
    } catch {
      // Sin conexión no se puede saber; la próxima acción del pasajero lo volverá a intentar.
    }
  }

  async requestRide(payload: RideRequestPayload): Promise<RequestResult> {
    this.state.set({ kind: 'requesting' });
    try {
      const request = await this.api.requestRide(payload);
      await this.storage.save(request);
      this.state.set({ kind: 'searching', request, since: Date.now() });
      this.startPolling();
      return 'ok';
    } catch (error) {
      this.state.set({ kind: 'idle' });
      if (error instanceof ApiError && error.status === 400 && error.body['active_request_id']) return 'already-active';
      void this.toast.error(
        error instanceof ApiError ? error.message : 'No pudimos solicitar el viaje. Inténtalo de nuevo.',
      );
      return 'failed';
    }
  }

  /** El pasajero cancela mientras se busca conductor. */
  async cancelSearch(): Promise<void> {
    const state = this.state();
    if (state.kind !== 'searching') return;
    this.stopPolling();
    try {
      await this.api.cancel(state.request.id, 'Cancelado por el pasajero');
      await this.reset();
    } catch (error) {
      // Lo más probable: un conductor aceptó justo antes. Se muestra el estado real.
      void this.toast.error(error instanceof ApiError ? error.message : 'No pudimos cancelar la solicitud.');
      await this.refresh();
    }
  }

  /** Cierra el aviso de "sin conductores" y vuelve a planear. */
  async dismiss(): Promise<void> {
    await this.reset();
  }

  private async refresh(): Promise<void> {
    await this.apply(await this.api.active(), this.request());
  }

  private async apply(active: ClientActive, saved: RideRequest | null): Promise<void> {
    if (!active.has_active) {
      const previous = this.state().kind;
      if (previous === 'searching') void this.toast.info('Tu solicitud ya no está activa.');
      if (previous === 'trip') void this.toast.success('Tu viaje terminó.');
      if (previous !== 'no-drivers') await this.reset();
      return;
    }
    if (active.type === 'request') {
      const request = active.data;
      const since = this.searchStart(request);
      if (Date.now() - since >= SEARCH_TIMEOUT_MS) {
        await this.timeout(request);
        return;
      }
      this.state.set({ kind: 'searching', request, since });
      if (saved?.id !== request.id) await this.storage.save(request);
    } else {
      const trip = active.data;
      const request = saved && (trip.request_id === undefined || trip.request_id === saved.id) ? saved : null;
      this.state.set({ kind: 'trip', trip, request });
    }
    this.startPolling();
  }

  /** Inicio de la búsqueda: el local si ya se estaba buscando; si no, la hora de creación (acotada por desfases de reloj). */
  private searchStart(request: RideRequest): number {
    const state = this.state();
    if (state.kind === 'searching' && state.request.id === request.id) return state.since;
    const created = Date.parse(request.created_at);
    return Number.isNaN(created) || created > Date.now() ? Date.now() : created;
  }

  private async timeout(request: RideRequest): Promise<void> {
    this.stopPolling();
    try {
      await this.api.cancel(request.id, 'Sin conductores disponibles');
    } catch {
      // Si no se pudo cancelar, quizá un conductor aceptó en el último segundo.
      const active = await this.api.active().catch(() => null);
      if (active?.has_active && active.type === 'trip') {
        await this.apply(active, request);
        return;
      }
    }
    await this.storage.clear();
    this.state.set({ kind: 'no-drivers', request });
  }

  private startPolling(): void {
    if (this.polling) return;
    const visible$ = fromEvent(this.document, 'visibilitychange').pipe(
      startWith(null),
      map(() => !this.document.hidden),
    );
    this.polling = visible$
      .pipe(
        switchMap((visible) => (visible ? timer(this.interval, this.interval) : EMPTY)),
        exhaustMap(() => from(this.refresh()).pipe(catchError(() => EMPTY))),
      )
      .subscribe();
  }

  private stopPolling(): void {
    this.polling?.unsubscribe();
    this.polling = undefined;
  }

  private async reset(): Promise<void> {
    this.stopPolling();
    await this.storage.clear();
    this.state.set({ kind: 'idle' });
  }
}
