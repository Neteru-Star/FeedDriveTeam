export interface LatLng {
  lat: number;
  lng: number;
}

/** Centro por defecto cuando no hay permiso de ubicación (Plaza de Bolívar, Bogotá). */
export const BOGOTA: LatLng = { lat: 4.5981, lng: -74.0761 };

const EARTH_RADIUS_KM = 6371;
/** Por debajo de esta distancia, origen y destino se consideran el mismo lugar. */
export const SAME_PLACE_METERS = 50;

const rad = (deg: number): number => (deg * Math.PI) / 180;
const deg = (radians: number): number => (radians * 180) / Math.PI;

/** Distancia en línea recta (fórmula de Haversine), la misma que usa el backend para estimar. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function isSamePlace(a: LatLng, b: LatLng, thresholdMeters = SAME_PLACE_METERS): boolean {
  return haversineKm(a, b) * 1000 < thresholdMeters;
}

/** Rumbo inicial de `a` hacia `b`, en grados desde el norte (0–360). */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Línea curva entre dos puntos (Bézier cuadrática) para dibujar la ruta sin un servicio de enrutamiento.
 * `bend` es la separación del punto de control respecto a la recta, como fracción de la distancia.
 */
export function curvedRoute(from: LatLng, to: LatLng, segments = 32, bend = 0.18): LatLng[] {
  const mid = { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };
  const control = { lat: mid.lat - (to.lng - from.lng) * bend, lng: mid.lng + (to.lat - from.lat) * bend };
  const points: LatLng[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    points.push({
      lat: u * u * from.lat + 2 * u * t * control.lat + t * t * to.lat,
      lng: u * u * from.lng + 2 * u * t * control.lng + t * t * to.lng,
    });
  }
  return points;
}

/** Distancia legible en español: "850 m" o "12,4 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toLocaleString('es-CO', { maximumFractionDigits: 1 })} km`;
}

/** Velocidad media urbana usada para estimar tiempos sin un servicio de rutas (Bogotá, hora normal). */
export const CITY_SPEED_KMH = 22;
/** Las calles no van en línea recta: factor de rodeo sobre la distancia de Haversine. */
export const DETOUR_FACTOR = 1.3;

/** Minutos aproximados para recorrer de `a` a `b` en la ciudad (mínimo 1). */
export function etaMinutes(a: LatLng, b: LatLng): number {
  const km = haversineKm(a, b) * DETOUR_FACTOR;
  return Math.max(1, Math.round((km / CITY_SPEED_KMH) * 60));
}
