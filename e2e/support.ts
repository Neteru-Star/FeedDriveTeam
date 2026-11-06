import type { APIRequestContext, Page } from '@playwright/test';

/** API del backend simulado que levanta Playwright (playwright.config.ts). */
export const API = 'http://localhost:8000/api';

let sequence = 0;
/** Correo y celular únicos: las pruebas corren en paralelo contra el mismo backend simulado. */
function uniqueIdentity(prefix: string): { email: string; phone: string } {
  const id = `${Date.now()}${process.pid}${sequence++}`.slice(-9).padStart(9, '0');
  return { email: `${prefix}${id}@correo.com`, phone: `3${id}` };
}

async function apiLogin(request: APIRequestContext, login: string, password: string): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: { login, password } });
  return (await res.json()).access_token;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: 'application/json' });

/** Pasajero nuevo, sin viajes, para que cada prueba tenga su propio estado. */
export async function createClient(
  request: APIRequestContext,
): Promise<{ login: string; password: string; token: string }> {
  const { email, phone } = uniqueIdentity('pasajero');
  const password = 'clave1234';
  await request.post(`${API}/auth/register`, { data: { name: 'Laura Gómez', email, phone, password, role: 'client' } });
  return { login: email, password, token: await apiLogin(request, email, password) };
}

/** Conductor nuevo, aprobado por el administrador y en línea, listo para aceptar solicitudes. */
export async function createAvailableDriver(
  request: APIRequestContext,
): Promise<{ token: string; name: string; plate: string }> {
  const { email, phone } = uniqueIdentity('conductor');
  const plate = `T${String.fromCharCode(65 + (sequence % 26))}${String.fromCharCode(65 + (Number(phone.slice(-4, -3)) % 26))}${phone.slice(-3)}`;
  const name = 'Pedro Gómez';
  const res = await request.post(`${API}/auth/register`, {
    data: {
      name,
      email,
      phone,
      password: 'clave1234',
      role: 'driver',
      license_number: `LC-${phone.slice(-6)}`,
      plate,
      brand: 'Renault',
      model: 'Logan',
      year: 2023,
      capacity: 4,
      color: 'Blanco',
    },
  });
  const driverId = (await res.json()).user.id;
  const admin = await apiLogin(request, USERS.admin.login, USERS.admin.password);
  const drivers = await (await request.get(`${API}/admin/drivers`, { headers: auth(admin) })).json();
  const driver = drivers.drivers.find((d: { user_id: number }) => d.user_id === driverId);
  await request.patch(`${API}/admin/drivers/${driver.id}/approval`, {
    headers: auth(admin),
    data: { approval_status: 'approved' },
  });
  const token = await apiLogin(request, email, 'clave1234');
  await request.put(`${API}/driver/availability`, { headers: auth(token), data: { status: 'available' } });
  return { token, name, plate };
}

/** El conductor acepta la solicitud pendiente del pasajero (por su id). */
export async function acceptRequest(
  request: APIRequestContext,
  driverToken: string,
  clientToken: string,
): Promise<void> {
  const active = await (await request.get(`${API}/client/active`, { headers: auth(clientToken) })).json();
  await request.post(`${API}/driver/ride-requests/${active.data.id}/accept`, { headers: auth(driverToken) });
}

/** Crea una solicitud por la API, como si el pasajero la hubiera pedido desde otro dispositivo. */
export async function requestRideByApi(request: APIRequestContext, clientToken: string): Promise<void> {
  await request.post(`${API}/client/ride-requests`, {
    headers: auth(clientToken),
    data: {
      origin_name: 'Parque de la 93',
      origin_latitude: 4.6766,
      origin_longitude: -74.0483,
      destination_name: 'Centro Comercial Andino',
      destination_latitude: 4.6664,
      destination_longitude: -74.0536,
    },
  });
}

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
