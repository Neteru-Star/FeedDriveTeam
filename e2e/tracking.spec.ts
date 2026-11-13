import { expect, test, type Page } from '@playwright/test';

import {
  PARQUE_93,
  acceptRequest,
  advanceTrip,
  createAvailableDriver,
  createClient,
  login,
  mockMapServices,
  reportLocation,
  requestRideByApi,
} from './support';

test.use({ geolocation: PARQUE_93, permissions: ['geolocation'] });
test.beforeEach(({ page }) => mockMapServices(page));

/** Intervalo de consulta de `/client/active` (environment.mock.ts). */
const POLL_MS = 5_000;
/** ~1,3 km al sur del Parque de la 93, donde el conductor empieza. */
const SOUTH_OF_PARQUE_93 = { latitude: 4.665, longitude: -74.0483 };

const heading = (page: Page, name: string) => page.getByRole('heading', { name });
const currentStep = (page: Page) => page.locator('app-trip-timeline [aria-current="step"]');

/** Pasajero con una solicitud pedida desde otro dispositivo y un conductor disponible; la app la retoma al entrar. */
async function searchingClient(page: Page, request: Parameters<typeof createClient>[0]) {
  const client = await createClient(request);
  const driver = await createAvailableDriver(request);
  await requestRideByApi(request, client.token);
  // Reloj falso: cada consulta del estado se dispara al avanzar POLL_MS, sin esperas reales.
  await page.clock.install();
  await login(page, client.login, client.password);
  await expect(heading(page, 'Buscando conductor…')).toBeVisible();
  return { client, driver };
}

test('follows the trip from the driver on the way to the final fare (HU-06)', async ({ page, request }) => {
  const { client, driver } = await searchingClient(page, request);

  await reportLocation(request, driver.token, SOUTH_OF_PARQUE_93);
  const tripId = await acceptRequest(request, driver.token, client.token);
  // Ruta del conductor hasta la recogida: desde su posición (4.665) hasta el Parque de la 93 (4.6766).
  const approach = page.waitForRequest(
    (r) => r.url().includes('router.project-osrm.org') && r.url().includes('-74.0483,4.665;-74.0483,4.6766'),
  );
  await page.clock.runFor(POLL_MS);
  await approach;

  // 1,3 km en línea recta × 1,3 de rodeo a 22 km/h ≈ 5 min.
  await expect(heading(page, 'Llega en ~5 min')).toBeVisible();
  await expect(currentStep(page)).toContainText('Conductor asignado');
  await expect(page.getByRole('link', { name: `Llamar a ${driver.name}` })).toHaveAttribute('href', /^tel:3\d{9}$/);
  await expect(page.locator('.fd-mk-driver')).toBeVisible();
  await expect(page.locator('path.fd-route')).toHaveCount(1);

  const approachPath = await page.locator('path.fd-route').getAttribute('d');

  await advanceTrip(request, driver.token, tripId, 'arrive');
  await page.clock.runFor(POLL_MS);
  await expect(heading(page, 'Tu conductor llegó')).toBeVisible();
  // Al llegar el conductor, el mapa vuelve a la ruta del viaje (recogida → destino), ya calculada antes.
  await expect(page.locator('path.fd-route')).not.toHaveAttribute('d', approachPath!);
  await expect(currentStep(page)).toContainText('Tu conductor llegó');
  await expect(page.getByRole('button', { name: 'Cancelar viaje' })).toBeVisible();

  await advanceTrip(request, driver.token, tripId, 'start');
  await page.clock.runFor(POLL_MS);
  await expect(heading(page, 'En camino a Centro Comercial Andino')).toBeVisible();
  // Con el recorrido iniciado el backend ya no permite cancelar.
  await expect(page.getByRole('button', { name: 'Cancelar viaje' })).toHaveCount(0);

  await advanceTrip(request, driver.token, tripId, 'complete');
  await page.clock.runFor(POLL_MS);
  // Se abre la calificación (HU-08); el pasajero la deja para después.
  await page.locator('app-rate-trip').getByRole('button', { name: 'Ahora no' }).click();
  await page.clock.runFor(1_000);
  await expect(page.locator('app-rate-trip')).toHaveCount(0);
  await expect(heading(page, 'Llegaste a tu destino')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Calificar viaje' })).toBeVisible();
  await expect(page.locator('app-ride-status .total strong')).toHaveText(/^\$\s[\d.]+$/);
  await expect(page.locator('app-ride-status [aria-live]')).toHaveText('Llegaste a tu destino.');

  await page.getByRole('button', { name: 'Listo' }).click();
  await expect(heading(page, '¿A dónde vas?')).toBeVisible();
});

test('cancels an assigned trip with a reason before it starts', async ({ page, request }) => {
  const { client, driver } = await searchingClient(page, request);
  const tripId = await acceptRequest(request, driver.token, client.token);
  await page.clock.runFor(POLL_MS);
  await expect(currentStep(page)).toContainText('Conductor asignado');

  await page.getByRole('button', { name: 'Cancelar viaje' }).click();
  await expect(page.getByText('¿Por qué cancelas el viaje?')).toBeVisible();
  const cancel = page.waitForRequest((r) => r.url().includes('/client/cancel/'));
  await page.getByRole('button', { name: 'El conductor tarda demasiado' }).click();

  expect((await cancel).postDataJSON()).toEqual({ reason: 'El conductor tarda demasiado' });
  await expect(page.getByText('Cancelaste el viaje.')).toBeVisible();
  await expect(heading(page, '¿A dónde vas?')).toBeVisible();
  const history = await (
    await request.get('http://localhost:8000/api/client/trips', {
      headers: { Authorization: `Bearer ${client.token}` },
    })
  ).json();
  expect(history.trips.data.find((t: { id: number }) => t.id === tripId)).toEqual(
    expect.objectContaining({ status: 'cancelled', cancel_reason: 'El conductor tarda demasiado' }),
  );
});

test('keeps the search when the passenger backs out of cancelling, and accepts a written reason', async ({
  page,
  request,
}) => {
  await searchingClient(page, request);

  await page.getByRole('button', { name: 'Cancelar solicitud' }).click();
  await page.getByRole('button', { name: 'No cancelar' }).click();
  // Con el reloj falso, la animación de salida de Ionic solo termina al avanzarlo.
  await page.clock.runFor(1_000);
  await expect(page.locator('ion-action-sheet')).toHaveCount(0);
  await expect(heading(page, 'Buscando conductor…')).toBeVisible();

  await page.getByRole('button', { name: 'Cancelar solicitud' }).click();
  await page.getByRole('button', { name: 'Otro motivo' }).click();
  await page.getByLabel('Motivo de la cancelación').fill('Me voy caminando');
  const cancel = page.waitForRequest((r) => r.url().includes('/client/cancel/'));
  await page.locator('ion-alert').getByRole('button', { name: 'Cancelar solicitud' }).click();

  expect((await cancel).postDataJSON()).toEqual({ reason: 'Me voy caminando' });
  await expect(heading(page, '¿A dónde vas?')).toBeVisible();
});
