# Roadmap

## Plan por fases

| Fase | Nombre                                     | Estado                                          |
| ---- | ------------------------------------------ | ----------------------------------------------- |
| 0    | Cimientos del proyecto                     | Lista: APK compila, falta abrir en dispositivo  |
| 1    | Sistema de diseño                          | Lista y aprobada                                |
| —    | Backend simulado (`mock-api/`)             | Listo: 40 verificaciones en `npm run mock:test` |
| 2    | Capa de API y autenticación (HU-01)        | Lista: 42 unitarias y 22 E2E                    |
| 3    | Shell de la aplicación y mapa (HU-02)      | Lista: 72 unitarias y 38 E2E                    |
| 4    | Cliente: estimar y solicitar viaje (HU-03) | Lista: 91 unitarias y 48 E2E                    |
| 5    | Cliente: viaje activo en tiempo real       | Lista: 109 unitarias y 54 E2E                   |
| 6    | Cliente: historial y calificación          | Lista: 125 unitarias y 62 E2E                   |
| 7    | Conductor: disponibilidad y solicitudes    | Lista: 143 unitarias y 70 E2E                   |
| 8    | Conductor: ejecución del viaje             | Lista: 158 unitarias y 78 E2E                   |
| 9    | Admin: dashboard, conductores y tarifas    | Lista                                           |
| 10   | Admin: viajes, reportes y auditoría        | Lista: 164 unitarias y 90 E2E                   |
| 11   | Pulido y calidad                           | Lista: axe sin infracciones graves              |
| 12   | Cierre                                     | Lista: `docs/`                                  |

## Backlog de features

- Notificaciones push o sonido al recibir una solicitud (conductor)
- Seguimiento GPS en segundo plano para el conductor
- Rutas por calles reales (OSRM u otro servicio) para el trazado y el tiempo estimado
- Lugares favoritos en el cliente
- Compartir viaje en curso con un enlace
- Internacionalización EN

## Fixes pendientes

- Instalar una imagen de sistema para el emulador: los AVD apuntan a `android-35`, que no está en el SDK.
- Conseguir las credenciales de administrador del backend real: sin ellas ningún conductor puede aprobarse. En el mock existen (`README.md`).
- La pantalla del conductor no muestra aún si su cuenta está pendiente de aprobación: el backend solo lo informa al cambiar la disponibilidad (403 con `approval_status`), así que se resuelve en la Fase 7.
- Nominatim y las teselas de OpenStreetMap son servicios comunitarios con límites de uso (1 búsqueda por segundo, uso moderado de teselas). Sirven para el curso; para publicar la app habría que usar un proveedor propio.

## Brechas del backend (resueltas en el frontend)

Lista final con la ubicación de cada solución: [docs/BRECHAS_BACKEND.md](docs/BRECHAS_BACKEND.md).

Detalle en la Tabla 12 de `UberTeam_Historias_y_Mockups_APA.docx`.

- Sin WebSocket: polling cada 5 s.
- Sin endpoint para rechazar solicitudes ni para consultar el viaje activo del conductor.
- Sin pagos (HU-07 simulado), sin calificación del conductor al pasajero (HU-08) y sin bloqueo de usuarios (HU-09 gestiona conductores).
- Sin `/admin/metrics`: el dashboard usa `/admin/dashboard`; los reportes, `/admin/reports`.
- La documentación no muestra la forma de `/admin/trips`, `/admin/reports` ni `/admin/audit-logs`: los adaptadores aceptan páginas de Laravel o listas y completan las secciones que falten.
- `forgot-password` cambia la clave solo con el correo: riesgo de seguridad a informar.
- El viaje asignado de `/client/active` no trae origen ni destino: la solicitud se guarda en el teléfono (`ActiveRideStorage`) para seguir dibujando la ruta.
- El backend no vence las solicitudes sin conductor: el frontend las cancela a los 2 minutos.
- `/client/active` no dice cómo terminó un viaje: al desaparecer se busca en `/client/trips` (estado y tarifa final); sin historial se deduce por el último estado.
- `POST /client/cancel/{id}` no aclara si el id es del viaje o de la solicitud: se usa el `id` de `/client/active` y, ante un 404, el de la solicitud.
- No hay tiempo estimado de llegada ni rutas: se calcula con Haversine × 1,3 a 22 km/h.
- `GET /client/trips` documenta solo `data` (sin metadatos de paginación ni calificación): la app usa `next_page_url` o `last_page` si llegan y, si no, pide páginas hasta recibir una vacía; las calificaciones enviadas se recuerdan en el teléfono.
- `/auth/me` no trae el perfil del conductor (placa, calificación, aprobación): la aprobación se averigua con `GET /driver/ride-requests`, que responde 403 con `approval_status` si la cuenta no está aprobada.
- No se puede consultar la disponibilidad del conductor: la app recuerda en el teléfono si estaba en línea (por conductor) y vuelve a conectarse al abrir.
- `GET /driver/ride-requests` no está filtrado por cercanía y su ejemplo no trae coordenadas: si llegan, la app calcula la distancia de recogida y ordena; si no, muestra la más reciente primero.
- Sin endpoint para rechazar: "Rechazar" oculta la solicitud en el teléfono (se recuerdan las últimas 50).
- Sin endpoint para consultar el viaje activo del conductor: el viaje, su estado y el rastro GPS se guardan en el teléfono. Si el pasajero cancela, el conductor se entera al intentar avanzar (400 con `current_status`).
- `complete` pide la distancia y la duración reales: se miden con el rastro GPS (sin ruido ni saltos imposibles); sin rastro útil se reporta la distancia estimada.
