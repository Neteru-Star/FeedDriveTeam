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

export interface TestDriver {
  token: string;
  name: string;
  plate: string;
  login: string;
  password: string;
  driverId: number;
}

/**
 * Conductor nuevo. Por defecto queda aprobado y en línea, listo para aceptar solicitudes;
 * con `approved: false` queda pendiente de aprobación y con `available: false`, fuera de línea.
 */
export async function createDriver(
  request: APIRequestContext,
  { approved = true, available = true }: { approved?: boolean; available?: boolean } = {},
): Promise<TestDriver> {
  const { email, phone } = uniqueIdentity('conductor');
  // Placa aleatoria (17 millones de combinaciones): el backend simulado conserva las placas entre corridas.
  const letter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const plate = `${letter()}${letter()}${letter()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  const name = 'Pedro Gómez';
  const password = 'clave1234';
  const res = await request.post(`${API}/auth/register`, {
    data: {
      name,
      email,
      phone,
      password,
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
  if (!res.ok()) throw new Error(`Registro del conductor: ${res.status()} ${await res.text()}`);
  const userId = (await res.json()).user.id;
  const driverId = await findDriverId(request, userId);
  if (approved) await approveDriver(request, driverId);
  const token = await apiLogin(request, email, password);
  if (approved && available) {
    await request.put(`${API}/driver/availability`, { headers: auth(token), data: { status: 'available' } });
  }
  return { token, name, plate, login: email, password, driverId };
}

/** Conductor aprobado y en línea (atajo de `createDriver`). */
export const createAvailableDriver = (request: APIRequestContext): Promise<TestDriver> => createDriver(request);

async function findDriverId(request: APIRequestContext, userId: number): Promise<number> {
  const admin = await apiLogin(request, USERS.admin.login, USERS.admin.password);
  const drivers = await (await request.get(`${API}/admin/drivers`, { headers: auth(admin) })).json();
  return drivers.drivers.find((d: { user_id: number }) => d.user_id === userId).id;
}

/** El administrador aprueba al conductor. */
export async function approveDriver(request: APIRequestContext, driverId: number): Promise<void> {
  const admin = await apiLogin(request, USERS.admin.login, USERS.admin.password);
  await request.patch(`${API}/admin/drivers/${driverId}/approval`, {
    headers: auth(admin),
    data: { approval_status: 'approved' },
  });
}

/** El conductor acepta la solicitud pendiente del pasajero (por su id). Devuelve el id del viaje. */
export async function acceptRequest(
  request: APIRequestContext,
  driverToken: string,
  clientToken: string,
): Promise<number> {
  const active = await (await request.get(`${API}/client/active`, { headers: auth(clientToken) })).json();
  const res = await request.post(`${API}/driver/ride-requests/${active.data.id}/accept`, {
    headers: auth(driverToken),
  });
  return (await res.json()).trip.id;
}

/** El conductor avanza el viaje: llegó al punto, inició o finalizó (con distancia y tiempo reales). */
export async function advanceTrip(
  request: APIRequestContext,
  driverToken: string,
  tripId: number,
  action: 'arrive' | 'start' | 'complete',
): Promise<void> {
  const data = action === 'complete' ? { actual_distance_km: 1.6, actual_duration_min: 6 } : undefined;
  const res = await request.post(`${API}/driver/trips/${tripId}/${action}`, { headers: auth(driverToken), data });
  if (!res.ok()) throw new Error(`${action}: ${res.status()} ${await res.text()}`);
}

/** El conductor reporta su posición GPS. */
export async function reportLocation(
  request: APIRequestContext,
  driverToken: string,
  position: { latitude: number; longitude: number },
): Promise<void> {
  await request.post(`${API}/driver/location`, { headers: auth(driverToken), data: position });
}

/** Viaje completo por la API (solicitud, aceptación, llegada, inicio y fin). Devuelve el id del viaje. */
export async function completeTripByApi(
  request: APIRequestContext,
  clientToken: string,
  driverToken: string,
): Promise<number> {
  await requestRideByApi(request, clientToken);
  const tripId = await acceptRequest(request, driverToken, clientToken);
  for (const action of ['arrive', 'start', 'complete'] as const) {
    await advanceTrip(request, driverToken, tripId, action);
  }
  return tripId;
}

/** El pasajero califica un viaje por la API, como si lo hubiera hecho desde otro dispositivo. */
export async function rateByApi(
  request: APIRequestContext,
  clientToken: string,
  tripId: number,
  score: number,
): Promise<void> {
  await request.post(`${API}/client/trips/${tripId}/rating`, {
    headers: auth(clientToken),
    data: { score, has_incident: false },
  });
}

/**
 * Crea una solicitud por la API, como si el pasajero la hubiera pedido desde otro dispositivo.
 * `originName` permite reconocerla entre las solicitudes de otras pruebas que corren en paralelo.
 */
export async function requestRideByApi(
  request: APIRequestContext,
  clientToken: string,
  originName = 'Parque de la 93',
): Promise<void> {
  await request.post(`${API}/client/ride-requests`, {
    headers: auth(clientToken),
    data: {
      origin_name: originName,
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
