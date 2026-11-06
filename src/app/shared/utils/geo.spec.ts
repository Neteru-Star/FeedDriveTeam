import { BOGOTA, bearing, curvedRoute, formatDistance, haversineKm, isSamePlace } from './geo';

const PARQUE_93 = { lat: 4.6766, lng: -74.0483 };
const ANDINO = { lat: 4.6664, lng: -74.0536 };

describe('geo utils', () => {
  it('matches the distance the backend estimates for the documented example (1,28 km)', () => {
    expect(haversineKm(PARQUE_93, ANDINO)).toBeCloseTo(1.28, 2);
  });

  it('is zero for the same point and symmetric', () => {
    expect(haversineKm(BOGOTA, BOGOTA)).toBe(0);
    expect(haversineKm(PARQUE_93, ANDINO)).toBeCloseTo(haversineKm(ANDINO, PARQUE_93), 10);
  });

  it('treats points closer than 50 m as the same place', () => {
    const nearby = { lat: PARQUE_93.lat + 0.0002, lng: PARQUE_93.lng };
    expect(isSamePlace(PARQUE_93, nearby)).toBe(true);
    expect(isSamePlace(PARQUE_93, ANDINO)).toBe(false);
  });

  it('computes the heading between two points', () => {
    expect(bearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 5);
    expect(bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 5);
    expect(bearing({ lat: 0, lng: 0 }, { lat: -1, lng: 0 })).toBeCloseTo(180, 5);
  });

  it('draws a curved route that starts and ends at the given points', () => {
    const route = curvedRoute(PARQUE_93, ANDINO, 10);
    expect(route).toHaveLength(11);
    expect(route[0]).toEqual(PARQUE_93);
    expect(route[10].lat).toBeCloseTo(ANDINO.lat, 10);
    expect(route[10].lng).toBeCloseTo(ANDINO.lng, 10);
    const middle = route[5];
    const straightMiddle = { lat: (PARQUE_93.lat + ANDINO.lat) / 2, lng: (PARQUE_93.lng + ANDINO.lng) / 2 };
    expect(haversineKm(middle, straightMiddle)).toBeGreaterThan(0.05);
  });

  it('formats distances in Spanish', () => {
    expect(formatDistance(0.85)).toBe('850 m');
    expect(formatDistance(12.43)).toBe('12,4 km');
  });
});
