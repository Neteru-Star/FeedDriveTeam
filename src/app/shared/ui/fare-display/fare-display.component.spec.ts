import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { render, screen } from '@testing-library/angular';

import { FareDisplayComponent } from './fare-display.component';

registerLocaleData(localeEsCo);

describe('FareDisplayComponent', () => {
  const providers = [{ provide: LOCALE_ID, useValue: 'es-CO' }];

  it('shows the fare in Colombian pesos', async () => {
    await render(FareDisplayComponent, { inputs: { total: 22750 }, providers });

    expect(screen.getByText(/22\.750/)).toBeTruthy();
  });

  it('shows the surge chip only when the multiplier is above 1', async () => {
    const { rerender } = await render(FareDisplayComponent, { inputs: { total: 6500, surge: 1 }, providers });
    expect(screen.queryByText(/Alta demanda/)).toBeNull();

    await rerender({ inputs: { total: 6500, surge: 1.3 } });
    expect(screen.getByText('Alta demanda ×1.3')).toBeTruthy();
  });
});
