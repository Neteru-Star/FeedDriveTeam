import { expect, test, type Page } from '@playwright/test';

import {
  PARQUE_93,
  acceptRequest,
  advanceTrip,
  completeTripByApi,
  createAvailableDriver,
  createClient,
  login,
  mockMapServices,
  rateByApi,
  requestRideByApi,
} from './support';

test.use({ geolocation: PARQUE_93, permissions: ['geolocation'] });
test.beforeEach(({ page }) => mockMapServices(page));

const cards = (page: Page) => page.locator('app-trips app-trip-card');
const rateDialog = (page: Page) => page.locator('app-rate-trip');

async function openHistory(page: Page): Promise<void> {
  // Espera a que termine el inicio de sesión antes de navegar.
  await expect(page).toHaveURL(/\/pasajero/);
  await page.goto('/pasajero/viajes');
  await expect(page.getByRole('heading', { name: 'Mis viajes' })).toBeVisible();
}

/** Elige las estrellas y envía la calificación desde el modal. */
async function rate(page: Page, stars: number, comment?: string): Promise<void> {
  await expect(rateDialog(page).getByRole('heading', { name: /¿Cómo te fue con/ })).toBeVisible();
  await rateDialog(page)
    .getByRole('radio', { name: stars === 1 ? '1 estrella' : `${stars} estrellas` })
    .click();
  if (comment) await rateDialog(page).getByRole('textbox').fill(comment);
  await rateDialog(page).getByRole('button', { name: 'Enviar calificación' }).click();
}

test('asks for the rating as soon as the trip ends (HU-08)', async ({ page, request }) => {
  const client = await createClient(request);
  const driver = await createAvailableDriver(request);
  await requestRideByApi(request, client.token);
  const tripId = await acceptRequest(request, driver.token, client.token);
  await advanceTrip(request, driver.token, tripId, 'arrive');
  await advanceTrip(request, driver.token, tripId, 'start');
  await login(page, client.login, client.password);
  await expect(page.getByRole('heading', { name: /^En camino a/ })).toBeVisible();

  await advanceTrip(request, driver.token, tripId, 'complete');

  // El modal de calificación se abre solo y tapa el resumen hasta que se envía o se cierra.
  await expect(rateDialog(page)).toBeVisible({ timeout: 12_000 });
  await rate(page, 5, 'Conducción impecable');
  await expect(page.getByText('Calificación enviada exitosamente')).toBeVisible();
  await expect(rateDialog(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Llegaste a tu destino' })).toBeVisible();
  await expect(page.getByText('Calificaste este viaje')).toBeVisible();

  await page.getByRole('button', { name: 'Listo' }).click();
  await openHistory(page);
  await expect(cards(page).first().getByRole('radio', { name: '5 estrellas' })).toBeVisible();
});

test('lists past trips, opens the detail and rates from the history', async ({ page, request }) => {
  const client = await createClient(request);
  const driver = await createAvailableDriver(request);
  const first = await completeTripByApi(request, client.token, driver.token);
  await completeTripByApi(request, client.token, driver.token);
  await login(page, client.login, client.password);
  await openHistory(page);

  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).first()).toContainText('Parque de la 93 → Centro Comercial Andino');
  await expect(cards(page).first()).toContainText('Completado');

  // El más antiguo queda al final de la lista.
  await cards(page).last().getByRole('button', { name: 'Calificar' }).click();
  await rate(page, 4);
  await expect(cards(page).last().getByRole('button', { name: 'Calificar' })).toHaveCount(0);

  await cards(page).last().getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/pasajero/viajes/${first}$`));
  await expect(page.getByRole('heading', { name: 'Detalle del viaje' })).toBeVisible();
  await expect(page.getByText('Tarifa final')).toBeVisible();
  await expect(page.getByText('1,6 km')).toBeVisible();
  await expect(page.locator('app-trip-detail').getByRole('radio', { name: '4 estrellas' })).toBeVisible();
});

test('does not rate the same trip twice', async ({ page, request }) => {
  const client = await createClient(request);
  const driver = await createAvailableDriver(request);
  const tripId = await completeTripByApi(request, client.token, driver.token);
  await login(page, client.login, client.password);
  await expect(page).toHaveURL(/\/pasajero/);
  await page.goto(`/pasajero/viajes/${tripId}`);
  await expect(page.getByRole('button', { name: 'Calificar viaje' })).toBeVisible();

  // Mientras tanto, lo califica desde otro dispositivo.
  await rateByApi(request, client.token, tripId, 3);
  await page.getByRole('button', { name: 'Calificar viaje' }).click();
  await rate(page, 5);

  await expect(page.getByText('Este viaje ya fue calificado.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Calificar viaje' })).toHaveCount(0);
});

test('loads older trips while scrolling and shows the empty history', async ({ page, request }) => {
  const client = await createClient(request);
  await login(page, client.login, client.password);
  await openHistory(page);
  await expect(page.getByRole('heading', { name: 'Aún no tienes viajes' })).toBeVisible();

  const driver = await createAvailableDriver(request);
  for (let i = 0; i < 12; i++) await completeTripByApi(request, client.token, driver.token);
  await page.reload();

  // El backend entrega 10 viajes por página.
  await expect(cards(page)).toHaveCount(10);
  await cards(page).last().scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 4000);
  await expect(cards(page)).toHaveCount(12);
  await expect(page.getByText('No hay más viajes.')).toBeVisible();
});
