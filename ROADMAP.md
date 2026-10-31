# Roadmap

## Plan por fases

| Fase | Nombre                                  | Estado                                       |
| ---- | --------------------------------------- | -------------------------------------------- |
| 0    | Cimientos del proyecto                  | En curso: web lista, falta verificar Android |
| 1    | Sistema de diseño                       | Pendiente                                    |
| 2    | Capa de API y autenticación             | Pendiente                                    |
| 3    | Shell de la aplicación y mapa           | Pendiente                                    |
| 4    | Cliente: estimar y solicitar viaje      | Pendiente                                    |
| 5    | Cliente: viaje activo en tiempo real    | Pendiente                                    |
| 6    | Cliente: historial y calificación       | Pendiente                                    |
| 7    | Conductor: disponibilidad y solicitudes | Pendiente                                    |
| 8    | Conductor: ejecución del viaje          | Pendiente                                    |
| 9    | Admin: dashboard, conductores y tarifas | Pendiente                                    |
| 10   | Admin: viajes, reportes y auditoría     | Pendiente                                    |
| 11   | Pulido y calidad                        | Pendiente                                    |
| 12   | Cierre                                  | Pendiente                                    |

## Backlog de features

- Notificaciones push o sonido al recibir una solicitud (conductor)
- Seguimiento GPS en segundo plano para el conductor
- Lugares favoritos en el cliente
- Compartir viaje en curso con un enlace
- Internacionalización EN

## Fixes pendientes

- Compilar el APK: Gradle necesita un JDK 21 instalado.
- Instalar una imagen de sistema para el emulador: los AVD apuntan a `android-35`, que no está en el SDK.
- Conseguir las credenciales de administrador: sin ellas ningún conductor puede aprobarse.
