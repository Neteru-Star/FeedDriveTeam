import { fireEvent, render, screen } from '@testing-library/angular';

import type { RatingPayload } from '../data-access/client.models';
import { TripHistoryStore } from '../data-access/trip-history.store';

import { RateTripComponent } from './rate-trip.component';

describe('RateTripComponent', () => {
  async function setup() {
    const sent: { id: number; payload: RatingPayload }[] = [];
    const done: string[] = [];
    const view = await render(RateTripComponent, {
      inputs: { target: { id: 7, driverName: 'Carlos Rodríguez', plate: 'UBR-123', date: null } },
      on: { done: (result: string) => done.push(result) },
      providers: [
        {
          provide: TripHistoryStore,
          useValue: {
            rate: async (id: number, payload: RatingPayload) => {
              sent.push({ id, payload });
              return 'ok';
            },
          },
        },
      ],
    });
    const form = view.container.querySelector('form')!;
    const submitButton = () => view.container.querySelector<HTMLElement>('ion-button[type="submit"]')!;
    return { view, form, submitButton, sent, done };
  }

  it('asks about the driver and needs at least one star to send', async () => {
    const { form, submitButton, sent } = await setup();

    expect(screen.getByRole('heading', { name: '¿Cómo te fue con Carlos Rodríguez?' })).toBeTruthy();
    expect(submitButton().getAttribute('disabled')).not.toBeNull();
    fireEvent.submit(form);
    await Promise.resolve();

    expect(sent).toEqual([]);
  });

  it('sends the stars and the comment', async () => {
    const { view, form, sent, done } = await setup();

    fireEvent.click(screen.getByRole('radio', { name: '4 estrellas' }));
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'Muy amable' } });
    view.fixture.detectChanges();
    expect(screen.getByText('Bueno')).toBeTruthy();
    fireEvent.submit(form);
    await view.fixture.whenStable();

    expect(sent).toEqual([{ id: 7, payload: { score: 4, comment: 'Muy amable', has_incident: false } }]);
    expect(done).toEqual(['ok']);
  });

  it('requires a description when the passenger reports a problem', async () => {
    const { view, form, submitButton, sent } = await setup();
    fireEvent.click(screen.getByRole('radio', { name: '2 estrellas' }));

    view.container
      .querySelector('ion-toggle')!
      .dispatchEvent(new CustomEvent('ionChange', { detail: { checked: true } }));
    view.fixture.detectChanges();

    expect(screen.getByRole('alert').textContent).toContain('Describe el problema');
    expect(submitButton().getAttribute('disabled')).not.toBeNull();

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'Frenó muy fuerte' } });
    view.fixture.detectChanges();
    fireEvent.submit(form);
    await view.fixture.whenStable();

    expect(sent[0].payload).toEqual({ score: 2, comment: 'Frenó muy fuerte', has_incident: true });
  });
});
