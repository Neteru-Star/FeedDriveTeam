import { BOGOTA, bearing, etaMinutes, formatDistance, haversineKm, isSamePlace } from './geo';

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

  it('formats distances in Spanish', () => {
    expect(formatDistance(0.85)).toBe('850 m');
    expect(formatDistance(12.43)).toBe('12,4 km');
  });

  it('estimates city travel time with a detour factor, never below one minute', () => {
    const parque93 = { lat: 4.6766, lng: -74.0483 };
    const unicentro = { lat: 4.7024, lng: -74.0412 };
    // ~2,97 km en línea recta × 1,3 a 22 km/h ≈ 11 min
    expect(etaMinutes(parque93, unicentro)).toBe(11);
    expect(etaMinutes(parque93, parque93)).toBe(1);
  });
});
