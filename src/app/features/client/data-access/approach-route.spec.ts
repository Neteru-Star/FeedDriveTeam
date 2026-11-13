import { APPROACH_RECALC_METERS, nextApproachAnchor } from './approach-route';

const START = { lat: 4.665, lng: -74.0483 };
/** ~111 m al norte por cada milésima de grado de latitud. */
const north = (meters: number) => ({ lat: START.lat + meters / 111_195, lng: START.lng });

describe('nextApproachAnchor', () => {
  it('starts the approach route where the driver is', () => {
    expect(nextApproachAnchor(null, 3, START)).toEqual({ tripId: 3, from: START });
  });

  it('keeps the same start while the driver moves a little, so the route is not asked for again', () => {
    const anchor = nextApproachAnchor(null, 3, START);

    expect(nextApproachAnchor(anchor, 3, north(150))).toBe(anchor);
    expect(nextApproachAnchor(anchor, 3, north(APPROACH_RECALC_METERS - 20))).toBe(anchor);
  });

  it('starts again from the driver once it has advanced enough, leaving only what is left', () => {
    const anchor = nextApproachAnchor(null, 3, START);

    expect(nextApproachAnchor(anchor, 3, north(APPROACH_RECALC_METERS + 20))).toEqual({
      tripId: 3,
      from: north(APPROACH_RECALC_METERS + 20),
    });
  });

  it('does not reuse the start of another trip', () => {
    const anchor = nextApproachAnchor(null, 3, START);

    expect(nextApproachAnchor(anchor, 4, START)).toEqual({ tripId: 4, from: START });
  });
});
