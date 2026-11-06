import { TripDraftStore, type DraftPoint } from './trip-draft.store';

const point = (label: string, lat: number, lng: number): DraftPoint => ({
  label,
  detail: '',
  position: { lat, lng },
  source: 'search',
});

const PARQUE_93 = point('Parque de la 93', 4.6766, -74.0483);
const ANDINO = point('Andino', 4.6664, -74.0536);

describe('TripDraftStore', () => {
  it('builds the route once origin and destination are set', () => {
    const store = new TripDraftStore();
    expect(store.route()).toBeNull();

    store.set('origin', PARQUE_93);
    store.set('destination', ANDINO);

    expect(store.route()).toEqual({ from: PARQUE_93.position, to: ANDINO.position });
    expect(store.distanceKm()).toBeCloseTo(1.28, 2);
  });

  it('rejects a destination at the same place as the origin', () => {
    const store = new TripDraftStore();
    store.set('origin', PARQUE_93);

    const accepted = store.set('destination', point('Casi igual', 4.67662, -74.04831));

    expect(accepted).toBe(false);
    expect(store.destination()).toBeNull();
  });

  it('rejects an origin at the same place as the destination', () => {
    const store = new TripDraftStore();
    store.set('destination', ANDINO);

    expect(store.set('origin', ANDINO)).toBe(false);
    expect(store.origin()).toBeNull();
  });

  it('updates the label of a GPS point without moving it', () => {
    const store = new TripDraftStore();
    store.set('origin', { ...PARQUE_93, label: 'Mi ubicación actual', source: 'gps' });

    store.relabel('origin', 'Mi ubicación actual · Calle 93A #12-50', 'Chicó, Bogotá');

    expect(store.origin()?.label).toBe('Mi ubicación actual · Calle 93A #12-50');
    expect(store.origin()?.position).toEqual(PARQUE_93.position);
  });
});
