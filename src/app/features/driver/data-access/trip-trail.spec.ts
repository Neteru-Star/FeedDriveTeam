import { addPoint, durationMin, reportedDistance, startTrail } from './trip-trail';

const T0 = Date.UTC(2026, 10, 6, 15, 0);
const SEC = 1000;
const PARQUE_93 = { lat: 4.6766, lng: -74.0483 };
/** ~111 m al norte por cada milésima de grado de latitud. */
const north = (meters: number) => ({ lat: PARQUE_93.lat + meters / 111_195, lng: PARQUE_93.lng });

describe('trip trail', () => {
  it('adds up the distance of each stretch', () => {
    let trail = startTrail(T0, PARQUE_93);
    trail = addPoint(trail, north(200), T0 + 30 * SEC);
    trail = addPoint(trail, north(500), T0 + 60 * SEC);

    expect(trail.distanceKm).toBeCloseTo(0.5, 2);
    expect(trail.points).toBe(3);
  });

  it('ignores GPS noise while the car is stopped', () => {
    let trail = startTrail(T0, PARQUE_93);
    for (let i = 1; i <= 20; i++) trail = addPoint(trail, north(i % 2 ? 4 : 0), T0 + i * 5 * SEC);

    expect(trail.distanceKm).toBe(0);
  });

  it('ignores an impossible jump but keeps counting after it', () => {
    let trail = startTrail(T0, PARQUE_93);
    // 3 km en 5 s serían 2.160 km/h.
    trail = addPoint(trail, north(3000), T0 + 5 * SEC);
    trail = addPoint(trail, north(100), T0 + 10 * SEC);

    expect(trail.distanceKm).toBeCloseTo(0.1, 2);
  });

  it('starts from the first reading when the GPS had no position at the start', () => {
    let trail = startTrail(T0, null);
    trail = addPoint(trail, PARQUE_93, T0 + 5 * SEC);
    trail = addPoint(trail, north(300), T0 + 40 * SEC);

    expect(trail.distanceKm).toBeCloseTo(0.3, 2);
  });

  it('reports whole minutes, at least one', () => {
    const trail = startTrail(T0, PARQUE_93);

    expect(durationMin(trail, T0 + 20 * SEC)).toBe(1);
    expect(durationMin(trail, T0 + 6 * 60 * SEC + 20 * SEC)).toBe(6);
  });

  it('falls back to the estimated distance when the GPS recorded no movement', () => {
    const still = startTrail(T0, PARQUE_93);
    const moved = addPoint(still, north(1450), T0 + 6 * 60 * SEC);

    expect(reportedDistance(still, 1.28)).toEqual({ km: 1.28, source: 'estimate' });
    expect(reportedDistance(moved, 1.28)).toEqual({ km: 1.45, source: 'gps' });
  });
});
