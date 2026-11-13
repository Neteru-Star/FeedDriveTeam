import { haversineKm, type LatLng } from '@shared/utils/geo';

/** Cada cuánto avance del conductor se vuelve a pedir la ruta de acercamiento (y queda solo el tramo que falta). */
export const APPROACH_RECALC_METERS = 400;

/** Desde dónde se dibuja la ruta del conductor hasta el punto de recogida. */
export interface ApproachAnchor {
  tripId: number;
  from: LatLng;
}

/**
 * Inicio de la ruta de acercamiento. Se conserva mientras el conductor siga cerca de él, para no pedir una ruta
 * nueva en cada consulta del viaje (cada 5 s); cuando avanza más de 400 m, o es otro viaje, arranca desde su
 * posición actual.
 */
export function nextApproachAnchor(previous: ApproachAnchor | null, tripId: number, driver: LatLng): ApproachAnchor {
  if (previous && previous.tripId === tripId && haversineKm(previous.from, driver) * 1000 < APPROACH_RECALC_METERS) {
    return previous;
  }
  return { tripId, from: driver };
}
