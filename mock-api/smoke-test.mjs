// Prueba de humo del backend simulado: levanta el servidor en un puerto libre y recorre los flujos de los tres roles.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = 8790;
const API = `http://localhost:${PORT}/api`;
const server = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url))], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve) => server.stdout.once('data', resolve));

let failures = 0;
async function call(method, path, { token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}
function expect(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` (esperado ${expected}, recibido ${actual})`}`);
}
const login = async (user, password) =>
  (await call('POST', '/auth/login', { body: { login: user, password } })).json.access_token;
const route = {
  origin_latitude: 4.6766,
  origin_longitude: -74.0483,
  destination_latitude: 4.6664,
  destination_longitude: -74.0536,
};

try {
  // Autenticación
  expect(
    'login con credenciales malas → 401',
    (await call('POST', '/auth/login', { body: { login: 'x@x.com', password: 'nope' } })).status,
    401,
  );
  expect('registro vacío → 422', (await call('POST', '/auth/register', { body: {} })).status, 422);
  expect('me sin token → 401', (await call('GET', '/auth/me')).status, 401);
  const client = await login('cliente@uber.com', 'cliente123');
  const admin = await login('admin@uber.com', 'admin123');
  const driver = await login('3119876543', 'conductor123'); // login por teléfono
  const pending = await login('andres@uber.com', 'conductor123');
  expect('me con token → 200', (await call('GET', '/auth/me', { token: client })).status, 200);
  expect('cliente en ruta de admin → 403', (await call('GET', '/admin/dashboard', { token: client })).status, 403);
  const reg = await call('POST', '/auth/register', {
    body: {
      name: 'Héctor Fabio',
      email: 'hector@ejemplo.com',
      phone: '3154567890',
      password: 'password123',
      role: 'driver',
      license_number: 'LC-88291-CO',
      plate: 'HJK-987',
      brand: 'Mazda',
      model: 'Mazda 3',
      year: 2024,
      capacity: 4,
      color: 'Rojo',
    },
  });
  expect('registro de conductor → 201', reg.status, 201);
  expect(
    'correo repetido → 422',
    (
      await call('POST', '/auth/register', {
        body: { name: 'a', email: 'hector@ejemplo.com', phone: '3999999999', password: 'password123', role: 'client' },
      })
    ).status,
    422,
  );

  // Tarifa y solicitud
  expect('tarifa activa → 200', (await call('GET', '/fares/active')).status, 200);
  const est = await call('POST', '/client/estimate-fare', { token: client, body: route });
  expect('estimación → 6500 COP', est.json.estimate?.estimated_fare, 6500);
  const req = await call('POST', '/client/ride-requests', {
    token: client,
    body: { ...route, origin_name: 'Parque 93', destination_name: 'Andino' },
  });
  expect('solicitud → 201', req.status, 201);
  const dup = await call('POST', '/client/ride-requests', {
    token: client,
    body: { ...route, origin_name: 'a', destination_name: 'b' },
  });
  expect('solicitud duplicada → 400', dup.status, 400);
  expect('duplicada trae active_request_id', dup.json.active_request_id, req.json.ride_request.id);
  expect('activo tipo request', (await call('GET', '/client/active', { token: client })).json.type, 'request');

  // Conductor
  expect(
    'pendiente no puede conectarse → 403',
    (await call('PUT', '/driver/availability', { token: pending, body: { status: 'available' } })).status,
    403,
  );
  expect(
    'aprobado se conecta → 200',
    (await call('PUT', '/driver/availability', { token: driver, body: { status: 'available' } })).status,
    200,
  );
  expect('ve la solicitud', (await call('GET', '/driver/ride-requests', { token: driver })).json.requests.length, 1);
  const accepted = await call('POST', `/driver/ride-requests/${req.json.ride_request.id}/accept`, { token: driver });
  expect('acepta → 200', accepted.status, 200);
  const tripId = accepted.json.trip.id;
  expect(
    'conductor no aprobado acepta → 403',
    (await call('POST', `/driver/ride-requests/${req.json.ride_request.id}/accept`, { token: pending })).status,
    403,
  );
  await call('PATCH', '/admin/drivers/2/approval', { token: admin, body: { approval_status: 'approved' } });
  await call('PUT', '/driver/availability', { token: pending, body: { status: 'available' } });
  expect(
    'conductor aprobado llega tarde → 409',
    (await call('POST', `/driver/ride-requests/${req.json.ride_request.id}/accept`, { token: pending })).status,
    409,
  );
  expect(
    'completar antes de iniciar → 400',
    (
      await call('POST', `/driver/trips/${tripId}/complete`, {
        token: driver,
        body: { actual_distance_km: 1, actual_duration_min: 3 },
      })
    ).status,
    400,
  );
  expect(
    'ubicación → 200',
    (
      await call('POST', '/driver/location', {
        token: driver,
        body: { latitude: 4.67, longitude: -74.05, trip_id: tripId },
      })
    ).status,
    200,
  );
  const active = await call('GET', '/client/active', { token: client });
  expect('cliente ve viaje asignado', active.json.data?.status, 'assigned');
  expect('cliente ve placa', active.json.data?.vehicle?.plate, 'UBR-123');
  expect('llegada → 200', (await call('POST', `/driver/trips/${tripId}/arrive`, { token: driver })).status, 200);
  expect('inicio → 200', (await call('POST', `/driver/trips/${tripId}/start`, { token: driver })).status, 200);
  expect(
    'cancelar en curso → 400',
    (await call('POST', `/client/cancel/${req.json.ride_request.id}`, { token: client, body: {} })).status,
    400,
  );
  const done = await call('POST', `/driver/trips/${tripId}/complete`, {
    token: driver,
    body: { actual_distance_km: 1.45, actual_duration_min: 6 },
  });
  expect('fin → completed', done.json.trip?.status, 'completed');

  // Calificación e historial
  expect(
    'califica → 201',
    (await call('POST', `/client/trips/${tripId}/rating`, { token: client, body: { score: 5, comment: 'Excelente' } }))
      .status,
    201,
  );
  expect(
    'califica de nuevo → 400',
    (await call('POST', `/client/trips/${tripId}/rating`, { token: client, body: { score: 4 } })).status,
    400,
  );
  expect(
    'historial paginado',
    (await call('GET', '/client/trips?per_page=2', { token: client })).json.trips.per_page,
    2,
  );

  // Cancelación
  const req2 = await call('POST', '/client/ride-requests', {
    token: client,
    body: { ...route, origin_name: 'a', destination_name: 'b' },
  });
  expect(
    'cancela solicitud → 200',
    (
      await call('POST', `/client/cancel/${req2.json.ride_request.id}`, {
        token: client,
        body: { reason: 'Cambio de planes' },
      })
    ).status,
    200,
  );

  // Administración
  const dash = await call('GET', '/admin/dashboard', { token: admin });
  expect('dashboard → 3 viajes completados', dash.json.stats.completed_trips, 3);
  expect(
    'conductores pendientes',
    (await call('GET', '/admin/drivers?approval_status=pending', { token: admin })).json.drivers.length,
    1,
  );
  expect(
    'crear tarifa → 201',
    (
      await call('POST', '/admin/fares', {
        token: admin,
        body: {
          name: 'Hora pico',
          base_fare: 4500,
          price_per_km: 1500,
          price_per_minute: 350,
          minimum_fare: 8000,
          surge_multiplier: 1.3,
          active: true,
        },
      })
    ).status,
    201,
  );
  expect('tarifa activa cambia', (await call('GET', '/fares/active')).json.fare.name, 'Hora pico');
  expect(
    'viajes filtrados',
    (await call('GET', '/admin/trips?status=completed', { token: admin })).json.trips.total,
    3,
  );
  expect('reportes → 200', (await call('GET', '/admin/reports', { token: admin })).status, 200);
  expect(
    'auditoría registra acciones',
    (await call('GET', '/admin/audit-logs', { token: admin })).json.logs.total > 0,
    true,
  );
  expect('logout → 200', (await call('POST', '/auth/logout', { token: client })).status, 200);
  expect('token invalidado → 401', (await call('GET', '/auth/me', { token: client })).status, 401);
} finally {
  server.kill();
}

console.log(failures ? `\n${failures} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
process.exit(failures ? 1 : 0);
