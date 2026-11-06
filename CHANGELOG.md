# Changelog

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
