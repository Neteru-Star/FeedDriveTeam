import { render, screen } from '@testing-library/angular';

import { PlateComponent } from './plate.component';

describe('PlateComponent', () => {
  it('formats the plate as ABC·123', async () => {
    await render(PlateComponent, { inputs: { value: 'kxt-482' } });

    expect(screen.getByLabelText('Placa KXT·482')).toBeTruthy();
  });
});
