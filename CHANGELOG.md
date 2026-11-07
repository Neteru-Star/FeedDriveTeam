# Changelog

## Fases 9 y 10: Panel del administrador (HU-09)

- Dashboard con indicadores (ingresos, viajes activos y cancelados, pasajeros, conductores y por aprobar), viajes recientes e incidencias; cada indicador lleva a su listado filtrado.
- Conductores filtrados por estado (en la URL), con aprobar, suspender (pide el motivo), rechazar y reactivar con notas y confirmación.
- Tarifas: listado y creación con validación y vista previa del cálculo para tres viajes de ejemplo frente a la tarifa activa.
- Viajes con filtros de estado, fecha, conductor y pasajero sincronizados con la URL, y paginación.
- Reportes con ingresos, tasa de cancelación, cancelaciones por motivo e ingresos por conductor en barras, y tabla de desempeño.
- Auditoría cronológica con búsqueda sin tildes ni mayúsculas y carga de registros anteriores.
- Adaptadores tolerantes a respuestas no documentadas (páginas de Laravel o listas, secciones faltantes).
- `npm run apk` compila el APK contra el backend simulado del computador, otra IP o el real.
- Pruebas: adaptadores y cálculo de tarifas; E2E del dashboard, aprobar un conductor que luego se conecta, suspender con motivo, crear una tarifa, filtros en la URL y búsqueda en la auditoría.

## Fase 8: Ejecución del viaje por el conductor (HU-05)

- Panel del viaje guiado por `trip-status.ts`: "Llegué al punto" (`/arrive`), "Iniciar viaje" (`/start`) y "Finalizar viaje" (`/complete`, con confirmación), con línea de tiempo, distancia y tiempo hasta el punto, llamada al pasajero y enlace de navegación en Google Maps.
- Distancia y duración reales desde el rastro GPS (`trip-trail.ts`): ignora el ruido con el carro quieto y los saltos de más de 150 km/h; sin rastro útil reporta la distancia estimada y lo indica en el resumen.
- Resumen final con la tarifa definitiva, distancia y duración, y "Listo, seguir en línea".
- El viaje, su estado y el rastro se guardan en el teléfono y se retoman al recargar; si el pasajero canceló, el conductor lo ve al intentar avanzar y vuelve a estar en línea.
- Al cerrar sesión en línea, el conductor se desconecta antes de invalidar el token (`AuthStore.beforeLogout`) y no se reconecta solo al volver.
- El mapa del conductor encuadra su posición y el punto al que va en cada etapa.
- Pruebas: acumulador del rastro, store del viaje (flujo completo, cancelado por el pasajero, estado adelantado, errores), cierre de sesión y E2E con el pasajero y el conductor en dos sesiones del navegador al mismo tiempo. APK de depuración compilado.

## Fase 7: Disponibilidad y solicitudes del conductor (HU-04)

- Estado de la cuenta: `GET /driver/ride-requests` responde 403 con `approval_status` si no está aprobada; la pantalla muestra "en revisión", "rechazada" o "suspendida" y permite volver a consultar.
- Interruptor En línea / Fuera de línea (`PUT /driver/availability`); exige la ubicación y se recuerda en el teléfono por conductor.
- GPS continuo (`watchPosition` de Capacitor) enviado a `POST /driver/location` con throttle de 5 s, con rumbo, velocidad y viaje.
- Solicitudes cercanas consultadas cada 5 s (pausa en segundo plano), ordenadas por distancia de recogida, con ganancia, tiempo para recoger y puntos en el mapa encuadrados sobre el panel.
- Aceptar con vibración; el 409 marca la tarjeta "Otro conductor tomó este viaje" antes de quitarla. "Rechazar" la oculta en el teléfono.
- Aviso `aria-live` y vibración corta cuando llega una solicitud nueva; el viaje aceptado se retoma al recargar.
- Mapa: nuevo `focus` para encuadrar varios puntos sin saltar con cada posición; botón "Llamar" global (`.app-call`).
- Pruebas: store del conductor (403, 409, en línea, polling, rechazar, retomar), envío del GPS con throttle, seguimiento del GPS y E2E con dos conductores reales compitiendo por la misma solicitud.

## Fase 6: Historial y calificación (HU-08)

- "Mis viajes" con `GET /client/trips`: tarjetas con fecha, estado, ruta, conductor, placa y tarifa, deslizar para actualizar (`ion-refresher`) y scroll infinito (`ion-infinite-scroll`).
- Detalle del viaje con tarifa final, distancia y duración reales, conductor, motivo de cancelación y la calificación dada.
- Calificación (`POST /client/trips/{id}/rating`) con estrellas, comentario y reporte de incidente (que exige describirlo); se abre sola al completar un viaje y también desde el historial y el detalle.
- Un 400 de "ya fue calificado" deja de ofrecer calificar; las calificaciones enviadas se recuerdan en el teléfono porque la documentación del historial no las incluye.
- El título de cada pantalla se anuncia como encabezado; "1 estrella" en singular.
- Backend simulado: conexiones abiertas 65 s para evitar `ECONNRESET` en las pruebas.
- Pruebas: store del historial (páginas, vacío, errores, calificar, 400), componente de calificación, utilidades del viaje y E2E de calificar al terminar, desde el historial, dos veces y scroll infinito.

## Fase 5: Viaje activo en tiempo real (HU-06)

- Máquina de estados del viaje en `trip-status.ts`: textos del pasajero, mensajes, cancelación por rol, acción del conductor por estado y avances válidos.
- Línea de tiempo "Buscando conductor → Conductor asignado → Tu conductor llegó → En camino → Finalizado".
- Tiempo estimado de llegada del conductor al punto de partida y al destino, calculado desde su última posición.
- El marcador del conductor se desliza entre posiciones y gira hacia donde se mueve (sin animación si el sistema pide reducir movimiento).
- Botón "Llamar" con enlace `tel:` al conductor.
- Cancelación con motivo (`ion-action-sheet` y texto libre con `ion-alert`), solo antes de iniciar el recorrido; si el backend la rechaza se muestra el estado real.
- Resumen al terminar: tarifa final tomada del historial, o aviso de viaje cancelado.
- Anuncios `aria-live` solo al cambiar de estado; las respuestas atrasadas no devuelven el viaje a un estado anterior.
- Pruebas: máquina de estados, secuencia completa con reloj simulado, cancelación con 404 y 400, deslizamiento del marcador y E2E del viaje de punta a punta con un conductor real.

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
