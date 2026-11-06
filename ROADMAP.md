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
| 6    | Cliente: historial y calificación          | Siguiente                                       |
| 7    | Conductor: disponibilidad y solicitudes    | Pendiente                                       |
| 8    | Conductor: ejecución del viaje             | Pendiente                                       |
| 9    | Admin: dashboard, conductores y tarifas    | Pendiente                                       |
| 10   | Admin: viajes, reportes y auditoría        | Pendiente                                       |
| 11   | Pulido y calidad                           | Pendiente                                       |
| 12   | Cierre                                     | Pendiente                                       |

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

Detalle en la Tabla 12 de `UberTeam_Historias_y_Mockups_APA.docx`.

- Sin WebSocket: polling cada 5 s.
- Sin endpoint para rechazar solicitudes ni para consultar el viaje activo del conductor.
- Sin pagos (HU-07 simulado), sin calificación del conductor al pasajero (HU-08) y sin bloqueo de usuarios (HU-09 gestiona conductores).
- Sin `/admin/metrics`: el dashboard usa `/admin/dashboard` y `/admin/trips`.
- `forgot-password` cambia la clave solo con el correo: riesgo de seguridad a informar.
- El viaje asignado de `/client/active` no trae origen ni destino: la solicitud se guarda en el teléfono (`ActiveRideStorage`) para seguir dibujando la ruta.
- El backend no vence las solicitudes sin conductor: el frontend las cancela a los 2 minutos.
- `/client/active` no dice cómo terminó un viaje: al desaparecer se busca en `/client/trips` (estado y tarifa final); sin historial se deduce por el último estado.
- `POST /client/cancel/{id}` no aclara si el id es del viaje o de la solicitud: se usa el `id` de `/client/active` y, ante un 404, el de la solicitud.
- No hay tiempo estimado de llegada ni rutas: se calcula con Haversine × 1,3 a 22 km/h.
- `/auth/me` no trae el perfil del conductor (placa, calificación, aprobación): la tarjeta del conductor muestra solo su nombre por ahora.
