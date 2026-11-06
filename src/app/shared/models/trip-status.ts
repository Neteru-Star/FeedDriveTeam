/**
 * Máquina de estados del viaje: `requested → assigned → driver_arrived → in_progress → completed | cancelled`.
 * La UI lee labels, tonos, acciones y transiciones solo desde aquí; nunca compara estados sueltos en templates.
 */
export type TripStatus = 'requested' | 'assigned' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled';

export type TripRole = 'client' | 'driver';

export type StatusTone = 'warning' | 'info' | 'violet' | 'primary' | 'neutral' | 'danger';

/** Acción del conductor que lleva al siguiente estado (endpoint `POST /driver/trips/{id}/<acción>`). */
export type DriverAction = 'arrive' | 'start' | 'complete';

export interface TripStatusMeta {
  label: string;
  tone: StatusTone;
  next: TripStatus | null;
  /** El viaje sigue en curso y se consulta su estado. */
  live: boolean;
  /** Paso de la línea de tiempo del pasajero. */
  clientStep: string;
  /** Lo que se anuncia al pasajero (y a los lectores de pantalla) al llegar a este estado. */
  clientMessage: string;
  /** Roles que pueden cancelar en este estado. El backend solo permite cancelar al pasajero, antes de iniciar el recorrido. */
  cancellableBy: readonly TripRole[];
  driverAction: { action: DriverAction; label: string } | null;
}

export const TRIP_STATUS: Record<TripStatus, TripStatusMeta> = {
  requested: {
    label: 'Buscando conductor',
    tone: 'warning',
    next: 'assigned',
    live: true,
    clientStep: 'Buscando conductor',
    clientMessage: 'Estamos buscando un conductor cercano.',
    cancellableBy: ['client'],
    driverAction: null,
  },
  assigned: {
    label: 'Conductor asignado',
    tone: 'info',
    next: 'driver_arrived',
    live: true,
    clientStep: 'Conductor asignado',
    clientMessage: 'Tu conductor va en camino al punto de partida.',
    cancellableBy: ['client'],
    driverAction: { action: 'arrive', label: 'Llegué al punto' },
  },
  driver_arrived: {
    label: 'Conductor en el punto',
    tone: 'violet',
    next: 'in_progress',
    live: true,
    clientStep: 'Tu conductor llegó',
    clientMessage: 'Tu conductor llegó. Te está esperando en el punto de partida.',
    cancellableBy: ['client'],
    driverAction: { action: 'start', label: 'Iniciar viaje' },
  },
  in_progress: {
    label: 'En curso',
    tone: 'primary',
    next: 'completed',
    live: true,
    clientStep: 'En camino',
    clientMessage: 'Vas en camino a tu destino.',
    cancellableBy: [],
    driverAction: { action: 'complete', label: 'Finalizar viaje' },
  },
  completed: {
    label: 'Completado',
    tone: 'neutral',
    next: null,
    live: false,
    clientStep: 'Finalizado',
    clientMessage: 'Llegaste a tu destino.',
    cancellableBy: [],
    driverAction: null,
  },
  cancelled: {
    label: 'Cancelado',
    tone: 'danger',
    next: null,
    live: false,
    clientStep: 'Cancelado',
    clientMessage: 'El viaje fue cancelado.',
    cancellableBy: [],
    driverAction: null,
  },
};

export const TRIP_STATUSES = Object.keys(TRIP_STATUS) as TripStatus[];

/** Pasos que ve el pasajero, en orden. `cancelled` no es un paso: corta la línea de tiempo. */
export const CLIENT_TIMELINE: readonly TripStatus[] = [
  'requested',
  'assigned',
  'driver_arrived',
  'in_progress',
  'completed',
];

export function canCancel(status: TripStatus, role: TripRole): boolean {
  return TRIP_STATUS[status].cancellableBy.includes(role);
}

/** Posición del estado en la línea de tiempo del pasajero; -1 si no está en ella (cancelado). */
export function timelineIndex(status: TripStatus): number {
  return CLIENT_TIMELINE.indexOf(status);
}

/** El estado `to` es un avance válido desde `from` (o el mismo estado). */
export function isForward(from: TripStatus, to: TripStatus): boolean {
  if (from === to) return true;
  let next = TRIP_STATUS[from].next;
  while (next) {
    if (next === to) return true;
    next = TRIP_STATUS[next].next;
  }
  return to === 'cancelled' && TRIP_STATUS[from].live;
}
