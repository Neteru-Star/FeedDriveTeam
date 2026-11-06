# Changelog

## Fase 4: Tarifa y solicitud del viaje (HU-03)

- Tarifa estimada (`POST /client/estimate-fare`) con distancia, tiempo y precio, desglose en barras que siempre suma la tarifa oficial y chip de alta demanda según `GET /fares/active`.
- Error de estimación con reintento; la tarifa se recalcula si cambia la ruta.
- Solicitud del viaje (`POST /client/ride-requests`) y espera del conductor con consulta de `GET /client/active` cada 5 s, pausada en segundo plano.
- Límite de 2 minutos: la solicitud se cancela y se ofrece reintentar; si un conductor acepta en el último segundo, se conserva el viaje.
- El 400 de "ya tienes un viaje activo" abre ese viaje; la solicitud en curso se retoma al reabrir la app.
- Tarjeta del conductor asignado con calificación, vehículo, placa y posición en el mapa.
- Pipes `currencyCop`, `distanceKm` y `duration`; los montos ya no muestran centavos.
- Pruebas: stores con reloj simulado (secuencia de estados, límite, carrera al cancelar, 400 y 422), API del pasajero y E2E con conductores reales aceptando la solicitud.

## Fase 3: Estructura por rol y mapa (HU-02)

- Estructura de cada rol con menú lateral: pasajero y conductor con el mapa a pantalla completa; administrador con el menú fijo en escritorio (`ion-split-pane`) y secciones de las Fases 9 y 10 como estados vacíos.
- Componente de mapa reutilizable con Leaflet y teselas de OpenStreetMap, con estilo propio claro y oscuro, marcadores de usuario, origen, destino y conductor con rumbo, y ruta curva con pulso.
- Ubicación con Capacitor Geolocation; sin permiso, el mapa se centra en Bogotá con un aviso para activarla. Permisos de ubicación en Android.
- HU-02: origen tomado del GPS con su dirección, búsqueda de origen y destino con Nominatim (`Geocoder` intercambiable), elección tocando el mapa y validación de origen igual al destino.
- Pantalla de cuenta para los tres roles y sección "Mis viajes" del pasajero.
- La sesión navega con `NavController.navigateRoot`: al entrar o salir no quedan pantallas del rol anterior vivas.
- Pruebas: utilidades geográficas, mapa, ubicación, geocodificador, borrador del viaje y E2E de la HU-02 y de la navegación por rol.

## Fase 2: API y autenticación (HU-01)

- Sesión JWT con signals, guardada con Capacitor Preferences; aviso 2 minutos antes de vencer y cierre limpio ante un 401.
- Interceptores de token y de errores (`ApiError`), con los 422 asignados a cada campo del formulario.
- Inicio de sesión con correo o teléfono, registro de pasajero y de conductor en dos pasos, y recuperación de contraseña.
- Guards por rol, página de acceso denegado y página 404.
- E2E contra el backend simulado: login con cada rol, recarga, token inválido y registro.

## Backend simulado

- `mock-api/server.mjs` reproduce los endpoints de la API del curso, con usuarios de prueba de los tres roles y un modo autopiloto.
- Configuración `mock` de Angular (`npm run start:mock`) y prueba de humo (`npm run mock:test`).

## Fase 1: Sistema de diseño

- Dirección visual "Ruta Viva": colores claro y oscuro, tipografías locales y formato de moneda colombiano.
- Componentes base: tarjeta de vidrio, estado del viaje, placa, calificación, tarifa, ruta, campo de texto, contraseña, avisos, hoja inferior, estado vacío y carga.
- Página `/design-system` (solo en desarrollo).

## Fase 0: Cimientos del proyecto

- Proyecto base con Angular 22, Ionic 9 y Capacitor 8, en TypeScript strict con `strictTemplates`.
- Estructura de carpetas por features, alias de rutas y configuración por entorno.
- ESLint, Prettier, Husky, lint-staged y commitlint.
- Pruebas unitarias con Vitest y Angular Testing Library, y E2E con Playwright en móvil y escritorio.
- Plataforma Android con Capacitor; el APK de depuración compila con el JDK 21.
