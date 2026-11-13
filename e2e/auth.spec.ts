import { expect, test } from '@playwright/test';

import { USERS, login, logout, mockMapServices } from './support';

test.beforeEach(({ page }) => mockMapServices(page));

// Lo que identifica la pantalla inicial de cada rol.
const HOME_MARK = {
  client: { url: /\/pasajero$/, text: '¿A dónde vas?' },
  driver: { url: /\/conductor$/, text: 'Estás fuera de línea' },
  admin: { url: /\/admin\/dashboard$/, text: 'Viajes recientes' },
};

for (const [role, user] of Object.entries(USERS)) {
  test(`logs in as ${role} and keeps the session after reloading`, async ({ page }) => {
    const mark = HOME_MARK[role as keyof typeof HOME_MARK];
    await login(page, user.login, user.password);

    await expect(page).toHaveURL(mark.url);
    await expect(page.getByRole('heading', { name: mark.text })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: mark.text })).toBeVisible();

    await logout(page, user.home);
    await expect(page).toHaveURL(/\/login$/);
  });
}

test('rejects a wrong password', async ({ page }) => {
  await login(page, 'cliente@uber.com', 'incorrecta');

  await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos');
  await expect(page).toHaveURL(/\/login$/);
});

test('sends a visitor to the login and back to the requested page', async ({ page }) => {
  await page.goto('/pasajero');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fpasajero$/);

  await page.getByLabel('Correo o teléfono').fill(USERS.client.login);
  await page.getByLabel('Contraseña').fill(USERS.client.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page).toHaveURL(/\/pasajero$/);
});

test('shows access denied when a passenger opens /admin', async ({ page }) => {
  await login(page, USERS.client.login, USERS.client.password);
  await expect(page).toHaveURL(/\/pasajero$/);

  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Acceso denegado' })).toBeVisible();
  await expect(page.getByText('Tu cuenta de pasajero no tiene permiso')).toBeVisible();
});

test('closes the session cleanly when the token is no longer valid', async ({ page }) => {
  await login(page, USERS.client.login, USERS.client.password);
  await expect(page).toHaveURL(/\/pasajero$/);

  // Simula un token invalidado en el servidor: la sesión guardada conserva un token que el backend ya no acepta.
  await page.evaluate(() => {
    // En la web la sesión vive en sessionStorage (una por pestaña).
    const key = 'feeddrive.session';
    const session = JSON.parse(sessionStorage.getItem(key)!);
    sessionStorage.setItem(key, JSON.stringify({ ...session, token: 'token-invalido' }));
  });
  await page.reload();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('Tu sesión expiró')).toBeVisible();
});

test('registers a passenger and then logs in', async ({ page }) => {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `laura${id}@correo.com`;
  const phone = `3${id.slice(-9).padStart(9, '0')}`;

  await page.goto('/registro');
  await page.getByLabel('Nombre completo').fill('Laura Gómez');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Celular').fill(phone);
  await page.getByLabel('Contraseña').fill('clave1234');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await expect(page.getByRole('status')).toHaveText('Cuenta creada. Ya puedes iniciar sesión.');

  // Ionic deja la página de registro oculta en la pila de navegación: se busca dentro del login.
  const loginPage = page.locator('app-login');
  await loginPage.getByLabel('Correo o teléfono').fill(email);
  await loginPage.getByLabel('Contraseña').fill('clave1234');
  await loginPage.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/pasajero$/);
  await expect(page.getByRole('heading', { name: '¿A dónde vas?' })).toBeVisible();
});

test('registers a driver in two steps', async ({ page }) => {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  await page.goto('/registro');
  await page.getByRole('button', { name: 'Conductor' }).click();
  await page.getByLabel('Nombre completo').fill('Carlos Ruiz');
  await page.getByLabel('Correo').fill(`carlos${id}@correo.com`);
  await page.getByLabel('Celular').fill(`3${id.slice(-9).padStart(9, '0')}`);
  await page.getByLabel('Contraseña').fill('clave1234');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await expect(page.getByText('Paso 2 de 2')).toBeVisible();
  await page.getByLabel('Número de licencia').fill(`LC-${id.slice(-6)}`);
  await page
    .getByLabel('Placa')
    .fill(
      `K${String.fromCharCode(65 + (Number(id.slice(-1)) % 26))}${String.fromCharCode(65 + (Number(id.slice(-2, -1)) % 26))}${id.slice(-3)}`,
    );
  await page.getByLabel('Color').fill('Gris');
  await page.getByLabel('Marca').fill('Chevrolet');
  await page.getByLabel('Modelo').fill('Onix');
  await page.getByLabel('Año').fill('2022');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page).toHaveURL(/\/login\?registered=1$/);
});
