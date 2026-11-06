import { expect, test, type Page } from '@playwright/test';

import {
  PARQUE_93,
  acceptRequest,
  createAvailableDriver,
  createClient,
  login,
  mockMapServices,
  requestRideByApi,
} from './support';

test.use({ geolocation: PARQUE_93, permissions: ['geolocation'] });
test.beforeEach(({ page }) => mockMapServices(page));

/** Tarifa que muestra "Confirma tu viaje" (la cifra principal, no el desglose). */
const fareTotal = (page: Page) => page.locator('app-fare-confirm .stats dd').last();

/** Elige el Parque El Virrey como destino y abre la tarifa. */
async function planToVirrey(page: Page): Promise<void> {
  await page.getByLabel('Destino').fill('Parque El Virrey');
  await page.getByRole('button', { name: /Parque El Virrey/ }).click();
  await page.getByRole('button', { name: 'Ver tarifa' }).click();
}

test('estimates the fare and requests the ride (HU-03)', async ({ page, request }) => {
  const client = await createClient(request);
  await login(page, client.login, client.password);
  await planToVirrey(page);

  await expect(page.getByRole('heading', { name: 'Confirma tu viaje' })).toBeVisible();
  // 0,7 km y 2 min: por debajo de la tarifa mínima de $ 6.500.
  await expect(fareTotal(page)).toHaveText('$ 6.500');
  await page.getByText('Ver desglose').click();
  await expect(page.getByText('Ajuste a tarifa mínima')).toBeVisible();

  await page.getByRole('button', { name: 'Solicitar viaje' }).click();
  await expect(page.getByRole('heading', { name: 'Buscando conductor…' })).toBeVisible();

  // La solicitud queda en estado "requested" en el backend y se retoma al recargar.
  const active = await (
    await request.get('http://localhost:8000/api/client/active', {
      headers: { Authorization: `Bearer ${client.token}` },
    })
  ).json();
  expect(active.type).toBe('request');
  expect(active.data.status).toBe('requested');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Buscando conductor…' })).toBeVisible();
});

test('shows the driver, plate and rating when a driver accepts', async ({ page, request }) => {
  const client = await createClient(request);
  const driver = await createAvailableDriver(request);
  await login(page, client.login, client.password);
  await planToVirrey(page);
  await page.getByRole('button', { name: 'Solicitar viaje' }).click();
  await expect(page.getByRole('heading', { name: 'Buscando conductor…' })).toBeVisible();

  await acceptRequest(request, driver.token, client.token);

  await expect(page.locator('app-trip-timeline [aria-current="step"]')).toContainText('Conductor asignado', {
    timeout: 10_000,
  });
  await expect(page.getByText(driver.name)).toBeVisible();
  await expect(page.getByLabel(/^Placa /)).toBeVisible();
});

test('offers to open the active trip instead of creating a second one', async ({ page, request }) => {
  const client = await createClient(request);
  await requestRideByApi(request, client.token);
  await login(page, client.login, client.password);
  // La app retoma la solicitud hecha desde otro dispositivo.
  await expect(page.getByRole('heading', { name: 'Buscando conductor…' })).toBeVisible();

  await page.getByRole('button', { name: 'Cancelar solicitud' }).click();
  await page.getByRole('button', { name: 'Cambié de planes' }).click();
  await expect(page.getByRole('heading', { name: '¿A dónde vas?' })).toBeVisible();

  // Mientras el pasajero confirma, otra solicitud aparece en el backend.
  await planToVirrey(page);
  await expect(fareTotal(page)).toHaveText('$ 6.500');
  await requestRideByApi(request, client.token);
  await page.getByRole('button', { name: 'Solicitar viaje' }).click();

  await expect(page.getByText('Ya tienes un viaje activo')).toBeVisible();
  await page.getByRole('button', { name: 'Ver mi viaje' }).click();
  await expect(page.getByRole('heading', { name: 'Buscando conductor…' })).toBeVisible();
});

test('lets the passenger retry when the fare cannot be calculated', async ({ page, request }) => {
  const client = await createClient(request);
  await login(page, client.login, client.password);
  await page.route('**/client/estimate-fare', (route) =>
    route.fulfill({ status: 500, json: { message: 'Server Error' } }),
  );

  await planToVirrey(page);
  await expect(page.getByRole('heading', { name: 'No pudimos calcular la tarifa' })).toBeVisible();

  await page.unroute('**/client/estimate-fare');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { name: 'Confirma tu viaje' })).toBeVisible();
  await expect(fareTotal(page)).toHaveText('$ 6.500');
});

test('cancels the request when nobody accepts in 2 minutes', async ({ page, request }) => {
  const client = await createClient(request);
  await page.clock.install();
  await login(page, client.login, client.password);
  await planToVirrey(page);
  await page.getByRole('button', { name: 'Solicitar viaje' }).click();
  await expect(page.getByRole('heading', { name: 'Buscando conductor…' })).toBeVisible();

  await page.clock.fastForward('02:10');

  await expect(page.getByRole('heading', { name: 'No hay conductores disponibles' })).toBeVisible();
  await page.getByRole('button', { name: 'Volver al inicio' }).click();
  await expect(page.getByRole('heading', { name: '¿A dónde vas?' })).toBeVisible();
});
