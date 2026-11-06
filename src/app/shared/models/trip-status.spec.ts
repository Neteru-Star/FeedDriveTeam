import {
  CLIENT_TIMELINE,
  TRIP_STATUS,
  TRIP_STATUSES,
  canCancel,
  isForward,
  timelineIndex,
  type TripStatus,
} from './trip-status';

describe('trip-status', () => {
  it('follows requested → assigned → driver_arrived → in_progress → completed', () => {
    const path: TripStatus[] = [];
    let status: TripStatus | null = 'requested';
    while (status) {
      path.push(status);
      status = TRIP_STATUS[status].next;
    }
    expect(path).toEqual(['requested', 'assigned', 'driver_arrived', 'in_progress', 'completed']);
    expect(path).toEqual([...CLIENT_TIMELINE]);
  });

  it('marks only completed and cancelled as final', () => {
    const final = TRIP_STATUSES.filter((s) => !TRIP_STATUS[s].live);
    expect(final).toEqual(['completed', 'cancelled']);
  });

  it('lets the passenger cancel only before the ride starts, and never the driver', () => {
    const passenger = TRIP_STATUSES.filter((s) => canCancel(s, 'client'));
    expect(passenger).toEqual(['requested', 'assigned', 'driver_arrived']);
    expect(TRIP_STATUSES.some((s) => canCancel(s, 'driver'))).toBe(false);
  });

  it('gives the driver one action per step that leads to the next status', () => {
    expect(TRIP_STATUS.assigned.driverAction?.action).toBe('arrive');
    expect(TRIP_STATUS.driver_arrived.driverAction?.action).toBe('start');
    expect(TRIP_STATUS.in_progress.driverAction?.action).toBe('complete');
    expect(TRIP_STATUS.requested.driverAction).toBeNull();
    expect(TRIP_STATUS.completed.driverAction).toBeNull();
  });

  it('places each status on the passenger timeline, except cancelled', () => {
    expect(timelineIndex('requested')).toBe(0);
    expect(timelineIndex('in_progress')).toBe(3);
    expect(timelineIndex('cancelled')).toBe(-1);
    expect(CLIENT_TIMELINE.map((s) => TRIP_STATUS[s].clientStep)).toEqual([
      'Buscando conductor',
      'Conductor asignado',
      'Tu conductor llegó',
      'En camino',
      'Finalizado',
    ]);
  });

  it('accepts forward moves and cancellation of a live trip, but not going back', () => {
    expect(isForward('assigned', 'in_progress')).toBe(true);
    expect(isForward('assigned', 'assigned')).toBe(true);
    expect(isForward('driver_arrived', 'cancelled')).toBe(true);
    expect(isForward('in_progress', 'assigned')).toBe(false);
    expect(isForward('completed', 'cancelled')).toBe(false);
  });

  it('has a passenger message for every status', () => {
    for (const status of TRIP_STATUSES) expect(TRIP_STATUS[status].clientMessage.length).toBeGreaterThan(5);
  });
});
