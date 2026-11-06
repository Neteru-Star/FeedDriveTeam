import type { TripRecord } from './client.models';

/** Lo necesario para calificar, venga del historial o del viaje que acaba de terminar. */
export interface RateTarget {
  id: number;
  driverName: string;
  plate?: string | null;
  date?: string | null;
}

/** Título del viaje: la ruta si el backend la envía, o su número. */
export function tripTitle(trip: TripRecord): string {
  return trip.origin_name && trip.destination_name
    ? `${trip.origin_name} → ${trip.destination_name}`
    : `Viaje #${trip.id}`;
}

/** Fecha que se muestra: la de finalización o, si no terminó, la de creación. */
export const tripDate = (trip: TripRecord): string | null => trip.completed_at ?? trip.created_at ?? null;

export function rateTargetOf(trip: TripRecord): RateTarget {
  return {
    id: trip.id,
    driverName: trip.driver?.user.name ?? 'tu conductor',
    plate: trip.vehicle?.plate ?? null,
    date: tripDate(trip),
  };
}
