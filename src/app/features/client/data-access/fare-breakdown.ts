import type { FareBreakdownItem } from '@shared/ui/fare-display/fare-display.component';
import { formatDistance } from '@shared/utils/geo';

import type { FareEstimate } from './client.models';

/**
 * El backend devuelve las tarifas por unidad, no cuánto aporta cada concepto.
 * Se reconstruye el desglose con la misma fórmula y se ajusta a la tarifa mínima, de modo
 * que la suma de las barras coincide siempre con `estimated_fare`, que es el valor oficial.
 */
export function fareBreakdown(estimate: FareEstimate): FareBreakdownItem[] {
  const rates = estimate.fare_breakdown;
  const base = rates.base_fare;
  const distance = estimate.distance_km * rates.price_per_km;
  const time = estimate.duration_min * rates.price_per_minute;
  const subtotal = base + distance + time;
  const surge = subtotal * (rates.surge_multiplier - 1);

  const items: FareBreakdownItem[] = [
    { label: 'Base', amount: Math.round(base) },
    { label: `Distancia · ${formatDistance(estimate.distance_km)}`, amount: Math.round(distance) },
    { label: `Tiempo · ${estimate.duration_min} min`, amount: Math.round(time) },
  ];
  if (surge > 0) items.push({ label: `Alta demanda ×${rates.surge_multiplier}`, amount: Math.round(surge) });

  const sum = items.reduce((total, item) => total + item.amount, 0);
  const adjustment = estimate.estimated_fare - sum;
  if (adjustment > 0) items.push({ label: 'Ajuste a tarifa mínima', amount: adjustment });
  return items;
}
