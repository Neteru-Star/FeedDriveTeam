import { expect, test } from '@playwright/test';

import { PARQUE_93, USERS, login, mockMapServices } from './support';

test.beforeEach(({ page }) => mockMapServices(page));

test.describe('passenger with location access (HU-02)', () => {
  test.use({ geolocation: PARQUE_93, permissions: ['geolocation'] });

  test.beforeEach(async ({ page }) => {
    await login(page, USERS.client.login, USERS.client.password);
    await expect(page.getByRole('heading', { name: '¿A dónde vas?' })).toBeVisible();
  });

  test('fills the origin with the current location', async ({ page }) => {
    await expect(page.getByLabel('Punto de partida')).toHaveValue('Mi ubicación actual · Calle 93A #12-50');
    await expect(page.locator('.fd-mk-user')).toBeVisible();
  });

  test('searches a destination and draws the route', async ({ page }) => {
    await page.getByLabel('Destino').fill('Parque El Virrey');
    await page.getByRole('button', { name: /Parque El Virrey/ }).click();

    await expect(page.getByLabel('Destino')).toHaveValue('Parque El Virrey');
    await expect(page.getByText('Distancia en línea recta')).toBeVisible();
    await expect(page.locator('path.fd-route')).toHaveCount(1);
    await expect(page.locator('.fd-mk-destination')).toBeVisible();
  });

  test('rejects a destination at the same place as the origin', async ({ page }) => {
    await page.getByLabel('Destino').fill('casa');
    await page.getByRole('button', { name: /Mi casa/ }).click();

    await expect(page.getByText('El origen y el destino no pueden ser el mismo lugar.')).toBeVisible();
    await expect(page.getByLabel('Destino')).not.toHaveValue('Mi casa');
  });

  test('picks the destination by tapping the map', async ({ page }) => {
    await page.getByLabel('Destino').click();
    await page.getByRole('button', { name: /Elegir en el mapa/ }).click();
    await expect(page.getByRole('heading', { name: 'Elige el destino' })).toBeVisible();

    // Sin mover el pin, el destino sería la misma ubicación del pasajero.
    await page.getByRole('button', { name: 'Confirmar destino' }).click();
    await expect(page.getByText('El origen y el destino no pueden ser el mismo lugar.')).toBeVisible();

    const map = page.locator('.fd-map');
    const box = (await map.boundingBox())!;
    await map.click({ position: { x: box.width * 0.75, y: box.height * 0.2 } });
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Confirmar destino' }).click();

    await expect(page.getByRole('heading', { name: '¿A dónde vas?' })).toBeVisible();
    await expect(page.getByText('Distancia en línea recta')).toBeVisible();
  });
});

test('shows Bogotá and asks for the location when the permission is denied', async ({ page }) => {
  await login(page, USERS.client.login, USERS.client.password);

  await expect(page.getByText('Activa tu ubicación')).toBeVisible();
  await expect(page.getByLabel('Punto de partida')).toHaveValue('');
});

test('opens the passenger menu and the trips section', async ({ page }) => {
  await login(page, USERS.client.login, USERS.client.password);
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('link', { name: 'Mis viajes' }).click();

  await expect(page.getByRole('heading', { name: 'Aún no tienes viajes' })).toBeVisible();
});

test('shows the driver shell with the offline panel', async ({ page }) => {
  await login(page, USERS.driver.login, USERS.driver.password);

  // El nombre también está en el menú lateral: se busca en la tarjeta de la pantalla.
  await expect(page.locator('app-driver-home').getByText('Carlos Rodríguez')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Estás fuera de línea' })).toBeVisible();
});

test('navigates the admin sections from the side menu', async ({ page }, testInfo) => {
  await login(page, USERS.admin.login, USERS.admin.password);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  // En escritorio el menú está fijo (ion-split-pane); en el celular se abre con el botón.
  if (testInfo.project.name === 'Mobile') await page.getByRole('button', { name: 'menu' }).click();
  await page.getByRole('link', { name: 'Conductores' }).click();

  await expect(page).toHaveURL(/\/admin\/conductores$/);
  await expect(page.getByRole('heading', { name: 'Conductores registrados' })).toBeVisible();
});
