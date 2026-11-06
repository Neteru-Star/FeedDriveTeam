// Mock local del backend de FeedDrive (Laravel 12 + JWT) según `Backend Uber.md`.
// Sin dependencias: `node mock-api/server.mjs`. Estado en memoria; se reinicia al reiniciar.
// --autopilot (o AUTOPILOT=1) convierte al conductor Carlos (conductor@uber.com) en un bot que acepta y completa viajes.

import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8000);
const AUTOPILOT = process.env.AUTOPILOT === '1' || process.argv.includes('--autopilot');
const TOKEN_TTL = 3600;

const stamp = (date = new Date()) => date.toISOString().replace(/\.\d{3}Z$/, '.000000Z');
const round2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Datos semilla
// ---------------------------------------------------------------------------

let db;
const tokens = new Map();

function seed() {
  const ago = (min) => stamp(new Date(Date.now() - min * 60_000));
  db = {
    seq: {
      users: 5,
      drivers: 2,
      vehicles: 2,
      fares: 1,
      requests: 2,
      trips: 2,
      ratings: 1,
      locations: 1,
      incidents: 0,
      logs: 0,
    },
    users: [
      {
        id: 1,
        name: 'Admin FeedDrive',
        email: 'admin@uber.com',
        phone: '3000000000',
        password: 'admin123',
        role: 'admin',
        status: 'active',
      },
      {
        id: 2,
        name: 'Juan Pérez',
        email: 'cliente@uber.com',
        phone: '3001234567',
        password: 'cliente123',
        role: 'client',
        status: 'active',
      },
      {
        id: 3,
        name: 'Carlos Rodríguez',
        email: 'conductor@uber.com',
        phone: '3119876543',
        password: 'conductor123',
        role: 'driver',
        status: 'active',
      },
      {
        id: 4,
        name: 'Andrés Torres (Pendiente)',
        email: 'andres@uber.com',
        phone: '3125550000',
        password: 'conductor123',
        role: 'driver',
        status: 'active',
      },
      {
        id: 5,
        name: 'María Gómez',
        email: 'maria@uber.com',
        phone: '3205551234',
        password: 'cliente123',
        role: 'client',
        status: 'active',
      },
    ],
    drivers: [
      {
        id: 1,
        user_id: 3,
        license_number: 'LC-55120-CO',
        approval_status: 'approved',
        availability_status: 'unavailable',
        rating_average: 4.95,
        admin_notes: null,
        created_at: ago(9000),
      },
      {
        id: 2,
        user_id: 4,
        license_number: 'LC-11928-C',
        approval_status: 'pending',
        availability_status: 'unavailable',
        rating_average: 5.0,
        admin_notes: null,
        created_at: ago(600),
      },
    ],
    vehicles: [
      {
        id: 1,
        driver_id: 1,
        plate: 'UBR-123',
        brand: 'Chevrolet',
        model: 'Onix Turbo',
        year: 2023,
        capacity: 4,
        color: 'Gris Plata',
      },
      { id: 2, driver_id: 2, plate: 'NEW-456', brand: 'Kia', model: 'Rio', year: 2024, capacity: 4, color: 'Blanco' },
    ],
    fares: [
      {
        id: 1,
        name: 'Tarifa Estándar Urbana',
        base_fare: 3800,
        price_per_km: 1250,
        price_per_minute: 250,
        minimum_fare: 6500,
        surge_multiplier: 1.0,
        active: true,
        created_at: ago(20000),
      },
    ],
    requests: [
      {
        id: 1,
        client_id: 2,
        origin_name: 'Universidad Nacional, Cra. 45 # 26-85',
        origin_latitude: 4.6381,
        origin_longitude: -74.0844,
        destination_name: 'Parque de la 93, Calle 93A # 12-50',
        destination_latitude: 4.6766,
        destination_longitude: -74.0483,
        estimated_distance_km: 5.74,
        estimated_duration_min: 14,
        estimated_fare: 14475,
        status: 'completed',
        cancel_reason: null,
        created_at: ago(2900),
      },
      {
        id: 2,
        client_id: 2,
        origin_name: 'Centro Comercial Andino, Carrera 11 # 82-71',
        origin_latitude: 4.6664,
        origin_longitude: -74.0536,
        destination_name: 'Parque de la 93, Calle 93A # 12-50',
        destination_latitude: 4.6766,
        destination_longitude: -74.0483,
        estimated_distance_km: 1.28,
        estimated_duration_min: 4,
        estimated_fare: 6500,
        status: 'completed',
        cancel_reason: null,
        created_at: ago(1500),
      },
    ],
    trips: [
      {
        id: 1,
        request_id: 1,
        client_id: 2,
        driver_id: 1,
        vehicle_id: 1,
        status: 'completed',
        estimated_fare: 14475,
        final_fare: 9300,
        distance_travelled_km: 5.9,
        duration_travelled_min: 16,
        created_at: ago(2898),
        driver_arrived_at: ago(2893),
        started_at: ago(2891),
        completed_at: ago(2875),
        cancelled_at: null,
        cancel_reason: null,
      },
      {
        id: 2,
        request_id: 2,
        client_id: 2,
        driver_id: 1,
        vehicle_id: 1,
        status: 'completed',
        estimated_fare: 6500,
        final_fare: 6500,
        distance_travelled_km: 1.45,
        duration_travelled_min: 6,
        created_at: ago(1498),
        driver_arrived_at: ago(1494),
        started_at: ago(1493),
        completed_at: ago(1487),
        cancelled_at: null,
        cancel_reason: null,
      },
    ],
    ratings: [
      {
        id: 1,
        trip_id: 1,
        client_id: 2,
        driver_id: 1,
        score: 5,
        comment: 'Muy amable y puntual.',
        has_incident: false,
        created_at: ago(2870),
      },
    ],
    locations: [
      {
        id: 1,
        driver_id: 1,
        latitude: 4.60971,
        longitude: -74.08175,
        heading: null,
        speed: null,
        trip_id: null,
        recorded_at: ago(5),
      },
    ],
    incidents: [],
    logs: [],
  };
  tokens.clear();
}

const nextId = (table) => ++db.seq[table];

// ---------------------------------------------------------------------------
// Utilidades de dominio
// ---------------------------------------------------------------------------

const publicUser = ({ id, name, email, phone, role, status }) => ({ id, name, email, phone, role, status });
const activeFare = () => db.fares.find((f) => f.active) ?? db.fares[db.fares.length - 1];
const driverOf = (user) => db.drivers.find((d) => d.user_id === user.id);
const userById = (id) => db.users.find((u) => u.id === id);
const vehicleOf = (driverId) => db.vehicles.find((v) => v.driver_id === driverId);
const latestLocation = (driverId) => {
  const loc = db.locations.filter((l) => l.driver_id === driverId).at(-1);
  return loc
    ? { latitude: loc.latitude, longitude: loc.longitude, heading: loc.heading, recorded_at: loc.recorded_at }
    : null;
};
const ACTIVE_TRIP = ['assigned', 'driver_arrived', 'in_progress'];

function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function priceFor(fare, km, min) {
  const raw = (fare.base_fare + km * fare.price_per_km + min * fare.price_per_minute) * fare.surge_multiplier;
  return Math.round(Math.max(fare.minimum_fare, raw));
}

function estimate(b) {
  const fare = activeFare();
  const distance = round2(
    haversineKm(b.origin_latitude, b.origin_longitude, b.destination_latitude, b.destination_longitude),
  );
  const duration = Math.max(1, Math.ceil((distance / 25) * 60)); // 25 km/h promedio urbano
  return {
    distance_km: distance,
    duration_min: duration,
    estimated_fare: priceFor(fare, distance, duration),
    currency: 'COP',
    fare_breakdown: {
      base_fare: fare.base_fare,
      price_per_km: fare.price_per_km,
      price_per_minute: fare.price_per_minute,
      minimum_fare: fare.minimum_fare,
      surge_multiplier: fare.surge_multiplier,
    },
  };
}

function audit(user, action, entityType, entityId, description) {
  db.logs.push({
    id: nextId('logs'),
    user_id: user?.id ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    description,
    ip_address: '127.0.0.1',
    created_at: stamp(),
  });
}

function tripView(trip) {
  const req = db.requests.find((r) => r.id === trip.request_id);
  const driver = db.drivers.find((d) => d.id === trip.driver_id);
  const driverUser = userById(driver.user_id);
  const client = userById(trip.client_id);
  const vehicle = db.vehicles.find((v) => v.id === trip.vehicle_id);
  const rating = db.ratings.find((r) => r.trip_id === trip.id);
  return {
    ...trip,
    origin_name: req.origin_name,
    origin_latitude: req.origin_latitude,
    origin_longitude: req.origin_longitude,
    destination_name: req.destination_name,
    destination_latitude: req.destination_latitude,
    destination_longitude: req.destination_longitude,
    estimated_distance_km: req.estimated_distance_km,
    estimated_duration_min: req.estimated_duration_min,
    client: { id: client.id, name: client.name, phone: client.phone },
    driver: {
      id: driver.id,
      rating_average: driver.rating_average,
      user: { name: driverUser.name, phone: driverUser.phone },
      latest_location: latestLocation(driver.id),
    },
    vehicle: vehicle && { plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model, color: vehicle.color },
    rating: rating ? { id: rating.id, score: rating.score, comment: rating.comment } : null,
  };
}

function paginate(items, query, path) {
  const perPage = Math.min(100, Math.max(1, parseInt(query.per_page, 10) || 10));
  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(lastPage, Math.max(1, parseInt(query.page, 10) || 1));
  const start = (page - 1) * perPage;
  const data = items.slice(start, start + perPage);
  const url = (p) => `http://localhost:${PORT}/api${path}?page=${p}`;
  return {
    current_page: page,
    data,
    first_page_url: url(1),
    from: total ? start + 1 : null,
    last_page: lastPage,
    last_page_url: url(lastPage),
    next_page_url: page < lastPage ? url(page + 1) : null,
    path: `http://localhost:${PORT}/api${path}`,
    per_page: perPage,
    prev_page_url: page > 1 ? url(page - 1) : null,
    to: total ? start + data.length : null,
    total,
  };
}

// ---------------------------------------------------------------------------
// Tokens JWT (formato real, firma simulada)
// ---------------------------------------------------------------------------

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

function issueToken(user) {
  const iat = Math.floor(Date.now() / 1000);
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, role: user.role, iat, exp: iat + TOKEN_TTL })}.${randomBytes(24).toString('base64url')}`;
  tokens.set(token, { userId: user.id, exp: (iat + TOKEN_TTL) * 1000 });
  return { access_token: token, token_type: 'bearer', expires_in: TOKEN_TTL };
}

// ---------------------------------------------------------------------------
// Validación estilo Laravel (422)
// ---------------------------------------------------------------------------

class HttpError extends Error {
  constructor(status, body) {
    super(body.message);
    this.status = status;
    this.body = body;
  }
}

const fail = (status, message, extra = {}) => {
  throw new HttpError(status, { success: false, message, ...extra });
};

function validate(body, rules) {
  const errors = {};
  for (const [field, list] of Object.entries(rules)) {
    const value = body[field];
    const empty = value === undefined || value === null || value === '';
    const add = (msg) => (errors[field] ??= []).push(msg);
    if (empty) {
      if (list.includes('required')) add(`El campo ${field} es obligatorio.`);
      continue;
    }
    for (const rule of list) {
      const [name, arg] = Array.isArray(rule) ? rule : [rule];
      if (name === 'string' && typeof value !== 'string') add(`El campo ${field} debe ser texto.`);
      if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))
        add(`El campo ${field} debe ser un correo válido.`);
      if (name === 'numeric' && (typeof value !== 'number' || Number.isNaN(value)))
        add(`El campo ${field} debe ser numérico.`);
      if (name === 'integer' && !Number.isInteger(value)) add(`El campo ${field} debe ser un número entero.`);
      if (name === 'boolean' && typeof value !== 'boolean') add(`El campo ${field} debe ser verdadero o falso.`);
      if (name === 'min' && (typeof value === 'string' ? value.length < arg : value < arg))
        add(
          typeof value === 'string'
            ? `El campo ${field} debe tener al menos ${arg} caracteres.`
            : `El campo ${field} debe ser al menos ${arg}.`,
        );
      if (name === 'max' && (typeof value === 'string' ? value.length > arg : value > arg))
        add(
          typeof value === 'string'
            ? `El campo ${field} no debe superar ${arg} caracteres.`
            : `El campo ${field} no debe ser mayor a ${arg}.`,
        );
      if (name === 'in' && !arg.includes(value)) add(`El valor de ${field} no es válido.`);
      if (name === 'unique' && arg(value)) add(`El valor de ${field} ya está en uso.`);
    }
  }
  const fields = Object.keys(errors);
  if (fields.length) {
    const first = errors[fields[0]][0];
    const more = fields.length - 1;
    throw new HttpError(422, {
      message: more ? `${first} (y ${more} error${more > 1 ? 'es' : ''} más)` : first,
      errors,
    });
  }
}

const lat = ['required', 'numeric', ['min', -90], ['max', 90]];
const lng = ['required', 'numeric', ['min', -180], ['max', 180]];

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

const routes = [];
const route = (method, path, roles, handler) => {
  const pattern = new RegExp(`^${path.replace(/\{(\w+)\}/g, '(?<$1>\\d+)')}$`);
  routes.push({ method, pattern, roles, handler });
};

// --- Autenticación ---------------------------------------------------------

route('POST', '/auth/register', null, ({ body }) => {
  const isDriver = body.role === 'driver';
  validate(body, {
    name: ['required', 'string', ['max', 255]],
    email: ['required', 'email', ['unique', (v) => db.users.some((u) => u.email === v)]],
    phone: ['required', 'string', ['min', 7], ['max', 20], ['unique', (v) => db.users.some((u) => u.phone === v)]],
    password: ['required', 'string', ['min', 8]],
    role: ['required', ['in', ['client', 'driver']]],
    ...(isDriver && {
      license_number: ['required', 'string', ['max', 50]],
      plate: [
        'required',
        'string',
        ['max', 10],
        ['unique', (v) => db.vehicles.some((x) => x.plate.toUpperCase() === String(v).toUpperCase())],
      ],
      brand: ['required', 'string'],
      model: ['required', 'string'],
      year: ['required', 'integer', ['min', 1990], ['max', new Date().getFullYear() + 1]],
      capacity: ['required', 'integer', ['min', 1], ['max', 8]],
      color: ['required', 'string'],
    }),
  });
  const user = {
    id: nextId('users'),
    name: body.name,
    email: body.email,
    phone: body.phone,
    password: body.password,
    role: body.role,
    status: 'active',
  };
  db.users.push(user);
  if (isDriver) {
    const driver = {
      id: nextId('drivers'),
      user_id: user.id,
      license_number: body.license_number,
      approval_status: 'pending',
      availability_status: 'unavailable',
      rating_average: 5.0,
      admin_notes: null,
      created_at: stamp(),
    };
    db.drivers.push(driver);
    db.vehicles.push({
      id: nextId('vehicles'),
      driver_id: driver.id,
      plate: body.plate.toUpperCase(),
      brand: body.brand,
      model: body.model,
      year: body.year,
      capacity: body.capacity,
      color: body.color,
    });
  }
  audit(user, 'register', 'user', user.id, `Registro de ${user.role}`);
  return [
    201,
    { success: true, message: 'Usuario registrado exitosamente', ...issueToken(user), user: publicUser(user) },
  ];
});

route('POST', '/auth/login', null, ({ body }) => {
  validate(body, { login: ['required', 'string'], password: ['required', 'string'] });
  const user = db.users.find((u) => u.email === body.login || u.phone === body.login);
  if (!user || user.password !== body.password) fail(401, 'Credenciales inválidas');
  if (user.status !== 'active') fail(403, 'Su cuenta se encuentra inactiva o suspendida.');
  audit(user, 'login', 'user', user.id, 'Inicio de sesión');
  return [200, { success: true, message: 'Inicio de sesión exitoso', ...issueToken(user), user: publicUser(user) }];
});

route('GET', '/auth/me', 'auth', ({ user }) => [200, { success: true, user: publicUser(user) }]);

route('POST', '/auth/logout', 'auth', ({ user, token }) => {
  tokens.delete(token);
  audit(user, 'logout', 'user', user.id, 'Cierre de sesión');
  return [200, { success: true, message: 'Sesión cerrada exitosamente' }];
});

route('POST', '/auth/forgot-password', null, ({ body }) => {
  validate(body, { email: ['required', 'email'], new_password: ['required', 'string', ['min', 8]] });
  const user = db.users.find((u) => u.email === body.email);
  if (!user)
    throw new HttpError(422, {
      message: 'No existe una cuenta con este correo.',
      errors: { email: ['No existe una cuenta con este correo.'] },
    });
  user.password = body.new_password;
  for (const [t, s] of tokens) if (s.userId === user.id) tokens.delete(t);
  audit(user, 'password_reset', 'user', user.id, 'Restablecimiento de contraseña');
  return [
    200,
    { success: true, message: 'Contraseña restablecida exitosamente. Ya puede iniciar sesión con su nueva clave.' },
  ];
});

// --- Tarifas públicas ------------------------------------------------------

route('GET', '/fares/active', null, () => [200, { success: true, fare: activeFare() }]);

// --- Cliente ---------------------------------------------------------------

const coordRules = {
  origin_latitude: lat,
  origin_longitude: lng,
  destination_latitude: lat,
  destination_longitude: lng,
};

function clientActive(clientId) {
  const request = db.requests.find((r) => r.client_id === clientId && r.status === 'requested');
  if (request) return { type: 'request', request };
  const trip = db.trips.find((t) => t.client_id === clientId && ACTIVE_TRIP.includes(t.status));
  if (trip) return { type: 'trip', trip };
  return null;
}

route('POST', '/client/estimate-fare', ['client'], ({ body }) => {
  validate(body, coordRules);
  return [200, { success: true, estimate: estimate(body) }];
});

route('POST', '/client/ride-requests', ['client'], ({ body, user }) => {
  validate(body, {
    origin_name: ['required', 'string', ['max', 255]],
    destination_name: ['required', 'string', ['max', 255]],
    ...coordRules,
  });
  const active = clientActive(user.id);
  if (active) {
    const id = active.type === 'request' ? active.request.id : active.trip.request_id;
    fail(400, 'Ya cuenta con una solicitud o viaje activo en curso.', { active_request_id: id });
  }
  const est = estimate(body);
  const request = {
    id: nextId('requests'),
    client_id: user.id,
    origin_name: body.origin_name,
    origin_latitude: body.origin_latitude,
    origin_longitude: body.origin_longitude,
    destination_name: body.destination_name,
    destination_latitude: body.destination_latitude,
    destination_longitude: body.destination_longitude,
    estimated_distance_km: est.distance_km,
    estimated_duration_min: est.duration_min,
    estimated_fare: est.estimated_fare,
    status: 'requested',
    cancel_reason: null,
    created_at: stamp(),
  };
  db.requests.push(request);
  return [
    201,
    {
      success: true,
      message: 'Solicitud de viaje creada exitosamente. Buscando conductores disponibles...',
      ride_request: request,
    },
  ];
});

route('GET', '/client/active', ['client'], ({ user }) => {
  const active = clientActive(user.id);
  if (!active) return [200, { success: true, has_active: false, type: null, data: null }];
  if (active.type === 'request')
    return [200, { success: true, has_active: true, type: 'request', data: active.request }];
  return [200, { success: true, has_active: true, type: 'trip', data: tripView(active.trip) }];
});

route('POST', '/client/cancel/{id}', ['client'], ({ body, user, params }) => {
  validate(body, { reason: ['string', ['max', 255]] });
  const id = Number(params.id);
  let request = db.requests.find(
    (r) => r.id === id && r.client_id === user.id && ['requested', 'accepted'].includes(r.status),
  );
  let trip = request ? db.trips.find((t) => t.request_id === request.id) : null;
  if (!request) {
    trip = db.trips.find((t) => t.id === id && t.client_id === user.id);
    request = trip && db.requests.find((r) => r.id === trip.request_id);
  }
  if (!request) fail(404, 'Solicitud no encontrada.');
  if (trip && trip.status === 'in_progress') fail(400, 'No es posible cancelar un viaje que ya inició su recorrido.');
  if (trip && !ACTIVE_TRIP.includes(trip.status)) fail(400, 'Este viaje ya fue finalizado o cancelado.');
  if (!trip && request.status !== 'requested') fail(400, 'Esta solicitud ya no puede cancelarse.');
  const reason = body.reason ?? null;
  request.status = 'cancelled';
  request.cancel_reason = reason;
  if (trip) {
    Object.assign(trip, { status: 'cancelled', cancelled_at: stamp(), cancel_reason: reason });
    const driver = db.drivers.find((d) => d.id === trip.driver_id);
    driver.availability_status = 'available';
  }
  return [200, { success: true, message: 'Solicitud cancelada exitosamente' }];
});

route('GET', '/client/trips', ['client'], ({ user, query }) => {
  const trips = db.trips
    .filter((t) => t.client_id === user.id)
    .sort((a, b) => b.id - a.id)
    .map(tripView);
  return [200, { success: true, trips: paginate(trips, query, '/client/trips') }];
});

route('POST', '/client/trips/{id}/rating', ['client'], ({ body, user, params }) => {
  validate(body, {
    score: ['required', 'integer', ['min', 1], ['max', 5]],
    comment: ['string', ['max', 500]],
    has_incident: ['boolean'],
  });
  const trip = db.trips.find((t) => t.id === Number(params.id) && t.client_id === user.id);
  if (!trip) fail(404, 'Viaje no encontrado.');
  if (trip.status !== 'completed') fail(400, 'Solo puede calificar viajes finalizados.');
  if (db.ratings.some((r) => r.trip_id === trip.id)) fail(400, 'Este viaje ya fue calificado.');
  const rating = {
    id: nextId('ratings'),
    trip_id: trip.id,
    client_id: user.id,
    driver_id: trip.driver_id,
    score: body.score,
    comment: body.comment ?? null,
    has_incident: body.has_incident ?? false,
    created_at: stamp(),
  };
  db.ratings.push(rating);
  const scores = db.ratings.filter((r) => r.driver_id === trip.driver_id).map((r) => r.score);
  db.drivers.find((d) => d.id === trip.driver_id).rating_average = round2(
    scores.reduce((a, b) => a + b, 0) / scores.length,
  );
  if (rating.has_incident) {
    db.incidents.push({
      id: nextId('incidents'),
      trip_id: trip.id,
      reported_by: user.id,
      description: rating.comment ?? 'Incidencia reportada en la calificación',
      status: 'open',
      created_at: stamp(),
    });
  }
  return [
    201,
    {
      success: true,
      message: 'Calificación enviada exitosamente. ¡Gracias por sus comentarios!',
      rating: { id: rating.id, trip_id: rating.trip_id, score: rating.score, comment: rating.comment },
    },
  ];
});

// --- Conductor -------------------------------------------------------------

function approvedDriver(user) {
  const driver = driverOf(user);
  if (driver.approval_status !== 'approved')
    fail(403, 'Su cuenta de conductor aún no ha sido aprobada.', { approval_status: driver.approval_status });
  return driver;
}

function ownTrip(driver, id) {
  const trip = db.trips.find((t) => t.id === Number(id));
  if (!trip) fail(404, 'Viaje no encontrado.');
  if (trip.driver_id !== driver.id) fail(403, 'Este viaje no le pertenece.');
  return trip;
}

function transition(trip, from, to) {
  if (trip.status !== from)
    fail(400, `Transición de estado no permitida: ${trip.status} → ${to}.`, { current_status: trip.status });
  trip.status = to;
}

route('PUT', '/driver/availability', ['driver'], ({ body, user }) => {
  validate(body, { status: ['required', ['in', ['available', 'unavailable']]] });
  const driver = driverOf(user);
  if (driver.approval_status !== 'approved')
    fail(403, 'Solo conductores aprobados pueden activar su disponibilidad.', {
      approval_status: driver.approval_status,
    });
  if (db.trips.some((t) => t.driver_id === driver.id && ACTIVE_TRIP.includes(t.status)))
    fail(400, 'No puede cambiar su disponibilidad con un viaje activo.');
  driver.availability_status = body.status;
  return [
    200,
    { success: true, message: `Disponibilidad cambiada a: ${body.status}`, availability_status: body.status },
  ];
});

route('GET', '/driver/ride-requests', ['driver'], ({ user }) => {
  approvedDriver(user);
  const requests = db.requests
    .filter((r) => r.status === 'requested')
    .map((r) => {
      const client = userById(r.client_id);
      return { ...r, client: { name: client.name, phone: client.phone } };
    });
  return [200, { success: true, requests }];
});

route('POST', '/driver/ride-requests/{id}/accept', ['driver'], ({ user, params }) => {
  const driver = approvedDriver(user);
  return [200, acceptRequest(driver, Number(params.id))];
});

function acceptRequest(driver, requestId) {
  const request = db.requests.find((r) => r.id === requestId);
  if (!request) fail(404, 'Solicitud no encontrada.');
  if (request.status !== 'requested')
    fail(409, 'Lo sentimos, este servicio ya fue tomado por otro conductor o fue cancelado.');
  if (db.trips.some((t) => t.driver_id === driver.id && ACTIVE_TRIP.includes(t.status)))
    fail(400, 'Ya tiene un viaje activo.');
  if (driver.availability_status !== 'available') fail(400, 'Debe estar disponible para aceptar servicios.');
  const vehicle = vehicleOf(driver.id);
  request.status = 'accepted';
  driver.availability_status = 'busy';
  const trip = {
    id: nextId('trips'),
    request_id: request.id,
    client_id: request.client_id,
    driver_id: driver.id,
    vehicle_id: vehicle?.id ?? null,
    status: 'assigned',
    estimated_fare: request.estimated_fare,
    final_fare: null,
    distance_travelled_km: null,
    duration_travelled_min: null,
    created_at: stamp(),
    driver_arrived_at: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    cancel_reason: null,
  };
  db.trips.push(trip);
  return {
    success: true,
    message: 'Servicio aceptado exitosamente',
    trip: {
      id: trip.id,
      request_id: trip.request_id,
      client_id: trip.client_id,
      driver_id: trip.driver_id,
      status: trip.status,
      estimated_fare: trip.estimated_fare,
    },
  };
}

route('POST', '/driver/trips/{id}/arrive', ['driver'], ({ user, params }) => {
  const trip = ownTrip(approvedDriver(user), params.id);
  transition(trip, 'assigned', 'driver_arrived');
  trip.driver_arrived_at = stamp();
  return [
    200,
    {
      success: true,
      message: 'Llegada registrada. El cliente ha sido notificado.',
      trip: { id: trip.id, status: trip.status, driver_arrived_at: trip.driver_arrived_at },
    },
  ];
});

route('POST', '/driver/trips/{id}/start', ['driver'], ({ user, params }) => {
  const trip = ownTrip(approvedDriver(user), params.id);
  transition(trip, 'driver_arrived', 'in_progress');
  trip.started_at = stamp();
  return [
    200,
    {
      success: true,
      message: 'Viaje iniciado exitosamente',
      trip: { id: trip.id, status: trip.status, started_at: trip.started_at },
    },
  ];
});

route('POST', '/driver/trips/{id}/complete', ['driver'], ({ body, user, params }) => {
  validate(body, {
    actual_distance_km: ['required', 'numeric', ['min', 0]],
    actual_duration_min: ['required', 'integer', ['min', 0]],
  });
  const driver = approvedDriver(user);
  const trip = ownTrip(driver, params.id);
  return [200, completeTrip(driver, trip, body.actual_distance_km, body.actual_duration_min)];
});

function completeTrip(driver, trip, km, min) {
  transition(trip, 'in_progress', 'completed');
  Object.assign(trip, {
    final_fare: priceFor(activeFare(), km, min),
    distance_travelled_km: km,
    duration_travelled_min: min,
    completed_at: stamp(),
  });
  db.requests.find((r) => r.id === trip.request_id).status = 'completed';
  driver.availability_status = 'available';
  return {
    success: true,
    message: 'Viaje finalizado con éxito. Tarifa definitiva calculada.',
    trip: {
      id: trip.id,
      status: trip.status,
      final_fare: trip.final_fare,
      distance_travelled_km: km,
      duration_travelled_min: min,
      completed_at: trip.completed_at,
    },
  };
}

route('POST', '/driver/location', ['driver'], ({ body, user }) => {
  validate(body, { latitude: lat, longitude: lng, heading: ['numeric'], speed: ['numeric'], trip_id: ['integer'] });
  const driver = driverOf(user);
  const loc = {
    id: nextId('locations'),
    driver_id: driver.id,
    latitude: body.latitude,
    longitude: body.longitude,
    heading: body.heading ?? null,
    speed: body.speed ?? null,
    trip_id: body.trip_id ?? null,
    recorded_at: stamp(),
  };
  db.locations.push(loc);
  return [
    200,
    {
      success: true,
      location: {
        driver_id: driver.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        recorded_at: loc.recorded_at,
      },
    },
  ];
});

// --- Administrador ---------------------------------------------------------

function driverView(d) {
  const u = userById(d.user_id);
  return {
    ...d,
    user: { id: u.id, name: u.name, email: u.email, phone: u.phone, status: u.status },
    vehicles: db.vehicles.filter((v) => v.driver_id === d.id),
  };
}

route('GET', '/admin/dashboard', ['admin'], () => {
  const count = (list, fn) => list.filter(fn).length;
  const completed = db.trips.filter((t) => t.status === 'completed');
  return [
    200,
    {
      success: true,
      stats: {
        total_clients: count(db.users, (u) => u.role === 'client'),
        total_drivers: db.drivers.length,
        pending_drivers: count(db.drivers, (d) => d.approval_status === 'pending'),
        approved_drivers: count(db.drivers, (d) => d.approval_status === 'approved'),
        active_trips: count(db.trips, (t) => ACTIVE_TRIP.includes(t.status)),
        completed_trips: completed.length,
        cancelled_trips: count(db.trips, (t) => t.status === 'cancelled'),
        pending_requests: count(db.requests, (r) => r.status === 'requested'),
        total_revenue: completed.reduce((sum, t) => sum + t.final_fare, 0),
      },
      recent_trips: [...db.trips]
        .sort((a, b) => b.id - a.id)
        .slice(0, 5)
        .map(tripView),
      recent_incidents: [...db.incidents].sort((a, b) => b.id - a.id).slice(0, 5),
    },
  ];
});

route('GET', '/admin/drivers', ['admin'], ({ query }) => {
  const drivers = db.drivers
    .filter((d) => !query.approval_status || d.approval_status === query.approval_status)
    .map(driverView);
  return [200, { success: true, drivers }];
});

route('PATCH', '/admin/drivers/{id}/approval', ['admin'], ({ body, user, params }) => {
  validate(body, {
    approval_status: ['required', ['in', ['pending', 'approved', 'suspended', 'rejected']]],
    admin_notes: ['string', ['max', 500]],
  });
  const driver = db.drivers.find((d) => d.id === Number(params.id));
  if (!driver) fail(404, 'Conductor no encontrado.');
  driver.approval_status = body.approval_status;
  driver.admin_notes = body.admin_notes ?? driver.admin_notes;
  if (body.approval_status !== 'approved') driver.availability_status = 'unavailable';
  audit(user, 'driver_approval', 'driver', driver.id, `Estado del conductor actualizado a: ${body.approval_status}`);
  return [
    200,
    {
      success: true,
      message: `Estado del conductor actualizado a: ${body.approval_status}`,
      driver: { id: driver.id, approval_status: driver.approval_status },
    },
  ];
});

route('GET', '/admin/fares', ['admin'], () => [
  200,
  { success: true, fares: [...db.fares].sort((a, b) => b.id - a.id) },
]);

route('POST', '/admin/fares', ['admin'], ({ body, user }) => {
  const money = ['required', 'numeric', ['min', 0]];
  validate(body, {
    name: ['required', 'string', ['max', 100]],
    base_fare: money,
    price_per_km: money,
    price_per_minute: money,
    minimum_fare: money,
    surge_multiplier: ['required', 'numeric', ['min', 1], ['max', 5]],
    active: ['boolean'],
  });
  const fare = {
    id: nextId('fares'),
    name: body.name,
    base_fare: body.base_fare,
    price_per_km: body.price_per_km,
    price_per_minute: body.price_per_minute,
    minimum_fare: body.minimum_fare,
    surge_multiplier: body.surge_multiplier,
    active: body.active ?? false,
    created_at: stamp(),
  };
  if (fare.active) db.fares.forEach((f) => (f.active = false));
  db.fares.push(fare);
  audit(user, 'fare_create', 'fare', fare.id, `Tarifa creada: ${fare.name}`);
  return [201, { success: true, message: 'Tarifa configurada exitosamente', fare }];
});

route('GET', '/admin/trips', ['admin'], ({ query }) => {
  const trips = db.trips
    .filter((t) => !query.status || t.status === query.status)
    .filter((t) => !query.driver_id || t.driver_id === Number(query.driver_id))
    .filter((t) => !query.client_id || t.client_id === Number(query.client_id))
    .filter((t) => !query.date || t.created_at.startsWith(query.date))
    .sort((a, b) => b.id - a.id)
    .map(tripView);
  return [200, { success: true, trips: paginate(trips, query, '/admin/trips') }];
});

route('GET', '/admin/reports', ['admin'], () => {
  const completed = db.trips.filter((t) => t.status === 'completed');
  const cancelled = db.trips.filter((t) => t.status === 'cancelled');
  const cancelledRequests = db.requests.filter((r) => r.status === 'cancelled');
  const revenue = completed.reduce((s, t) => s + t.final_fare, 0);
  const reasons = {};
  for (const r of cancelledRequests)
    reasons[r.cancel_reason ?? 'Sin motivo'] = (reasons[r.cancel_reason ?? 'Sin motivo'] ?? 0) + 1;
  return [
    200,
    {
      success: true,
      report: {
        revenue: {
          total: revenue,
          completed_trips: completed.length,
          average_fare: completed.length ? Math.round(revenue / completed.length) : 0,
        },
        cancellations: {
          total: cancelledRequests.length,
          cancelled_trips: cancelled.length,
          rate: db.requests.length ? round2(cancelledRequests.length / db.requests.length) : 0,
          by_reason: Object.entries(reasons).map(([reason, count]) => ({ reason, count })),
        },
        drivers: db.drivers.map((d) => {
          const own = completed.filter((t) => t.driver_id === d.id);
          return {
            driver_id: d.id,
            name: userById(d.user_id).name,
            approval_status: d.approval_status,
            completed_trips: own.length,
            revenue: own.reduce((s, t) => s + t.final_fare, 0),
            rating_average: d.rating_average,
          };
        }),
      },
    },
  ];
});

route('GET', '/admin/audit-logs', ['admin'], ({ query }) => {
  const logs = [...db.logs]
    .sort((a, b) => b.id - a.id)
    .map((l) => ({ ...l, user: l.user_id ? { name: userById(l.user_id)?.name } : null }));
  return [200, { success: true, logs: paginate(logs, query, '/admin/audit-logs') }];
});

// --- Utilidad del mock (no existe en el backend real) ----------------------

route('POST', '/__mock/reset', null, () => {
  seed();
  return [200, { success: true, message: 'Datos del mock reiniciados' }];
});

// ---------------------------------------------------------------------------
// Autopiloto: Carlos acepta, llega, inicia y completa viajes solo
// ---------------------------------------------------------------------------

const BOT_DRIVER_ID = 1;
const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
const secondsSince = (iso) => (Date.now() - new Date(iso).getTime()) / 1000;

function moveBot(driver, fromLat, fromLng, toLat, toLng, progress, tripId) {
  db.locations.push({
    id: nextId('locations'),
    driver_id: driver.id,
    latitude: round6(lerp(fromLat, toLat, progress)),
    longitude: round6(lerp(fromLng, toLng, progress)),
    heading: null,
    speed: 30,
    trip_id: tripId,
    recorded_at: stamp(),
  });
}
const round6 = (n) => Math.round(n * 1e6) / 1e6;

function autopilotTick() {
  const bot = db.drivers.find((d) => d.id === BOT_DRIVER_ID);
  if (!bot || bot.approval_status !== 'approved') return;
  const trip = db.trips.find((t) => t.driver_id === bot.id && ACTIVE_TRIP.includes(t.status));
  if (!trip) {
    const pending = db.requests.find((r) => r.status === 'requested' && secondsSince(r.created_at) > 6);
    if (pending) {
      bot.availability_status = 'available';
      const result = acceptRequest(bot, pending.id);
      const req = pending;
      // Punto de partida: ~1,5 km al sur del origen
      db.locations.push({
        id: nextId('locations'),
        driver_id: bot.id,
        latitude: req.origin_latitude - 0.0135,
        longitude: req.origin_longitude,
        heading: 0,
        speed: 30,
        trip_id: result.trip.id,
        recorded_at: stamp(),
      });
      console.log(`[autopiloto] Carlos aceptó la solicitud #${req.id}`);
    }
    return;
  }
  const req = db.requests.find((r) => r.id === trip.request_id);
  if (trip.status === 'assigned') {
    const progress = secondsSince(trip.created_at) / 20;
    moveBot(
      bot,
      req.origin_latitude - 0.0135,
      req.origin_longitude,
      req.origin_latitude,
      req.origin_longitude,
      progress,
      trip.id,
    );
    if (progress >= 1) {
      trip.status = 'driver_arrived';
      trip.driver_arrived_at = stamp();
      console.log(`[autopiloto] Carlos llegó al origen del viaje #${trip.id}`);
    }
  } else if (trip.status === 'driver_arrived' && secondsSince(trip.driver_arrived_at) > 8) {
    trip.status = 'in_progress';
    trip.started_at = stamp();
    console.log(`[autopiloto] Viaje #${trip.id} iniciado`);
  } else if (trip.status === 'in_progress') {
    const progress = secondsSince(trip.started_at) / 25;
    moveBot(
      bot,
      req.origin_latitude,
      req.origin_longitude,
      req.destination_latitude,
      req.destination_longitude,
      progress,
      trip.id,
    );
    if (progress >= 1) {
      completeTrip(bot, trip, req.estimated_distance_km, req.estimated_duration_min);
      console.log(`[autopiloto] Viaje #${trip.id} completado`);
    }
  }
}

// ---------------------------------------------------------------------------
// Servidor HTTP
// ---------------------------------------------------------------------------

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
};

function send(res, status, body) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, { success: false, message: 'JSON inválido en el cuerpo de la petición.' });
  }
}

function authenticate(req) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const session = token && tokens.get(token);
  if (!session || session.exp < Date.now()) {
    if (session) tokens.delete(token);
    throw new HttpError(401, { message: 'Unauthenticated.' });
  }
  const user = userById(session.userId);
  if (!user || user.status !== 'active')
    throw new HttpError(403, { success: false, message: 'Su cuenta se encuentra inactiva o suspendida.' });
  return { user, token };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const started = Date.now();
  let status = 500;
  try {
    if (!url.pathname.startsWith('/api/')) fail(404, 'Ruta no encontrada.');
    const path = url.pathname.slice(4).replace(/\/$/, '');
    const matches = routes.filter((r) => r.pattern.test(path));
    if (!matches.length) fail(404, 'Ruta no encontrada.');
    const match = matches.find((r) => r.method === req.method);
    if (!match) fail(405, 'Método no permitido para esta ruta.');
    const ctx = {
      req,
      params: match.pattern.exec(path).groups ?? {},
      query: Object.fromEntries(url.searchParams),
      body: {},
    };
    if (match.roles) {
      Object.assign(ctx, authenticate(req));
      if (Array.isArray(match.roles) && !match.roles.includes(ctx.user.role)) {
        fail(403, `Acceso denegado. Esta acción requiere el rol: ${match.roles.join(', ')}.`);
      }
    }
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) ctx.body = await readBody(req);
    const [code, body] = match.handler(ctx);
    status = code;
    send(res, code, body);
  } catch (err) {
    if (err instanceof HttpError) {
      status = err.status;
      send(res, err.status, err.body);
    } else {
      console.error(err);
      send(res, 500, { success: false, message: 'Error interno del servidor.' });
    }
  } finally {
    console.log(`${req.method} ${url.pathname} → ${status} (${Date.now() - started} ms)`);
  }
});

seed();
if (AUTOPILOT) setInterval(autopilotTick, 2000);
// Conexiones reutilizadas por los clientes de prueba: si el servidor las cierra a los 5 s (valor por defecto
// de Node), una petición puede salir justo por un socket que se está cerrando y fallar con ECONNRESET.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock FeedDrive API en http://localhost:${PORT}/api ${AUTOPILOT ? '(autopiloto activo)' : ''}`);
});
