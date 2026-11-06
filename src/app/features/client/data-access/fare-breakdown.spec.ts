import type { FareEstimate } from './client.models';
import { fareBreakdown } from './fare-breakdown';

const rates = { base_fare: 3800, price_per_km: 1250, price_per_minute: 250, minimum_fare: 6500, surge_multiplier: 1 };

describe('fareBreakdown', () => {
  it('explains the minimum fare of the documented example (1,28 km, 4 min → $ 6.500)', () => {
    const estimate: FareEstimate = {
      distance_km: 1.28,
      duration_min: 4,
      estimated_fare: 6500,
      currency: 'COP',
      fare_breakdown: rates,
    };

    expect(fareBreakdown(estimate)).toEqual([
      { label: 'Base', amount: 3800 },
      { label: 'Distancia · 1,3 km', amount: 1600 },
      { label: 'Tiempo · 4 min', amount: 1000 },
      { label: 'Ajuste a tarifa mínima', amount: 100 },
    ]);
  });

  it('adds the surge as its own line and always sums to the official total', () => {
    const estimate: FareEstimate = {
      distance_km: 12.4,
      duration_min: 30,
      estimated_fare: Math.round((3800 + 12.4 * 1250 + 30 * 250) * 1.3),
      currency: 'COP',
      fare_breakdown: { ...rates, surge_multiplier: 1.3 },
    };

    const items = fareBreakdown(estimate);

    expect(items.map((i) => i.label)).toContain('Alta demanda ×1.3');
    expect(items.reduce((sum, i) => sum + i.amount, 0)).toBe(estimate.estimated_fare);
  });
});
