import { expect, test } from '@playwright/test';

import { USERS, createDriver, login, mockMapServices } from './support';

test.beforeEach(({ page }) => mockMapServices(page));

test('shows the dashboard with the platform indicators (HU-09)', async ({ page }) => {
  await login(page, USERS.admin.login, USERS.admin.password);

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Ingresos totales')).toBeVisible();
  await expect(page.getByText('Por aprobar')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Viajes recientes' })).toBeVisible();
});

test('approves a pending driver, who can then go online', async ({ page, browser, request }, testInfo) => {
  const driver = await createDriver(request, { approved: false });
  await login(page, USERS.admin.login, USERS.admin.password);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.goto('/admin/conductores?estado=pending');

  const row = page.getByRole('row').filter({ hasText: driver.login });
  await expect(row).toContainText('Pendiente');
  await row.getByRole('button', { name: /^Aprobar a / }).click();
  await page.locator('ion-alert').getByRole('button', { name: 'Aprobar' }).click();
  await expect(page.getByText(/aprobado\.$/)).toBeVisible();

  // El conductor ya puede conectarse.
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    geolocation: { latitude: 4.6766, longitude: -74.0483 },
    permissions: ['geolocation'],
  });
  const driverApp = await context.newPage();
  await mockMapServices(driverApp);
  await login(driverApp, driver.login, driver.password);
  await driverApp.getByRole('button', { name: 'Conectarme' }).click();
  await expect(driverApp.getByRole('heading', { name: 'Estás en línea' })).toBeVisible();
  await context.close();
});

test('asks for a reason to suspend a driver', async ({ page, request }) => {
  const driver = await createDriver(request, { available: false });
  await login(page, USERS.admin.login, USERS.admin.password);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.goto('/admin/conductores?estado=approved');

  const row = page.getByRole('row').filter({ hasText: driver.login });
  await row.getByRole('button', { name: /^Suspender a / }).click();
  await page.getByLabel('Notas del administrador').fill('Documentos vencidos');
  await page.locator('ion-alert').getByRole('button', { name: 'Confirmar' }).click();

  await expect(page.getByText(/suspendido\.$/)).toBeVisible();
  await page.goto('/admin/conductores?estado=suspended');
  await expect(page.getByRole('row').filter({ hasText: driver.login })).toContainText('Documentos vencidos');
});

test('previews and creates a fare', async ({ page }) => {
  await login(page, USERS.admin.login, USERS.admin.password);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.goto('/admin/tarifas');
  const name = `Prueba ${Date.now()}`;

  await page.getByLabel('Nombre').fill(name);
  await page.getByLabel('Multiplicador de demanda').fill('2');
  await page.getByRole('switch', { name: /Activar al crearla/ }).click();
  // 5 km y 15 min con base 3.800, 1.250/km y 250/min, por 2.
  await expect(page.getByText('$ 27.600')).toBeVisible();
  await page.getByRole('button', { name: 'Crear tarifa' }).click();

  await expect(page.getByText(`Tarifa "${name}" creada.`)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: name })).toContainText('Inactiva');
});

test('keeps the trip filters in the URL', async ({ page }) => {
  await login(page, USERS.admin.login, USERS.admin.password);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.goto('/admin/viajes');

  await page.getByLabel('Estado').selectOption('completed');
  await expect(page).toHaveURL(/status=completed/);
  await expect(page.getByRole('row').nth(1)).toContainText('Completado');

  await page.reload();
  await expect(page.getByLabel('Estado')).toHaveValue('completed');
  await page.getByRole('button', { name: 'Limpiar' }).click();
  await expect(page).toHaveURL(/\/admin\/viajes$/);
});

test('searches the audit log', async ({ page }) => {
  await login(page, USERS.admin.login, USERS.admin.password);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.goto('/admin/auditoria');

  await expect(page.getByRole('row').nth(1)).toBeVisible();
  await page.getByLabel('Buscar').fill('sesion');
  await expect(page.getByRole('row').nth(1)).toContainText(/sesión/i);
});
