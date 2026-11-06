import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { APP_CONFIG } from '@core/config/app-config';
import { ApiError } from '@core/http/api-error';
import { canCancel, isForward } from '@shared/models/trip-status';
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
  | { kind: 'trip'; trip: ActiveTrip; request: RideRequest | null }
  | { kind: 'ended'; trip: ActiveTrip; request: RideRequest | null; outcome: TripOutcome; finalFare: number | null };

export type TripOutcome = 'completed' | 'cancelled';

/** Motivos de cancelación sugeridos al pasajero (el backend acepta texto libre de hasta 255 caracteres). */
export const CANCEL_REASON_MAX = 255;

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

  /** Se puede cancelar lo que hay en pantalla: la búsqueda o un viaje que aún no inicia el recorrido. */
  readonly cancellable = computed(() => {
    const state = this.state();
    return state.kind === 'searching' || (state.kind === 'trip' && canCancel(state.trip.status, 'client'));
  });

  /** El pasajero cancela la búsqueda o el viaje con un motivo. Devuelve si se canceló. */
  async cancel(reason: string): Promise<boolean> {
    const state = this.state();
    if (!this.cancellable()) {
      if (state.kind === 'trip') void this.toast.error('Tu viaje ya inició y no se puede cancelar.');
      return false;
    }
    const text = reason.trim().slice(0, CANCEL_REASON_MAX) || 'Cancelado por el pasajero';
    const ids =
      state.kind === 'searching'
        ? [state.request.id]
        : state.kind === 'trip'
          ? [state.trip.id, state.trip.request_id ?? state.request?.id]
          : [];
    this.stopPolling();
    try {
      await this.cancelFirstFound(ids, text);
      await this.reset();
      void this.toast.info(state.kind === 'searching' ? 'Cancelaste la solicitud.' : 'Cancelaste el viaje.');
      return true;
    } catch (error) {
      // Lo más probable: el viaje avanzó (un conductor aceptó o ya inició el recorrido). Se muestra el estado real.
      void this.toast.error(error instanceof ApiError ? error.message : 'No pudimos cancelar. Inténtalo de nuevo.');
      await this.refresh().catch(() => this.startPolling());
      return false;
    }
  }

  /**
   * `POST /client/cancel/{id}`: la documentación no dice si el id es del viaje o de la solicitud.
   * Se usa el `id` que trae `/client/active` según `type` y, si el backend responde 404, el de la solicitud.
   */
  private async cancelFirstFound(ids: (number | undefined)[], reason: string): Promise<void> {
    const candidates = [...new Set(ids.filter((id): id is number => id !== undefined))];
    for (const [index, id] of candidates.entries()) {
      try {
        await this.api.cancel(id, reason);
        return;
      } catch (error) {
        const notFound = error instanceof ApiError && error.status === 404;
        if (!notFound || index === candidates.length - 1) throw error;
      }
    }
  }

  /** Cierra el aviso de "sin conductores" o el resumen del viaje terminado y vuelve a planear. */
  async dismiss(): Promise<void> {
    await this.reset();
  }

  private async refresh(): Promise<void> {
    await this.apply(await this.api.active(), this.request());
  }

  private async apply(active: ClientActive, saved: RideRequest | null): Promise<void> {
    const current = this.state();
    if (!active.has_active) {
      if (current.kind === 'searching') void this.toast.info('Tu solicitud ya no está activa.');
      if (current.kind === 'trip') await this.finish(current.trip, current.request);
      else if (current.kind !== 'no-drivers' && current.kind !== 'ended') await this.reset();
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
      // Una respuesta atrasada no puede devolver el viaje a un estado anterior.
      if (current.kind === 'trip' && current.trip.id === trip.id && !isForward(current.trip.status, trip.status)) {
        return;
      }
      const request = saved && (trip.request_id === undefined || trip.request_id === saved.id) ? saved : null;
      this.state.set({ kind: 'trip', trip, request });
    }
    this.startPolling();
  }

  /**
   * El viaje dejó de estar activo. `/client/active` no dice cómo terminó, así que se busca en el historial;
   * sin historial se deduce: si ya iba en camino, terminó; si no, lo cancelaron.
   */
  private async finish(trip: ActiveTrip, request: RideRequest | null): Promise<void> {
    this.stopPolling();
    await this.storage.clear();
    const summary = await this.api
      .trips()
      .then((trips) => trips.find((t) => t.id === trip.id))
      .catch(() => undefined);
    const outcome: TripOutcome =
      summary?.status === 'completed' || summary?.status === 'cancelled'
        ? summary.status
        : trip.status === 'in_progress'
          ? 'completed'
          : 'cancelled';
    this.state.set({
      kind: 'ended',
      trip: { ...trip, status: outcome },
      request,
      outcome,
      finalFare: summary?.final_fare ?? null,
    });
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
