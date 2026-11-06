import type { Page } from '@playwright/test';

/** Usuarios de prueba del backend simulado (mock-api/server.mjs). */
export const USERS = {
  client: { login: 'cliente@uber.com', password: 'cliente123', home: '/pasajero' },
  driver: { login: '3119876543', password: 'conductor123', home: '/conductor' },
  admin: { login: 'admin@uber.com', password: 'admin123', home: '/admin' },
} as const;

export const PARQUE_93 = { latitude: 4.6766, longitude: -74.0483 };

const reverseResult = {
  lat: '4.6766',
  lon: '-74.0483',
  name: '',
  display_name: 'Calle 93A, Chicó, Bogotá',
  address: { road: 'Calle 93A', house_number: '12-50', suburb: 'Chicó', city: 'Bogotá' },
};

const places: Record<string, object[]> = {
  virrey: [
    {
      lat: '4.6732',
      lon: '-74.0539',
      name: 'Parque El Virrey',
      display_name: 'Parque El Virrey, Chicó, Bogotá',
      address: { neighbourhood: 'Chicó', city: 'Bogotá' },
    },
  ],
  // Mismo punto que la ubicación del pasajero, para probar la regla de origen igual al destino.
  casa: [{ ...reverseResult, name: 'Mi casa' }],
};

/** Teselas y geocodificación sin red: las pruebas no dependen de OpenStreetMap ni de su límite de peticiones. */
export async function mockMapServices(page: Page): Promise<void> {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('https://nominatim.openstreetmap.org/reverse**', (route) => route.fulfill({ json: reverseResult }));
  await page.route('https://nominatim.openstreetmap.org/search**', (route) => {
    const query = new URL(route.request().url()).searchParams.get('q')?.toLowerCase() ?? '';
    const key = Object.keys(places).find((k) => query.includes(k));
    return route.fulfill({ json: key ? places[key] : [] });
  });
}

export async function login(page: Page, user: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo o teléfono').fill(user);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

/** Cierra sesión desde la pantalla de cuenta, que existe para los tres roles. */
export async function logout(page: Page, home: string): Promise<void> {
  await page.goto(`${home}/cuenta`);
  await page.locator('app-account').getByRole('button', { name: 'Cerrar sesión' }).click();
}
