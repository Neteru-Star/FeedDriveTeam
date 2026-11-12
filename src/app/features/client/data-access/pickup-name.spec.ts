import { pickupName } from './pickup-name';

describe('pickupName', () => {
  it('sends the address of the current location, not "Mi ubicación actual"', () => {
    const origin = { label: 'Mi ubicación actual · Calle 93A #12-50', detail: 'Chicó, Bogotá', source: 'gps' };
    expect(pickupName(origin)).toBe('Calle 93A #12-50');
  });

  it('falls back to the area or a generic name when the address is not known yet', () => {
    expect(pickupName({ label: 'Mi ubicación actual', detail: 'Chicó, Bogotá', source: 'gps' })).toBe('Chicó, Bogotá');
    expect(pickupName({ label: 'Mi ubicación actual', detail: '', source: 'gps' })).toBe('Ubicación del pasajero');
  });

  it('keeps the name of a place the passenger searched or picked on the map', () => {
    expect(pickupName({ label: 'FET', detail: 'Neiva', source: 'search' })).toBe('FET');
  });
});
