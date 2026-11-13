import { expect, test, type Page } from '@playwright/test';

import { PARQUE_93, USERS, createDriver, login, logout, mockMapServices } from './support';

test.use({ geolocation: PARQUE_93, permissions: ['geolocation'] });

/** Otra pestaña del mismo navegador: comparte cookies y localStorage, pero no sessionStorage. */
async function newTab(page: Page): Promise<Page> {
  const tab = await page.context().newPage();
  await mockMapServices(tab);
  return tab;
}

const passengerHome = (page: Page) => page.getByRole('heading', { name: '¿A dónde vas?' });
const driverHome = (page: Page) => page.getByRole('heading', { name: /^Estás (fuera de línea|en línea)$/ });

test('keeps a different session in each tab of the same browser', async ({ page, request }) => {
  // Conductor propio: el de prueba lo usan otras pruebas en paralelo.
  const driver = await createDriver(request, { available: false });
  await mockMapServices(page);
  await login(page, USERS.client.login, USERS.client.password);
  await expect(passengerHome(page)).toBeVisible();

  const driverTab = await newTab(page);
  await login(driverTab, driver.login, driver.password);
  // Primero consulta la aprobación de la cuenta: con la suite en paralelo puede tardar.
  await expect(driverHome(driverTab)).toBeVisible({ timeout: 15_000 });

  // Iniciar sesión en la segunda pestaña no cambia la primera, ni siquiera al recargar.
  // (Las pestañas ocultas no corren las animaciones de Ionic: se trae al frente la que se usa, como haría una persona.)
  await page.bringToFront();
  await page.reload();
  await expect(page).toHaveURL(/\/pasajero$/);
  await expect(passengerHome(page)).toBeVisible();
  await driverTab.bringToFront();
  await driverTab.reload();
  await expect(driverTab).toHaveURL(/\/conductor$/);
  await expect(driverHome(driverTab)).toBeVisible({ timeout: 15_000 });

  // Cada pestaña sigue usando su propio token: el pasajero consulta su historial.
  await page.bringToFront();
  await page.goto('/pasajero/viajes');
  await expect(page.getByRole('heading', { name: 'Mis viajes' })).toBeVisible();
  await expect(page.locator('app-trip-card').first()).toBeVisible();
});

test('logging out in one tab keeps the other session open', async ({ page }) => {
  await mockMapServices(page);
  await login(page, USERS.admin.login, USERS.admin.password);
  await expect(page.getByText('Ingresos totales')).toBeVisible();

  const passengerTab = await newTab(page);
  await login(passengerTab, USERS.client.login, USERS.client.password);
  await expect(passengerHome(passengerTab)).toBeVisible();

  await logout(passengerTab, '/pasajero');
  await expect(passengerTab).toHaveURL(/\/login$/);

  await page.bringToFront();
  await page.reload();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByText('Ingresos totales')).toBeVisible();
});

test('a new tab starts without a session', async ({ page }) => {
  await mockMapServices(page);
  await login(page, USERS.client.login, USERS.client.password);
  await expect(passengerHome(page)).toBeVisible();

  const fresh = await newTab(page);
  await fresh.goto('/pasajero');

  await expect(fresh).toHaveURL(/\/login/);
});
