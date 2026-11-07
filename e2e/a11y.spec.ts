import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { PARQUE_93, USERS, login, mockMapServices } from './support';

test.use({ geolocation: PARQUE_93, permissions: ['geolocation'] });
test.beforeEach(({ page }) => mockMapServices(page));

/**
 * Auditoría automática de accesibilidad (WCAG 2.1 A y AA) de las pantallas principales.
 * Falla con las infracciones graves o críticas; el mapa de Leaflet se excluye porque sus teselas no son contenido.
 */
async function audit(page: Page): Promise<void> {
  // Las animaciones de entrada pueden dejar contrastes intermedios.
  await page.waitForTimeout(600);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('.leaflet-container')
    // El contenedor de scroll interno de ion-content vive en su shadow DOM y no admite tabindex; su contenido sí es
    // navegable con el teclado.
    .exclude([['ion-content', '.inner-scroll']])
    .analyze();
  const serious = result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id}: ${v.help} → ${v.nodes
          .map((n) => n.target.join(' '))
          .slice(0, 3)
          .join(' | ')}`,
    );
  expect(serious).toEqual([]);
}

test('login and registration are accessible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  await audit(page);

  await page.goto('/registro');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await audit(page);
});

test('the passenger screens are accessible', async ({ page }) => {
  await login(page, USERS.client.login, USERS.client.password);
  await expect(page.getByRole('heading', { name: '¿A dónde vas?' })).toBeVisible();
  await audit(page);

  await page.goto('/pasajero/viajes');
  await expect(page.locator('app-trip-card').first()).toBeVisible();
  await audit(page);
});

test('the driver screen is accessible', async ({ page }) => {
  await login(page, USERS.driver.login, USERS.driver.password);
  await expect(page.getByRole('heading', { name: /Estás/ })).toBeVisible();
  await audit(page);
});

test('the admin panel is accessible', async ({ page }) => {
  // Seis pantallas auditadas: con la suite completa en paralelo puede tardar más de 30 s.
  test.setTimeout(120_000);
  await login(page, USERS.admin.login, USERS.admin.password);
  await expect(page.getByText('Ingresos totales')).toBeVisible({ timeout: 15_000 });
  await audit(page);

  for (const path of ['/admin/conductores', '/admin/tarifas', '/admin/viajes', '/admin/reportes', '/admin/auditoria']) {
    await page.goto(path);
    await expect(page.locator('.adm-page')).toBeVisible({ timeout: 15_000 });
    await audit(page);
  }
});
