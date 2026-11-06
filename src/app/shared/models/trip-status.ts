/** Máquina de estados del viaje. La UI lee labels, tonos y transiciones solo desde aquí. */
export type TripStatus = 'requested' | 'assigned' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled';

export type StatusTone = 'warning' | 'info' | 'violet' | 'primary' | 'neutral' | 'danger';

export interface TripStatusMeta {
  label: string;
  tone: StatusTone;
  next: TripStatus | null;
  live: boolean;
}

export const TRIP_STATUS: Record<TripStatus, TripStatusMeta> = {
  requested: { label: 'Buscando conductor', tone: 'warning', next: 'assigned', live: true },
  assigned: { label: 'Conductor asignado', tone: 'info', next: 'driver_arrived', live: true },
  driver_arrived: { label: 'Conductor en el punto', tone: 'violet', next: 'in_progress', live: true },
  in_progress: { label: 'En curso', tone: 'primary', next: 'completed', live: true },
  completed: { label: 'Completado', tone: 'neutral', next: null, live: false },
  cancelled: { label: 'Cancelado', tone: 'danger', next: null, live: false },
};

export const TRIP_STATUSES = Object.keys(TRIP_STATUS) as TripStatus[];
