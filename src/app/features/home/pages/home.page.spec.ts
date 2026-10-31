import { render, screen } from '@testing-library/angular';

import { HomePage } from './home.page';

describe('HomePage', () => {
  it('shows the app name', async () => {
    await render(HomePage);

    expect(screen.getByRole('heading', { name: 'FeedDrive' })).toBeTruthy();
  });
});
