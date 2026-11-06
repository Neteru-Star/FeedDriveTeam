import { render, screen } from '@testing-library/angular';

import { RatingStarsComponent } from './rating-stars.component';

describe('RatingStarsComponent', () => {
  it('updates the value when a star is clicked', async () => {
    const { fixture } = await render(RatingStarsComponent, { inputs: { value: 2 } });

    screen.getByRole('radio', { name: '4 estrellas' }).click();

    expect(fixture.componentInstance.value()).toBe(4);
  });

  it('ignores clicks when readonly', async () => {
    const { fixture } = await render(RatingStarsComponent, { inputs: { value: 3, readonly: true } });

    screen.getByRole('radio', { name: '5 estrellas' }).click();

    expect(fixture.componentInstance.value()).toBe(3);
  });
});
