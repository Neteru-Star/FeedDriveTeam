import { expect, test } from '@playwright/test';

test('loads the app', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('FeedDrive');
  await expect(page.getByRole('heading', { name: 'FeedDrive' })).toBeVisible();
});
