import { render, screen } from '@testing-library/angular';

import { TripTimelineComponent } from './trip-timeline.component';

describe('TripTimelineComponent', () => {
  it('marks previous steps as done and the current one for assistive technology', async () => {
    await render(TripTimelineComponent, { inputs: { status: 'driver_arrived' } });

    const steps = screen.getAllByRole('listitem');
    expect(steps.map((s) => s.getAttribute('data-state'))).toEqual(['done', 'done', 'current', 'pending', 'pending']);
    expect(steps[2].getAttribute('aria-current')).toBe('step');
    expect(steps[2].textContent).toContain('Tu conductor llegó');
    expect(steps[0].textContent).toContain('(completado)');
  });

  it('shows every step done when the trip is completed', async () => {
    await render(TripTimelineComponent, { inputs: { status: 'completed' } });

    const states = screen.getAllByRole('listitem').map((s) => s.getAttribute('data-state'));
    expect(states).toEqual(['done', 'done', 'done', 'done', 'done']);
  });
});
