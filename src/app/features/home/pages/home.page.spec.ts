import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';

import { HomePage } from './home.page';

describe('HomePage', () => {
  it('shows the app name', async () => {
    await render(HomePage, { providers: [provideRouter([])] });

    expect(screen.getByRole('heading', { name: 'FeedDrive' })).toBeTruthy();
  });
});
