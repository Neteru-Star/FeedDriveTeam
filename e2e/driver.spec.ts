import { expect, test, type Page } from '@playwright/test';

import {
  API,
  PARQUE_93,
  acceptRequest,
  approveDriver,
  createClient,
  createDriver,
  login,
  mockMapServices,
  requestRideByApi,
} from './support';

test.use({ geolocation: PARQUE_93, permissions: ['geolocation'] });
test.beforeEach(({ page }) => mockMapServices(page));

/** Las solicitudes son globales y otras pruebas corren en paralelo: cada una usa un origen propio. */
const uniqueOrigin = () => `Calle ${Date.now() % 100_000}-${Math.floor(Math.random() * 1000)}`;
const card = (page: Page, origin: string) =>
  page.getByRole('article', { name: `Solicitud de ${origin} a Centro Comercial Andino` });

async function loginOnline(page: Page, driver: { login: string; password: string }): Promise<void> {
  await login(page, driver.login, driver.password);
  await expect(page.getByRole('heading', { name: 'Estás fuera de línea' })).toBeVisible();
  const location = page.waitForRequest((r) => r.url().endsWith('/driver/location') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Conectarme' }).click();
  await expect(page.getByRole('heading', { name: 'Estás en línea' })).toBeVisible();
  // Al conectarse empieza a enviar su GPS.
  expect((await location).postDataJSON()).toEqual(expect.objectContaining({ latitude: 4.6766, longitude: -74.0483 }));
}

test('shows the account review until an admin approves the driver', async ({ page, request }) => {
  const driver = await createDriver(request, { approved: false });
  await login(page, driver.login, driver.password);

  await expect(page.getByRole('heading', { name: 'Tu cuenta está en revisión' })).toBeVisible();
  await expect(page.getByText('En revisión', { exact: true })).toBeVisible();

  await approveDriver(request, driver.driverId);
  await page.getByRole('button', { name: 'Volver a consultar' }).click();

  await expect(page.getByRole('heading', { name: 'Estás fuera de línea' })).toBeVisible();
});

test('goes online, lists a nearby request and accepts it (HU-04)', async ({ page, request }) => {
  const driver = await createDriver(request, { available: false });
  const client = await createClient(request);
  const origin = uniqueOrigin();
  await loginOnline(page, driver);

  await requestRideByApi(request, client.token, origin);

  await expect(card(page, origin)).toBeVisible({ timeout: 10_000 });
  await expect(card(page, origin)).toContainText('Laura Gómez');
  await expect(card(page, origin)).toContainText('Ganancia estimada');
  await card(page, origin).getByRole('button', { name: 'Aceptar' }).click();

  await expect(page.getByRole('heading', { name: 'Viaje aceptado' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Llamar a Laura Gómez' })).toHaveAttribute('href', /^tel:3\d{9}$/);
  const active = await (
    await request.get(`${API}/client/active`, { headers: { Authorization: `Bearer ${client.token}` } })
  ).json();
  expect(active.type).toBe('trip');

  // El viaje aceptado se retoma al recargar.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Viaje aceptado' })).toBeVisible();
});

test('explains when another driver took the request first (409)', async ({ page, request }) => {
  const driver = await createDriver(request, { available: false });
  const rival = await createDriver(request);
  const client = await createClient(request);
  const origin = uniqueOrigin();
  await loginOnline(page, driver);
  await requestRideByApi(request, client.token, origin);
  await expect(card(page, origin)).toBeVisible({ timeout: 10_000 });

  await acceptRequest(request, rival.token, client.token);
  await card(page, origin).getByRole('button', { name: 'Aceptar' }).click();

  await expect(card(page, origin).getByRole('alert')).toHaveText('Otro conductor tomó este viaje');
  await expect(page.getByText('Otro conductor tomó este viaje primero.')).toBeVisible();
  await expect(card(page, origin)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'Estás en línea' })).toBeVisible();
});

test('hides a rejected request, stays online after reloading and goes offline', async ({ page, request }) => {
  const driver = await createDriver(request, { available: false });
  const client = await createClient(request);
  const origin = uniqueOrigin();
  await loginOnline(page, driver);
  await requestRideByApi(request, client.token, origin);
  await expect(card(page, origin)).toBeVisible({ timeout: 10_000 });

  await card(page, origin).getByRole('button', { name: 'Rechazar' }).click();
  await expect(card(page, origin)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Estás en línea' })).toBeVisible();
  // El rechazo se recuerda en el teléfono.
  await expect(page.getByRole('heading', { name: /^Solicitudes cercanas/ })).toBeVisible({ timeout: 10_000 });
  await expect(card(page, origin)).toHaveCount(0);

  const offline = page.waitForRequest((r) => r.url().endsWith('/driver/availability'));
  await page.getByRole('switch', { name: 'En línea' }).click();
  expect((await offline).postDataJSON()).toEqual({ status: 'unavailable' });
  await expect(page.getByRole('heading', { name: 'Estás fuera de línea' })).toBeVisible();
});
