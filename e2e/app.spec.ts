import { expect, test } from '@playwright/test';

test('loads the app on the login screen', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('FeedDrive');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();
});

test('shows the 404 page for unknown routes', async ({ page }) => {
  await page.goto('/no-existe');

  await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
});
