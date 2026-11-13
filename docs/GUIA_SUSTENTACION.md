# Guía de sustentación de FeedDrive

Todo lo que el equipo debe saber explicar del frontend: qué tecnologías usamos y por qué, cómo viajan los datos, dónde
se guardan, cómo funciona el mapa y qué decisiones tomamos frente al backend del profesor.

---

## 1. FeedDrive en 30 segundos

FeedDrive es la aplicación (frontend) de una plataforma de transporte tipo Uber con tres roles:

- **Pasajero:** elige origen y destino en el mapa, ve la tarifa estimada, pide el viaje, sigue al conductor en tiempo
  real, ve el historial y califica.
- **Conductor:** se conecta, envía su GPS, ve las solicitudes cercanas, acepta una y avanza el viaje (llegué, iniciar,
  finalizar) con la distancia real medida por GPS.
- **Administrador:** ve indicadores, aprueba o suspende conductores, crea tarifas y consulta viajes, reportes y
  auditoría.

El backend (API REST en Laravel 12 con JWT y PostgreSQL) lo provee el profesor y **no se modifica**. Nosotros
construimos solo el frontend: una aplicación web que también se compila como app Android (APK).

---

## 2. Tecnologías

| Capa                         | Tecnología                                                                          | Versión           | Para qué la usamos                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Framework                    | **Angular**                                                                         | 22                | Estructura de la app, componentes, rutas, formularios, HTTP.                                                                    |
| Componentes móviles          | **Ionic**                                                                           | 9                 | Componentes con aspecto de app (botones, menús, modales, listas, toggles), navegación con animaciones y botón atrás de Android. |
| App nativa                   | **Capacitor**                                                                       | 8                 | Empaqueta la web como app Android y da acceso a GPS, almacenamiento, vibración y botón atrás.                                   |
| Lenguaje                     | **TypeScript**                                                                      | 6 (modo estricto) | Tipos en todo el código: los errores se detectan al compilar.                                                                   |
| Programación reactiva        | **RxJS**                                                                            | 7.8               | Consultas periódicas (polling), búsqueda con espera (debounce), cancelación de peticiones.                                      |
| Estado                       | **Signals de Angular**                                                              | —                 | Estado de cada pantalla y de los stores; la vista se actualiza sola cuando cambia un signal.                                    |
| Mapa                         | **Leaflet** + teselas de **OpenStreetMap**                                          | 1.9               | Dibuja el mapa, los marcadores y la ruta.                                                                                       |
| Direcciones                  | **Nominatim** (OpenStreetMap)                                                       | —                 | Buscar una dirección y saber qué dirección hay en un punto.                                                                     |
| Rutas                        | **OSRM** (OpenStreetMap)                                                            | —                 | Calcular la ruta por las calles con su distancia y tiempo.                                                                      |
| Plugins nativos              | `@capacitor/geolocation`, `preferences`, `haptics`, `app`, `status-bar`, `keyboard` | 8                 | GPS, almacenamiento en el teléfono, vibración, botón atrás, barra de estado y teclado.                                          |
| Tipografías                  | Bricolage Grotesque, Geist, Geist Mono                                              | —                 | Incluidas en la app (no dependen de internet).                                                                                  |
| Pruebas unitarias            | **Vitest** + Testing Library                                                        | 5                 | Prueban servicios, stores y componentes.                                                                                        |
| Pruebas de extremo a extremo | **Playwright**                                                                      | 1.64              | Usan la app real en un navegador móvil y uno de escritorio.                                                                     |
| Accesibilidad                | **axe-core**                                                                        | 4.14              | Auditoría automática WCAG 2.1 AA dentro de las pruebas E2E.                                                                     |
| Calidad de código            | ESLint, Prettier, Husky, lint-staged, commitlint                                    | —                 | Estilo uniforme y mensajes de commit convencionales, revisados antes de cada commit.                                            |

**¿Por qué Angular + Ionic + Capacitor?** Con un solo código obtenemos la web y la app Android. Angular da estructura
fuerte (inyección de dependencias, rutas, formularios tipados) para un proyecto con tres roles; Ionic da la
experiencia de app móvil; Capacitor da acceso al hardware del teléfono.

**¿Por qué Leaflet y OpenStreetMap y no Google Maps?** Son libres y no piden tarjeta ni clave de API. El estilo claro y
oscuro de la marca se logra con filtros CSS sobre las teselas de OpenStreetMap.

---

## 3. Arquitectura

```
src/app/
├── core/       Servicios únicos: sesión (auth), HTTP (interceptores y errores), configuración,
│               ubicación (GPS), geocodificador, rutas, tema, dispositivo (vibración, botón atrás).
├── layout/     Estructura por rol: menú lateral, página con mapa y panel inferior, encabezados.
├── shared/     Reutilizable sin lógica de negocio: componentes de UI, pipes de formato (pesos,
│               distancia, duración), validadores, utilidades geográficas y la máquina de estados del viaje.
└── features/   Una carpeta por área: auth, client (pasajero), driver (conductor), admin, account, errors.
    └── <área>/
        ├── <área>.routes.ts   Rutas del rol (se cargan solo cuando se entra al rol).
        ├── data-access/       API, modelos y stores (estado) del área.
        ├── components/        Piezas visuales del área.
        └── pages/             Pantallas enrutadas.
```

Ideas clave para explicar:

- **Componentes standalone:** cada componente declara lo que usa; no hay módulos NgModule.
- **Carga perezosa por rol:** el código del administrador no se descarga si entra un pasajero.
- **Guards por rol:** `/pasajero`, `/conductor` y `/admin` solo se abren con el rol correcto; si no, se muestra
  "acceso denegado".
- **Stores por rol:** el estado del pasajero o del conductor se crea al entrar a su sección y se destruye al cerrar
  sesión, así otro usuario no hereda datos.
- **Clases intercambiables:** el mapa y las pantallas dependen de clases abstractas (`Geocoder`, `RoutePlanner`). Cambiar
  Nominatim u OSRM por Google o Mapbox no toca las pantallas.
- **Máquina de estados del viaje** en un solo archivo (`shared/models/trip-status.ts`):
  `requested → assigned → driver_arrived → in_progress → completed | cancelled`. De ahí salen los textos, colores, qué
  rol puede cancelar en cada estado y qué botón ve el conductor. Ninguna pantalla compara estados "a mano".

---

## 4. Cómo viajan los datos

```
Pantalla ──lee signals──▶ Store ──llama──▶ Api ──HttpClient──▶ Interceptores ──▶ Backend (Laravel)
   ▲                        │                                     (token, errores)
   └──── eventos ───────────┘
```

1. **La pantalla** muestra lo que hay en los signals del store y le avisa de las acciones del usuario.
2. **El store** tiene la lógica: qué pedir, cuándo repetir, qué hacer ante un error.
3. **La API** es la única que conoce la forma de las respuestas del backend (`{ success, ... }`) y las convierte en
   modelos tipados para el resto de la app.
4. **Los interceptores** agregan el token JWT a cada petición a nuestra API y convierten cualquier error HTTP en un
   `ApiError` con mensaje en español. Un 401 con token cierra la sesión. Los errores 422 se pintan debajo de cada
   campo del formulario.

### Ejemplo completo: el pasajero pide un viaje

1. Al abrir, el GPS (Capacitor Geolocation) da la posición; Nominatim la convierte en dirección para el origen.
2. El pasajero escribe el destino: tras 600 ms sin teclear se consulta Nominatim, limitado a ~30 km alrededor.
3. Con origen y destino, OSRM devuelve la ruta por las calles y el mapa la dibuja.
4. "Ver tarifa" → `POST /client/estimate-fare` → distancia, tiempo, tarifa y su desglose.
5. "Solicitar viaje" → `POST /client/ride-requests`. La solicitud se guarda en el teléfono.
6. Cada 5 s se consulta `GET /client/active`. Cuando un conductor acepta, aparece su nombre, placa, calificación y
   posición en el mapa. Si nadie acepta en 2 minutos, la app cancela la solicitud.
7. Mientras tanto, el conductor envía su GPS cada 5 s a `POST /driver/location`, y el pasajero lo ve moverse.
8. El conductor avanza: llegué (`/arrive`), iniciar (`/start`), finalizar (`/complete` con la distancia y el tiempo
   medidos por GPS). El backend calcula la tarifa final.
9. Cuando `/client/active` deja de mostrar el viaje, la app busca su tarifa final en `/client/trips`, muestra el
   resumen y abre la calificación (`POST /client/trips/{id}/rating`).

### Tiempo real sin WebSocket

El backend no tiene WebSocket ni notificaciones, así que usamos **consulta periódica (polling)**:

- Cada **5 segundos** se consulta el estado (pasajero: viaje activo; conductor: solicitudes cercanas).
- Con **`exhaustMap`** no se lanza una consulta nueva mientras la anterior no termina.
- Se **pausa** cuando la app pasa a segundo plano (evento `visibilitychange`) para ahorrar batería y datos.
- El GPS del conductor se envía con **throttle** de 5 s: como máximo una posición cada 5 s, sin perder la última.

---

## 5. Persistencia de datos

**La fuente de verdad es la base de datos PostgreSQL del backend.** El frontend no tiene base de datos propia: solo
guarda en el dispositivo lo mínimo para (a) mantener la sesión y (b) cubrir datos que el backend no permite consultar.

| Qué se guarda                                                                                  | Dónde                                                                    | Clave                          | Por qué                                                                                                               | Cuándo se borra                                                        |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Sesión: token JWT, vencimiento y usuario                                                       | Web: `sessionStorage` (una por pestaña). Teléfono: Capacitor Preferences | `feeddrive.session`            | No pedir login en cada recarga. En la web, cada pestaña tiene su sesión (pasajero en una, conductor en otra).         | Al cerrar sesión, al vencer el token o si el backend lo rechaza (401). |
| Solicitud activa del pasajero                                                                  | Capacitor Preferences, por usuario                                       | `feeddrive.activeRide.<id>`    | `/client/active` no devuelve origen ni destino del viaje asignado; sin esto no se podría dibujar la ruta al recargar. | Al terminar o cancelar el viaje.                                       |
| Estado del conductor: en línea, viaje asignado, su estado, rastro GPS y solicitudes rechazadas | Capacitor Preferences, por conductor                                     | `feeddrive.driverSession.<id>` | No hay endpoint para consultar el viaje activo del conductor ni su disponibilidad; así se retoma si la app se cierra. | Al finalizar el viaje; "en línea" se apaga al cerrar sesión.           |
| Viajes ya calificados                                                                          | Capacitor Preferences                                                    | `feeddrive.ratedTrips`         | La documentación del historial no incluye la calificación; evita ofrecer calificar dos veces.                         | No se borra (son solo ids de viajes).                                  |
| Rutas calculadas                                                                               | Memoria (últimas 30)                                                     | —                              | No repetir consultas a OSRM.                                                                                          | Al cerrar la app.                                                      |

Notas para la sustentación:

- **Capacitor Preferences** guarda en el almacenamiento nativo del teléfono (SharedPreferences en Android) y, en la web,
  en `localStorage`. Es almacenamiento clave-valor, no una base de datos.
- **No guardamos contraseñas.** Solo el token JWT, que vence en 1 hora (la app avisa 2 minutos antes).
- Los datos guardados **por usuario** evitan que dos cuentas en el mismo dispositivo o navegador se mezclen.

---

## 6. Autenticación y seguridad

- **JWT:** el login (`POST /auth/login`, con correo o teléfono) devuelve un token que dura 1 hora. El interceptor lo
  envía como `Authorization: Bearer ...` **solo** a nuestra API (nunca a Nominatim, OSRM ni las teselas).
- **Guards:** `authGuard` (hay sesión), `roleGuard` (rol correcto) y `guestGuard` (el login no se abre con sesión).
- **Vencimiento:** aviso 2 minutos antes; al vencer o con un 401, se cierra la sesión y se vuelve al login.
- **Cerrar sesión:** primero se ejecutan las tareas pendientes mientras el token aún sirve (por ejemplo, desconectar al
  conductor) y luego se invalida el token en el backend (`POST /auth/logout`).
- **Riesgos que informamos (del backend):** "olvidé mi contraseña" cambia la clave solo con el correo, y la API usa
  HTTP sin cifrar (por eso la app Android permite tráfico HTTP: `cleartext: true`).

---

## 7. Mapa y geolocalización

| Pieza                    | Tecnología                         | Cómo funciona                                                                                                                                                      |
| ------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mapa base                | Leaflet + teselas de OpenStreetMap | Leaflet pinta imágenes (teselas) de OpenStreetMap. Filtros CSS les dan el estilo verde claro u oscuro de la marca.                                                 |
| Marcadores               | Leaflet `divIcon`                  | Marcadores propios: pasajero (punto con pulso), origen, destino y conductor (flecha que gira con su rumbo).                                                        |
| Movimiento del conductor | `requestAnimationFrame`            | Entre una posición y la siguiente, el marcador se desliza en 1,2 s en lugar de saltar. Respeta "reducir movimiento".                                               |
| Buscar direcciones       | Nominatim                          | Búsqueda limitada a Colombia y a ~30 km del usuario, en español. También convierte un punto en dirección.                                                          |
| Ruta                     | OSRM                               | Ruta por las calles con distancia y tiempo. Mientras llega (o si falla) se ve una línea punteada directa. Las rutas se recuerdan para no repetir consultas.        |
| Posición del usuario     | Capacitor Geolocation              | `getCurrentPosition` para ubicarse; en el conductor, `watchPosition` sigue el GPS continuamente. Si se niega el permiso, el mapa se centra en Bogotá con un aviso. |
| Tiempo de llegada        | Cálculo propio                     | Distancia en línea recta (fórmula de Haversine) × 1,3 por las calles, a 22 km/h de velocidad urbana.                                                               |
| Distancia real del viaje | Rastro GPS                         | Suma los tramos del recorrido; ignora movimientos menores a 8 m (ruido del GPS quieto) y saltos de más de 150 km/h (lecturas erróneas).                            |
| Navegación del conductor | Google Maps                        | El botón "Navegar" abre Google Maps con el destino.                                                                                                                |

---

## 8. La app Android

- **Capacitor** copia la web compilada (`www/`) dentro de un proyecto Android y la ejecuta en un WebView.
- `npm run apk` compila todo y deja el APK en `dist/` (por defecto apunta al servidor del profesor).
- Permisos de ubicación declarados en `AndroidManifest.xml`; se piden al usuario en el momento de usarlos.
- **Botón atrás de Android:** primero cierra menús y modales, luego vuelve a la pantalla anterior; si ya no hay a dónde
  volver, regresa al inicio del rol o minimiza la app.
- Ícono adaptativo y pantalla de inicio en claro y oscuro, generados con `@capacitor/assets`.
- Vibración al aceptar un viaje, al llegar una solicitud nueva y ante errores.

---

## 9. Calidad

| Qué                                                           | Cifra                                     |
| ------------------------------------------------------------- | ----------------------------------------- |
| Pruebas unitarias (Vitest)                                    | 180                                       |
| Pruebas de extremo a extremo (Playwright, móvil y escritorio) | 106                                       |
| Cobertura de código                                           | ~90 %                                     |
| Auditoría de accesibilidad (axe, WCAG 2.1 AA)                 | Sin infracciones graves en los tres roles |

- Las E2E usan la app real contra el backend simulado y cubren, entre otros, un viaje completo con pasajero y
  conductor en dos sesiones a la vez, dos conductores compitiendo por la misma solicitud (409), sesiones distintas en
  dos pestañas y la auditoría de accesibilidad.
- **Antes de cada commit** se ejecutan ESLint y Prettier (Husky + lint-staged) y se valida el mensaje del commit
  (commitlint, formato convencional: `feat:`, `fix:`, `chore:`...).
- **Flujo de Git:** una rama por funcionalidad que se fusiona a `main`.

---

## 10. Backend simulado

El servidor del profesor no siempre está encendido ni es accesible fuera de la universidad, y no teníamos usuarios de
prueba de administrador ni de conductor. Por eso construimos `mock-api/server.mjs`: un servidor en Node.js que
reproduce **las mismas rutas, respuestas y códigos de error** de la documentación (400, 401, 403, 404, 409, 422), con
usuarios de prueba de los tres roles y un modo autopiloto en el que un conductor simulado hace un viaje completo.

La app cambia de backend con una **configuración de Angular**, sin tocar código:

| Comando               | Backend                                                                               |
| --------------------- | ------------------------------------------------------------------------------------- |
| `npm start`           | Servidor del profesor                                                                 |
| `npm run start:mock`  | Backend simulado                                                                      |
| `npm run apk`         | APK con el servidor del profesor                                                      |
| `npm run apk -- mock` | APK con el backend simulado                                                           |
| `npm run check:real`  | Revisa (solo lectura) que el servidor del profesor responda y tenga la forma esperada |

---

## 11. Diferencias con el backend y cómo las resolvimos

| Brecha del backend                                              | Solución en el frontend                                          |
| --------------------------------------------------------------- | ---------------------------------------------------------------- |
| No hay WebSocket                                                | Consulta cada 5 s, en pausa en segundo plano.                    |
| No hay endpoint para rechazar una solicitud                     | "Rechazar" la oculta solo en el teléfono del conductor.          |
| No se puede consultar el viaje activo del conductor             | Se guarda en el teléfono con su estado y rastro GPS.             |
| `/client/active` no trae origen ni destino                      | Se guarda la solicitud en el teléfono.                           |
| Las solicitudes nunca vencen                                    | La app cancela a los 2 minutos sin conductor.                    |
| `/auth/me` no trae el perfil del conductor                      | La aprobación se averigua con el 403 de `/driver/ride-requests`. |
| No hay pagos                                                    | Resumen con la tarifa definitiva y pago en efectivo.             |
| El conductor no puede calificar al pasajero                     | Fuera de esta versión.                                           |
| La tarifa estimada usa línea recta; la final, el recorrido real | Se muestra la distancia por carretera y se advierte.             |

La lista completa (21 brechas) está en [BRECHAS_BACKEND.md](BRECHAS_BACKEND.md).

---

## 12. Preguntas probables y respuestas cortas

**¿Por qué no usaron WebSocket para el tiempo real?**
Porque el backend no lo ofrece y no podemos modificarlo. Usamos consulta cada 5 s con `exhaustMap` y la pausamos en
segundo plano.

**¿Dónde se guardan los datos?**
En la base de datos PostgreSQL del backend. En el dispositivo solo guardamos la sesión (JWT) y lo que el backend no
permite consultar (viaje activo, estado del conductor), con Capacitor Preferences o `sessionStorage`.

**¿Cómo protegen las rutas por rol?**
Con guards de Angular: sin sesión se va al login; con otro rol se muestra "acceso denegado". El backend además valida
el rol en cada endpoint.

**¿Qué pasa si el token vence?**
La app avisa 2 minutos antes; al vencer o si el backend responde 401, cierra la sesión y vuelve al login.

**¿Cómo se calcula la ruta?**
Con OSRM sobre datos de OpenStreetMap. Si no responde en 8 s, se muestra una línea punteada directa y se puede seguir.

**¿Cómo saben cuánto recorrió el conductor?**
Sumando los tramos del GPS durante el viaje, sin ruido ni saltos imposibles. Esa distancia y el tiempo se envían a
`/complete` y el backend calcula la tarifa final.

**¿Qué pasa si dos conductores aceptan el mismo viaje?**
El backend usa una transacción con bloqueo; el segundo recibe 409 y la app marca la tarjeta "Otro conductor tomó este
viaje" y la quita.

**¿Cómo funciona en el teléfono?**
Capacitor ejecuta la misma app web dentro de Android y le da acceso al GPS, almacenamiento, vibración y botón atrás.

**¿Cómo pueden tener dos sesiones en el mismo navegador?**
En la web la sesión vive en `sessionStorage`, que es propio de cada pestaña.

**¿Cómo probaron sin el servidor del profesor?**
Con un backend simulado que reproduce la documentación de la API, y 286 pruebas automáticas.

**¿Por qué Signals y no solo RxJS?**
Signals para el estado que se muestra (simple y sin suscripciones manuales); RxJS para lo que es un flujo en el tiempo
(consultas periódicas, búsqueda con espera, cancelación).

---

## 13. Glosario

| Término         | Significado                                                                            |
| --------------- | -------------------------------------------------------------------------------------- |
| JWT             | Token firmado que identifica al usuario en cada petición.                              |
| Interceptor     | Código que se ejecuta en todas las peticiones HTTP (agrega el token, traduce errores). |
| Guard           | Regla que decide si se puede abrir una ruta.                                           |
| Store           | Servicio que guarda el estado de un área con signals y contiene su lógica.             |
| Signal          | Valor reactivo de Angular: al cambiar, la vista se actualiza.                          |
| Polling         | Consultar el servidor cada cierto tiempo para ver si algo cambió.                      |
| Throttle        | Limitar cuántas veces se ejecuta algo en un intervalo.                                 |
| Tesela          | Imagen cuadrada de un pedazo del mapa.                                                 |
| Geocodificación | Convertir una dirección en coordenadas (y al revés).                                   |
| Haversine       | Fórmula de la distancia entre dos coordenadas sobre la Tierra.                         |
| CORS            | Regla del navegador que decide si una página puede llamar a una API de otro dominio.   |
| Capacitor       | Puente entre la app web y las funciones nativas del teléfono.                          |
