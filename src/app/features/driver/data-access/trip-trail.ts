import { haversineKm, type LatLng } from '@shared/utils/geo';

/** Por debajo de este movimiento se considera ruido del GPS con el carro quieto. */
export const MIN_STEP_METERS = 8;
/** Un salto que implique más de esta velocidad es un error de lectura, no un movimiento real. */
export const MAX_SPEED_KMH = 150;

/** Rastro del viaje en curso, serializable para retomarlo si la app se cierra. */
export interface TrailState {
  /** Inicio del recorrido (epoch ms). */
  startedAt: number;
  distanceKm: number;
  last: { lat: number; lng: number; at: number } | null;
  /** Puntos aceptados: con menos de 2 no hay rastro útil. */
  points: number;
}

export function startTrail(at: number, from: LatLng | null): TrailState {
  return { startedAt: at, distanceKm: 0, last: from ? { ...from, at } : null, points: from ? 1 : 0 };
}

/**
 * Suma el tramo hasta la nueva posición. Ignora el ruido del GPS (pasos muy cortos) y los saltos imposibles,
 * para que la distancia final no crezca con el carro detenido ni con una lectura errónea.
 */
export function addPoint(trail: TrailState, point: LatLng, at: number): TrailState {
  if (!trail.last) return { ...trail, last: { ...point, at }, points: 1 };
  const km = haversineKm(trail.last, point);
  if (km * 1000 < MIN_STEP_METERS) return trail;
  const hours = Math.max(at - trail.last.at, 1) / 3_600_000;
  if (km / hours > MAX_SPEED_KMH) return trail;
  return { ...trail, distanceKm: trail.distanceKm + km, last: { ...point, at }, points: trail.points + 1 };
}

/** Minutos enteros del recorrido (el backend pide un entero), al menos 1. */
export function durationMin(trail: TrailState, now: number): number {
  return Math.max(1, Math.round((now - trail.startedAt) / 60_000));
}

/**
 * Distancia que se reporta al finalizar. Si el GPS no registró movimiento (sin señal o con la app cerrada durante el
 * recorrido), se usa la estimada de la solicitud para no cobrar solo la tarifa base. Devuelve también de dónde salió.
 */
export function reportedDistance(trail: TrailState, estimatedKm: number): { km: number; source: 'gps' | 'estimate' } {
  if (trail.points < 2 || trail.distanceKm === 0) return { km: round2(estimatedKm), source: 'estimate' };
  return { km: round2(trail.distanceKm), source: 'gps' };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
