export const CURRENT_LOCATION = 'Mi ubicación actual';
/** Separa "Mi ubicación actual" de la dirección encontrada para ese punto. */
export const LOCATION_SEPARATOR = ' · ';

/**
 * Nombre del punto de recogida que se envía al backend y verá el conductor: la dirección, no
 * "Mi ubicación actual", que solo tiene sentido para el pasajero.
 */
export function pickupName(origin: { label: string; detail: string; source: string }): string {
  if (origin.source !== 'gps') return origin.label;
  const prefix = CURRENT_LOCATION + LOCATION_SEPARATOR;
  const address = origin.label.startsWith(prefix) ? origin.label.slice(prefix.length) : '';
  return address || origin.detail || 'Ubicación del pasajero';
}
