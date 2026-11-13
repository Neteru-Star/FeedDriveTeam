#!/usr/bin/env node
/**
 * Diagnóstico de solo lectura del backend antes de usar la app con él.
 *
 *   npm run check:real                                   -> servidor del profesor, sin iniciar sesión
 *   npm run check:real -- cliente@uber.com cliente123    -> además revisa las rutas del rol de esa cuenta
 *   npm run check:real -- admin@x.com clave http://otra-ip:8000/api
 *
 * Revisa que responda, que CORS deje entrar a la web y al APK, y que las respuestas tengan la forma que la app
 * espera. No crea ni modifica datos: solo consulta y, al final, cierra la sesión que abrió.
 */
const [login, password, baseArg] = process.argv.slice(2);
const BASE = (baseArg ?? process.env.FEEDDRIVE_API_URL ?? 'http://20.20.2.171:8000/api').replace(/\/$/, '');
const TIMEOUT_MS = 8000;
/** Orígenes desde los que llega la app: `npm start` en el navegador y el APK (androidScheme http). */
const ORIGINS = ['http://localhost:8100', 'http://localhost'];

let failures = 0;
const ok = (msg) => console.log(`  ✅ ${msg}`);
const bad = (msg) => {
  failures++;
  console.log(`  ❌ ${msg}`);
};
const warn = (msg) => console.log(`  ⚠️  ${msg}`);

async function call(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* no es JSON */
  }
  return { status: res.status, headers: res.headers, json, text };
}

/** Comprueba que existan las claves (con puntos para anidar) que lee la app. */
function expectKeys(label, data, keys) {
  const missing = keys.filter(
    (k) => k.split('.').reduce((o, part) => (o == null ? undefined : o[part]), data) === undefined,
  );
  if (missing.length) bad(`${label}: faltan ${missing.join(', ')}`);
  else ok(`${label}: forma esperada`);
}

console.log(`\nBackend: ${BASE}\n`);

// 1. Responde
console.log('Conexión');
try {
  const fare = await call('GET', '/fares/active');
  if (fare.status === 200) {
    ok(`GET /fares/active → 200`);
    expectKeys('Tarifa activa', fare.json, [
      'fare.base_fare',
      'fare.price_per_km',
      'fare.minimum_fare',
      'fare.surge_multiplier',
    ]);
  } else bad(`GET /fares/active → ${fare.status} ${fare.text.slice(0, 120)}`);
} catch (error) {
  bad(`No responde (${error.name === 'TimeoutError' ? 'tiempo agotado' : error.message}).`);
  console.log('\n  ¿Estás en la red de la universidad? El servidor solo es accesible desde ahí.\n');
  process.exit(1);
}

// 2. CORS
console.log('\nCORS (web y APK)');
for (const origin of ORIGINS) {
  try {
    const pre = await call('OPTIONS', '/auth/login', {
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    const allowed = pre.headers.get('access-control-allow-origin');
    if (allowed === '*' || allowed === origin) ok(`${origin} permitido (${allowed})`);
    else bad(`${origin} no permitido (Access-Control-Allow-Origin: ${allowed ?? 'ausente'}, estado ${pre.status})`);
  } catch (error) {
    bad(`Preflight desde ${origin} falló: ${error.message}`);
  }
}

// 3. Sesión y rutas del rol
if (!login || !password) {
  warn('Sin credenciales: no se revisan las rutas con sesión. Pasa correo y contraseña para revisarlas.');
} else {
  console.log(`\nSesión (${login})`);
  const auth = await call('POST', '/auth/login', { body: { login, password } });
  if (auth.status !== 200 || !auth.json?.access_token) {
    bad(`POST /auth/login → ${auth.status} ${auth.json?.message ?? auth.text.slice(0, 120)}`);
  } else {
    ok('POST /auth/login → 200');
    expectKeys('Login', auth.json, ['access_token', 'expires_in', 'user.id', 'user.role', 'user.name']);
    const token = auth.json.access_token;
    const role = auth.json.user?.role;
    const me = await call('GET', '/auth/me', { token });
    if (me.status === 200) ok(`GET /auth/me → 200 (rol ${role})`);
    else bad(`GET /auth/me → ${me.status}`);

    const checks =
      {
        client: [
          ['GET', '/client/active', ['has_active']],
          ['GET', '/client/trips', ['trips']],
        ],
        driver: [['GET', '/driver/ride-requests', ['requests']]],
        admin: [
          ['GET', '/admin/dashboard', ['stats.total_revenue']],
          ['GET', '/admin/drivers', ['drivers']],
          ['GET', '/admin/fares', ['fares']],
          ['GET', '/admin/trips', ['trips']],
          ['GET', '/admin/reports', ['report']],
          ['GET', '/admin/audit-logs', ['logs']],
        ],
      }[role] ?? [];

    console.log(`\nRutas del rol ${role}`);
    for (const [method, path, keys] of checks) {
      const res = await call(method, path, { token });
      if (role === 'driver' && res.status === 403) {
        warn(
          `${path} → 403 ${res.json?.message ?? ''} (approval_status: ${res.json?.approval_status ?? '?'}): la app mostrará "cuenta en revisión"`,
        );
        continue;
      }
      if (res.status !== 200) {
        bad(`${method} ${path} → ${res.status} ${res.json?.message ?? res.text.slice(0, 120)}`);
        continue;
      }
      ok(`${method} ${path} → 200`);
      expectKeys(path, res.json, keys);
      // Formas que la documentación no muestra: se informan para saber qué adaptador usa la app.
      const paged = keys.map((k) => res.json?.[k.split('.')[0]]).find((v) => v && !Array.isArray(v) && 'data' in v);
      if (paged)
        console.log(
          `     página de Laravel (current_page ${paged.current_page ?? '?'}, last_page ${paged.last_page ?? '?'})`,
        );
    }

    const out = await call('POST', '/auth/logout', { token });
    if (out.status === 200) ok('POST /auth/logout → 200 (sesión de prueba cerrada)');
    else warn(`POST /auth/logout → ${out.status}`);
  }
}

console.log(
  failures
    ? `\n${failures} problema(s). Revisa lo marcado con ❌.\n`
    : '\nTodo listo para usar la app con este backend.\n',
);
process.exit(failures ? 1 : 0);
