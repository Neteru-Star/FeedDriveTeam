import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HapticsService } from '@core/device/haptics.service';
import { ApiError } from '@core/http/api-error';
import { LocationService } from '@core/location/location.service';
import { TRIP_STATUS, isForward, type TripStatus } from '@shared/models/trip-status';
import { ToastService } from '@shared/ui/toast/toast.service';

import { DriverApi } from './driver.api';
import type { AssignedTrip, TripSummary } from './driver.models';
import { DriverStore } from './driver.store';
import { addPoint, durationMin, reportedDistance, startTrail } from './trip-trail';

const DONE_MESSAGE: Record<'arrive' | 'start', string> = {
  arrive: 'Avisamos al pasajero que llegaste.',
  start: 'Viaje iniciado. Buen camino.',
};

/**
 * Ejecución del viaje por el conductor (HU-05): llegar al punto, iniciar y finalizar, con la distancia y la duración
 * reales medidas con el GPS. El estado y el rastro se guardan en el teléfono porque no hay un endpoint para consultar
 * el viaje activo del conductor.
 */
@Injectable()
export class DriverTripStore {
  private readonly driver = inject(DriverStore);
  private readonly api = inject(DriverApi);
  private readonly location = inject(LocationService);
  private readonly haptics = inject(HapticsService);
  private readonly toast = inject(ToastService);

  readonly busy = signal(false);
  readonly summary = signal<TripSummary | null>(null);
  readonly trip = this.driver.assigned;
  readonly status = computed<TripStatus>(() => this.trip()?.status ?? 'assigned');
  /** Siguiente acción del conductor según la máquina de estados. */
  readonly action = computed(() => TRIP_STATUS[this.status()].driverAction);
  readonly trail = computed(() => this.trip()?.trail ?? null);

  constructor() {
    // Durante el recorrido, cada posición nueva suma al rastro.
    effect(() => {
      const position = this.location.position();
      if (!position) return;
      untracked(() => {
        const current = this.trip();
        if (current?.status !== 'in_progress' || !current.trail) return;
        const trail = addPoint(current.trail, position, Date.now());
        if (trail !== current.trail) void this.driver.updateAssigned({ ...current, trail });
      });
    });
  }

  /** Ejecuta la acción del estado actual: llegar, iniciar o finalizar. */
  async advance(): Promise<void> {
    const current = this.trip();
    const action = this.action();
    if (!current || !action || this.busy()) return;
    this.busy.set(true);
    try {
      if (action.action === 'complete') await this.complete(current);
      else {
        await this.api.advance(current.trip.id, action.action);
        const status = TRIP_STATUS[this.status()].next!;
        const trail = status === 'in_progress' ? startTrail(Date.now(), this.location.position()) : current.trail;
        await this.driver.updateAssigned({ ...current, status, trail });
        this.haptics.success();
        void this.toast.success(DONE_MESSAGE[action.action]);
      }
    } catch (error) {
      this.haptics.error();
      await this.recover(current, error);
    } finally {
      this.busy.set(false);
    }
  }

  /** Cierra el resumen y vuelve a recibir solicitudes. */
  async finish(): Promise<void> {
    this.summary.set(null);
    await this.driver.releaseTrip();
  }

  private async complete(current: AssignedTrip): Promise<void> {
    const trail = current.trail ?? startTrail(Date.now(), null);
    const distance = reportedDistance(trail, current.request.estimated_distance_km);
    const completed = await this.api.complete(current.trip.id, {
      actual_distance_km: distance.km,
      actual_duration_min: durationMin(trail, Date.now()),
    });
    this.haptics.success();
    this.summary.set({ completed, request: current.request, distanceSource: distance.source });
    await this.driver.showSummary();
  }

  /**
   * El backend rechazó la acción (400 con `current_status`): el viaje cambió sin que el conductor lo supiera.
   * Si el pasajero lo canceló, se libera; si ya iba más adelante, se sincroniza el estado.
   */
  private async recover(current: AssignedTrip, error: unknown): Promise<void> {
    const status = error instanceof ApiError ? error.body['current_status'] : undefined;
    if (status === 'cancelled' || (error instanceof ApiError && error.status === 404)) {
      void this.toast.error('El pasajero canceló el viaje.');
      await this.driver.releaseTrip();
      return;
    }
    if (status === 'completed') {
      void this.toast.info('Este viaje ya fue finalizado.');
      await this.driver.releaseTrip();
      return;
    }
    if (typeof status === 'string' && status in TRIP_STATUS && isForward(this.status(), status as TripStatus)) {
      const next = status as TripStatus;
      const trail =
        next === 'in_progress' && !current.trail ? startTrail(Date.now(), this.location.position()) : current.trail;
      await this.driver.updateAssigned({ ...current, status: next, trail });
      void this.toast.info(`El viaje ya estaba en "${TRIP_STATUS[next].label}".`);
      return;
    }
    void this.toast.error(
      error instanceof ApiError ? error.message : 'No pudimos actualizar el viaje. Inténtalo de nuevo.',
    );
  }
}
