import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { APP_CONFIG } from '@core/config/app-config';
import { HapticsService } from '@core/device/haptics.service';
import { ApiError } from '@core/http/api-error';
import { LocationService } from '@core/location/location.service';
import { ToastService } from '@shared/ui/toast/toast.service';
import { haversineKm } from '@shared/utils/geo';
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

import { DriverSessionStorage } from './driver-session.storage';
import { DriverApi } from './driver.api';
import type { ApprovalStatus, AssignedTrip, DriverRideRequest } from './driver.models';
import { LocationReporter } from './location-reporter';

/**
 * Lo que ve el conductor:
 * - `checking`: consultando si su cuenta está aprobada.
 * - `review`: cuenta pendiente, rechazada o suspendida (403 con `approval_status`).
 * - `offline` / `online`: desconectado o recibiendo solicitudes; `switching` mientras cambia.
 * - `assigned`: aceptó un viaje (la Fase 8 lo lleva hasta el final).
 */
export type DriverMode = 'checking' | 'review' | 'offline' | 'switching' | 'online' | 'assigned';

/** Solicitud con la distancia de recogida calculada desde el GPS del conductor (si el backend envía el origen). */
export interface NearbyRequest extends DriverRideRequest {
  pickupKm: number | null;
}

/** Rechazos que se recuerdan; los más viejos ya no estarán pendientes. */
const MAX_HIDDEN = 50;

/** Lo que tarda en desaparecer una solicitud que otro conductor tomó, para que se entienda qué pasó. */
export const TAKEN_FEEDBACK_MS = 1_800;

export type GoOnlineResult = 'ok' | 'no-location' | 'review' | 'failed';

/** Disponibilidad, solicitudes cercanas y aceptación del conductor (HU-04). */
@Injectable()
export class DriverStore {
  private readonly api = inject(DriverApi);
  private readonly storage = inject(DriverSessionStorage);
  private readonly location = inject(LocationService);
  private readonly reporter = inject(LocationReporter);
  private readonly haptics = inject(HapticsService);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly interval = inject(APP_CONFIG).pollIntervalMs;

  readonly mode = signal<DriverMode>('checking');
  readonly approval = signal<ApprovalStatus | null>(null);
  readonly assigned = signal<AssignedTrip | null>(null);
  /** Solicitud que se está aceptando. */
  readonly accepting = signal<number | null>(null);
  /** Solicitudes que otro conductor tomó primero (409), visibles un momento antes de quitarlas. */
  readonly taken = signal<ReadonlySet<number>>(new Set());
  /** Texto para el aviso `aria-live` cuando llegan solicitudes nuevas. */
  readonly announcement = signal('');

  private readonly pending = signal<DriverRideRequest[]>([]);
  /** "Rechazar" no existe en el backend: solo se ocultan en este teléfono. */
  private readonly hidden = signal<ReadonlySet<number>>(new Set());
  private polling?: Subscription;
  private seen = new Set<number>();

  /** Solicitudes visibles, de la más cercana a la más lejana; sin coordenadas, la más reciente primero. */
  readonly requests = computed<NearbyRequest[]>(() => {
    const me = this.location.position();
    const hidden = this.hidden();
    return this.pending()
      .filter((r) => !hidden.has(r.id))
      .map((r) => ({
        ...r,
        pickupKm:
          me && r.origin_latitude !== undefined && r.origin_longitude !== undefined
            ? haversineKm(me, { lat: r.origin_latitude, lng: r.origin_longitude })
            : null,
      }))
      .sort((a, b) => (a.pickupKm ?? Infinity) - (b.pickupKm ?? Infinity) || b.id - a.id);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  /** Al abrir la pantalla: retoma el viaje asignado, consulta la aprobación y vuelve a conectarse si estaba en línea. */
  async init(): Promise<void> {
    const session = await this.storage.load();
    this.hidden.set(new Set(session.hidden ?? []));
    if (session.assigned) {
      this.showAssigned(session.assigned);
      return;
    }
    // `/auth/me` no trae el perfil del conductor: la lista de solicitudes responde 403 si no está aprobado.
    try {
      this.pending.set(await this.api.rideRequests());
      this.approval.set('approved');
    } catch (error) {
      if (this.toReview(error)) return;
    }
    this.mode.set('offline');
    if (session.online) await this.goOnline();
  }

  /** Vuelve a consultar la aprobación desde la pantalla de "cuenta en revisión". */
  async recheckApproval(): Promise<void> {
    this.mode.set('checking');
    await this.init();
    if (this.mode() === 'review') void this.toast.info('Tu cuenta sigue en revisión.');
  }

  async goOnline(): Promise<GoOnlineResult> {
    if (!(await this.location.locate())) {
      void this.toast.error('Activa tu ubicación para recibir viajes.');
      return 'no-location';
    }
    this.mode.set('switching');
    try {
      await this.api.setAvailability('available');
    } catch (error) {
      if (this.toReview(error)) return 'review';
      this.mode.set('offline');
      void this.toast.error(error instanceof ApiError ? error.message : 'No pudimos conectarte. Inténtalo de nuevo.');
      return 'failed';
    }
    this.approval.set('approved');
    this.mode.set('online');
    await this.persist(true, null);
    this.reporter.setTrip(null);
    this.reporter.start();
    this.startPolling();
    return 'ok';
  }

  async goOffline(): Promise<void> {
    this.mode.set('switching');
    try {
      await this.api.setAvailability('unavailable');
    } catch (error) {
      this.mode.set('online');
      void this.toast.error(
        error instanceof ApiError ? error.message : 'No pudimos desconectarte. Inténtalo de nuevo.',
      );
      return;
    }
    this.stopPolling();
    await this.reporter.stop();
    this.pending.set([]);
    this.seen.clear();
    this.mode.set('offline');
    await this.persist(false, null);
  }

  reject(id: number): void {
    this.hidden.update((ids) => new Set([...ids, id].slice(-MAX_HIDDEN)));
    void this.persist(this.mode() === 'online', this.assigned());
  }

  private persist(online: boolean, assigned: AssignedTrip | null): Promise<void> {
    return this.storage.save({ online, assigned, hidden: [...this.hidden()] });
  }

  async accept(request: NearbyRequest): Promise<void> {
    if (this.accepting() !== null) return;
    this.accepting.set(request.id);
    try {
      const trip = await this.api.accept(request.id);
      this.haptics.success();
      const { pickupKm: _, ...plain } = request;
      const assigned: AssignedTrip = { trip, request: plain };
      await this.persist(true, assigned);
      this.showAssigned(assigned);
      void this.toast.success('¡Viaje aceptado! Dirígete al punto de partida.');
    } catch (error) {
      this.haptics.error();
      if (error instanceof ApiError && error.status === 409) {
        this.markTaken(request.id);
        void this.toast.error('Otro conductor tomó este viaje primero.');
      } else if (!this.toReview(error)) {
        void this.toast.error(error instanceof ApiError ? error.message : 'No pudimos aceptar el viaje.');
        void this.refresh();
      }
    } finally {
      this.accepting.set(null);
    }
  }

  /** Se libera el viaje asignado (la Fase 8 lo llama al finalizarlo) y el conductor vuelve a estar en línea. */
  async releaseTrip(): Promise<void> {
    this.assigned.set(null);
    this.reporter.setTrip(null);
    this.mode.set('online');
    await this.persist(true, null);
    this.startPolling();
  }

  private showAssigned(assigned: AssignedTrip): void {
    this.stopPolling();
    this.assigned.set(assigned);
    this.approval.set('approved');
    this.mode.set('assigned');
    this.reporter.setTrip(assigned.trip.id);
    this.reporter.start();
  }

  private markTaken(id: number): void {
    this.taken.update((ids) => new Set(ids).add(id));
    setTimeout(() => {
      this.pending.update((list) => list.filter((r) => r.id !== id));
      this.taken.update((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    }, TAKEN_FEEDBACK_MS);
  }

  private async refresh(): Promise<void> {
    try {
      const requests = await this.api.rideRequests();
      if (this.mode() !== 'online') return;
      const fresh = requests.filter((r) => !this.seen.has(r.id) && !this.hidden().has(r.id));
      if (fresh.length) {
        this.haptics.tap();
        this.announcement.set(
          fresh.length === 1
            ? `Nueva solicitud: de ${fresh[0].origin_name} a ${fresh[0].destination_name}.`
            : `${fresh.length} solicitudes nuevas.`,
        );
      }
      for (const r of requests) this.seen.add(r.id);
      // Las que otro conductor tomó se dejan un momento para mostrar el aviso.
      const taken = this.taken();
      const kept = this.pending().filter((r) => taken.has(r.id) && !requests.some((n) => n.id === r.id));
      this.pending.set([...requests, ...kept]);
    } catch (error) {
      this.toReview(error);
    }
  }

  /** Un 403 con `approval_status` significa que la cuenta no está aprobada (o la suspendieron). */
  private toReview(error: unknown): boolean {
    if (!(error instanceof ApiError) || error.status !== 403) return false;
    const status = error.body['approval_status'];
    this.approval.set(isApproval(status) ? status : 'pending');
    this.stopPolling();
    void this.reporter.stop();
    this.mode.set('review');
    void this.persist(false, null);
    return true;
  }

  private startPolling(): void {
    if (this.polling) return;
    for (const r of this.pending()) this.seen.add(r.id);
    const visible$ = fromEvent(this.document, 'visibilitychange').pipe(
      startWith(null),
      map(() => !this.document.hidden),
    );
    this.polling = visible$
      .pipe(
        switchMap((visible) => (visible ? timer(0, this.interval) : EMPTY)),
        exhaustMap(() => from(this.refresh()).pipe(catchError(() => EMPTY))),
      )
      .subscribe();
  }

  private stopPolling(): void {
    this.polling?.unsubscribe();
    this.polling = undefined;
  }
}

function isApproval(value: unknown): value is ApprovalStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected' || value === 'suspended';
}
