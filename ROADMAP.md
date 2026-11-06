# Roadmap

## Plan por fases

| Fase | Nombre                                  | Estado                                          |
| ---- | --------------------------------------- | ----------------------------------------------- |
| 0    | Cimientos del proyecto                  | Lista: APK compila, falta abrir en dispositivo  |
| 1    | Sistema de diseño                       | Lista: falta el visto bueno de diseño           |
| —    | Backend simulado (`mock-api/`)          | Listo: 40 verificaciones en `npm run mock:test` |
| 2    | Capa de API y autenticación             | Siguiente                                       |
| 3    | Shell de la aplicación y mapa           | Pendiente                                       |
| 4    | Cliente: estimar y solicitar viaje      | Pendiente                                       |
| 5    | Cliente: viaje activo en tiempo real    | Pendiente                                       |
| 6    | Cliente: historial y calificación       | Pendiente                                       |
| 7    | Conductor: disponibilidad y solicitudes | Pendiente                                       |
| 8    | Conductor: ejecución del viaje          | Pendiente                                       |
| 9    | Admin: dashboard, conductores y tarifas | Pendiente                                       |
| 10   | Admin: viajes, reportes y auditoría     | Pendiente                                       |
| 11   | Pulido y calidad                        | Pendiente                                       |
| 12   | Cierre                                  | Pendiente                                       |

## Backlog de features

- Notificaciones push o sonido al recibir una solicitud (conductor)
- Seguimiento GPS en segundo plano para el conductor
- Lugares favoritos en el cliente
- Compartir viaje en curso con un enlace
- Internacionalización EN

## Fixes pendientes

- Instalar una imagen de sistema para el emulador: los AVD apuntan a `android-35`, que no está en el SDK.
- Conseguir las credenciales de administrador del backend real: sin ellas ningún conductor puede aprobarse. En el mock existen (`README.md`).
- `Validators.email` de Angular acepta correos sin dominio (`laura@correo`): usar un patrón más estricto en el registro (Fase 2).

## Brechas del backend (resueltas en el frontend)

Detalle en la Tabla 12 de `UberTeam_Historias_y_Mockups_APA.docx`.

- Sin WebSocket: polling cada 5 s.
- Sin endpoint para rechazar solicitudes ni para consultar el viaje activo del conductor.
- Sin pagos (HU-07 simulado), sin calificación del conductor al pasajero (HU-08) y sin bloqueo de usuarios (HU-09 gestiona conductores).
- Sin `/admin/metrics`: el dashboard usa `/admin/dashboard` y `/admin/trips`.
- `forgot-password` cambia la clave solo con el correo: riesgo de seguridad a informar.
