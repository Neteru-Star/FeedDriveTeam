import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

import {
  API,
  PARQUE_93,
  createClient,
  createDriver,
  login,
  logout,
  mockMapServices,
  requestRideByApi,
  type TestDriver,
} from './support';

test.use({ geolocation: PARQUE_93, permissions: ['geolocation'] });
test.beforeEach(({ page }) => mockMapServices(page));

const uniqueOrigin = () => `Carrera ${Date.now() % 100_000}-${Math.floor(Math.random() * 1000)}`;
const heading = (page: Page, name: string | RegExp) => page.getByRole('heading', { name });
const card = (page: Page, origin: string) =>
  page.getByRole('article', { name: `Solicitud de ${origin} a Centro Comercial Andino` });
/** El pasajero consulta su viaje cada 5 s. */
const POLL = { timeout: 12_000 };

/** Segunda sesión del navegador para el conductor, con la misma configuración que la del pasajero. */
async function driverPage(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    geolocation: PARQUE_93,
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  await mockMapServices(page);
  return page;
}

/** El conductor se conecta y acepta la solicitud que tiene ese origen. */
async function acceptInApp(page: Page, driver: TestDriver, origin: string): Promise<void> {
  await login(page, driver.login, driver.password);
  await page.getByRole('button', { name: 'Conectarme' }).click();
  await expect(card(page, origin)).toBeVisible(POLL);
  await card(page, origin).getByRole('button', { name: 'Aceptar' }).click();
  await expect(heading(page, 'Recoge a Laura Gómez')).toBeVisible();
}

test('completes a trip end to end with the passenger and the driver in two sessions (HU-05)', async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(90_000);
  const client = await createClient(request);
  const driver = await createDriver(request, { available: false });
  const origin = uniqueOrigin();
  await requestRideByApi(request, client.token, origin);
  await login(page, client.login, client.password);
  await expect(heading(page, 'Buscando conductor…')).toBeVisible();
  const driverApp = await driverPage(browser, testInfo);

  await acceptInApp(driverApp, driver, origin);
  await expect(page.locator('app-trip-timeline [aria-current="step"]')).toContainText('Conductor asignado', POLL);

  await driverApp.getByRole('button', { name: 'Llegué al punto' }).click();
  await expect(heading(driverApp, 'Esperando a Laura Gómez')).toBeVisible();
  await expect(heading(page, 'Tu conductor llegó')).toBeVisible(POLL);

  await driverApp.getByRole('button', { name: 'Iniciar viaje' }).click();
  await expect(heading(driverApp, 'En camino a Centro Comercial Andino')).toBeVisible();
  await expect(driverApp.getByText('Recorrido')).toBeVisible();
  await expect(heading(page, 'En camino a Centro Comercial Andino')).toBeVisible(POLL);

  await driverApp.getByRole('button', { name: 'Finalizar viaje' }).click();
  await driverApp.locator('ion-alert').getByRole('button', { name: 'Finalizar' }).click();
  await expect(heading(driverApp, 'Viaje finalizado')).toBeVisible();
  // Sin movimiento del GPS en la prueba, se reporta la distancia estimada.
  await expect(driverApp.getByText('Distancia (estimada)')).toBeVisible();
  const finalFare = await driverApp.locator('app-driver-trip-summary .total strong').innerText();

  // El pasajero ve terminar el viaje con la misma tarifa y se le pide calificar.
  await expect(page.locator('app-rate-trip')).toBeVisible(POLL);
  await page.locator('app-rate-trip').getByRole('button', { name: 'Ahora no' }).click();
  await expect(page.locator('app-ride-status .total strong')).toHaveText(finalFare);

  await driverApp.getByRole('button', { name: 'Listo, seguir en línea' }).click();
  await expect(heading(driverApp, 'Estás en línea')).toBeVisible();
  await driverApp.context().close();
});

test('tells the driver when the passenger cancelled the trip', async ({ page, request }) => {
  const client = await createClient(request);
  const driver = await createDriver(request, { available: false });
  const origin = uniqueOrigin();
  await requestRideByApi(request, client.token, origin);
  await acceptInApp(page, driver, origin);

  const active = await (
    await request.get(`${API}/client/active`, { headers: { Authorization: `Bearer ${client.token}` } })
  ).json();
  await request.post(`${API}/client/cancel/${active.data.id}`, {
    headers: { Authorization: `Bearer ${client.token}` },
    data: { reason: 'Cambié de planes' },
  });
  await page.getByRole('button', { name: 'Llegué al punto' }).click();

  await expect(page.getByText('El pasajero canceló el viaje.')).toBeVisible();
  await expect(heading(page, 'Estás en línea')).toBeVisible();
});

test('resumes the trip in progress after restarting the app', async ({ page, request }) => {
  const client = await createClient(request);
  const driver = await createDriver(request, { available: false });
  const origin = uniqueOrigin();
  await requestRideByApi(request, client.token, origin);
  await acceptInApp(page, driver, origin);
  await page.getByRole('button', { name: 'Llegué al punto' }).click();
  await page.getByRole('button', { name: 'Iniciar viaje' }).click();
  await expect(heading(page, 'En camino a Centro Comercial Andino')).toBeVisible();

  await page.reload();

  await expect(heading(page, 'En camino a Centro Comercial Andino')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finalizar viaje' })).toBeVisible();
});

test('goes offline before logging out', async ({ page, request }) => {
  const driver = await createDriver(request, { available: false });
  await login(page, driver.login, driver.password);
  await page.getByRole('button', { name: 'Conectarme' }).click();
  await expect(heading(page, 'Estás en línea')).toBeVisible();

  const offline = page.waitForRequest((r) => r.url().endsWith('/driver/availability'));
  await logout(page, '/conductor');

  expect((await offline).postDataJSON()).toEqual({ status: 'unavailable' });
  await expect(page).toHaveURL(/\/login$/);
  // Al volver a entrar no se conecta solo.
  await login(page, driver.login, driver.password);
  await expect(heading(page, 'Estás fuera de línea')).toBeVisible();
});
