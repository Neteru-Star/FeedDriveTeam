import type { TripRecord } from './client.models';
import { rateTargetOf, tripDate, tripTitle } from './trip-record';

const base: TripRecord = { id: 12, status: 'completed', final_fare: 9300, completed_at: '2026-10-20T19:00:00Z' };

describe('trip-record', () => {
  it('names the trip by its route, or by its number when the backend does not send it', () => {
    expect(tripTitle({ ...base, origin_name: 'Parque 93', destination_name: 'Andino' })).toBe('Parque 93 → Andino');
    expect(tripTitle(base)).toBe('Viaje #12');
  });

  it('dates the trip when it ended, or when it was created if it did not end', () => {
    expect(tripDate(base)).toBe('2026-10-20T19:00:00Z');
    expect(tripDate({ ...base, completed_at: null, created_at: '2026-10-19T08:00:00Z' })).toBe('2026-10-19T08:00:00Z');
  });

  it('builds what the rating needs from the documented fields', () => {
    expect(rateTargetOf({ ...base, driver: { user: { name: 'Carlos' } }, vehicle: { plate: 'UBR-123' } })).toEqual({
      id: 12,
      driverName: 'Carlos',
      plate: 'UBR-123',
      date: '2026-10-20T19:00:00Z',
    });
    expect(rateTargetOf(base).driverName).toBe('tu conductor');
  });
});
