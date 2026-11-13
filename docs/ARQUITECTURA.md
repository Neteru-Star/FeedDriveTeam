# Arquitectura de FeedDrive

Frontend en Angular 22 (componentes standalone, signals, zoneless) con Ionic 9 y Capacitor 8. Consume la API REST
del curso (Laravel + JWT) sin modificarla; las diferencias se resuelven en el frontend (ver
[BRECHAS_BACKEND.md](BRECHAS_BACKEND.md)).

## Capas

```
src/app/
├── core/        Servicios únicos de la app: sesión (auth), HTTP, configuración, ubicación, geocodificador, tema
│                y dispositivo (vibración, botón atrás de Android).
├── layout/      Estructura por rol: menú lateral, página con mapa y hoja inferior, encabezado de las pantallas.
├── shared/      Lo reutilizable sin estado de negocio: componentes de UI ("Ruta Viva"), pipes de formato,
│                validadores, utilidades geográficas y la máquina de estados del viaje (models/trip-status.ts).
└── features/    Una carpeta por área: auth, client (pasajero), driver (conductor), admin, account y errors.
    └── <feature>/
        ├── <feature>.routes.ts   Rutas perezosas del rol y los stores que viven mientras dura la sesión.
        ├── data-access/          API (adapta las respuestas a modelos), modelos y stores con signals.
        ├── components/           Piezas de pantalla del área (presentación, sin llamadas HTTP).
        └── pages/                Pantallas enrutadas: componen componentes y leen los stores.
```

Reglas:

- **Las pantallas no llaman HTTP.** Usan un store (`*.store.ts`) o, en pantallas simples de consulta, la API del
  área. La API es el único lugar que conoce la forma de las respuestas del backend.
- **Los estados del viaje se leen de `shared/models/trip-status.ts`** (textos, tonos, acciones por rol y siguiente
  paso). Nunca se comparan estados sueltos en los templates.
- **Los stores de cada rol se proveen en sus rutas**, no en `root`: al cerrar sesión se destruyen y otro usuario no
  hereda datos.
- **La sesión es una por pestaña en la web** (`sessionStorage`) y única en el teléfono (Capacitor Preferences):
  se pueden abrir el pasajero y el conductor en dos pestañas del mismo navegador.
- **Lo que el backend no permite consultar se guarda con Capacitor Preferences, por usuario** (solicitud activa del pasajero,
  viaje y rastro GPS del conductor, si estaba en línea, viajes calificados).
- **Tiempo real por consulta periódica** (cada 5 s, en pausa con la app en segundo plano): RxJS `timer` +
  `exhaustMap` dentro de los stores.

## Flujo de datos

```
Página ──lee signals──▶ Store ──llama──▶ Api ──HttpClient──▶ Interceptores (token, errores) ──▶ Backend
   ▲                       │
   └──── eventos (output) ─┘  Los componentes emiten; la página decide qué método del store llamar.
```

Los errores HTTP se convierten en `ApiError` (`core/http/api-error.ts`) con el mensaje en español y los errores de
cada campo (422), que `applyServerErrors` asigna al formulario. Un 401 con token cierra la sesión.

## Cómo añadir una feature

1. **Ruta:** crea `features/<area>/pages/<nombre>.page.ts` y agrégala con `loadComponent` en
   `<area>.routes.ts`. Si va en el menú, añade el ítem en `ShellData.items` y su ícono en `layout/icons.ts`.
2. **Datos:** agrega el método a `data-access/<area>.api.ts` con su modelo en `<area>.models.ts`. Adapta la
   respuesta (`map`) para que el resto de la app no dependa del formato `{ success, ... }`.
3. **Estado:** si la pantalla tiene lógica (consultas periódicas, reintentos, caché), crea un store con signals en
   `data-access/` y provéelo en las rutas del área.
4. **UI:** reutiliza `shared/ui` (tarjetas, estado vacío, placas, estrellas, línea de tiempo…). Los estilos de cada
   componente tienen un presupuesto de 2 kB; lo compartido va en `src/theme/`.
5. **Pruebas:** unitarias del store y la API con Vitest (`*.spec.ts` junto al archivo; fakes con funciones normales
   y `vi.useFakeTimers()` para consultas periódicas) y una E2E con Playwright en `e2e/` contra el backend simulado.
6. **Calidad:** `npm run lint`, `npm run build`, `npm test` y `npx playwright test` deben pasar sin advertencias.

## Pruebas

| Tipo                                   | Herramienta              | Dónde               |
| -------------------------------------- | ------------------------ | ------------------- |
| Unitarias y de componentes             | Vitest + Testing Library | `src/**/*.spec.ts`  |
| Extremo a extremo (móvil y escritorio) | Playwright               | `e2e/*.spec.ts`     |
| Accesibilidad (WCAG 2.1 AA)            | axe-core en Playwright   | `e2e/a11y.spec.ts`  |
| Backend simulado                       | Script de humo           | `npm run mock:test` |

Las E2E levantan el backend simulado (`mock-api/server.mjs`) y la app en modo `mock`; cada prueba crea sus propios
usuarios, así que corren en paralelo sin interferirse.
