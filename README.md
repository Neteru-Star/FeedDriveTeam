# FeedDrive

Frontend web y móvil de una plataforma de transporte, con roles de cliente, conductor y administrador. Consume la API REST en Laravel entregada para la materia Desarrollo de Apps.

## Stack

Angular 22, Ionic 9, Capacitor 8 y TypeScript strict. Pruebas con Vitest, Angular Testing Library y Playwright.

## Requisitos

- Node `^22.22.3` o `^24.15.0`
- Android Studio con Android SDK 36 y una imagen de emulador
- JDK 21 para compilar Android

## Web

```bash
npm install
npm start
```

La app abre en `http://localhost:8100`.

## Android

```bash
npm run build
npx cap sync android
npx cap open android
```

Gradle 8.14 exige un JDK 21 y no funciona con el JDK 25 de Android Studio. Selecciónalo en **Settings → Build Tools → Gradle → Gradle JDK**.

## API

La URL se configura en `apiBaseUrl`, dentro de `src/environments/environment.ts` y `environment.prod.ts`. Para otro servidor, cambia ese valor; en un dispositivo físico no se puede usar `localhost`.

La API va por HTTP, así que Capacitor usa `androidScheme: "http"` y `cleartext: true`. La web también debe servirse por `http`, porque un sitio `https` no puede llamarla.

### Backend simulado

`mock-api/server.mjs` reproduce los endpoints de `Backend Uber.md` con las mismas rutas, respuestas y códigos de error. No tiene dependencias y guarda los datos en memoria, así que al reiniciarlo vuelve a los datos de prueba.

```bash
npm run mock:api        # API en http://localhost:8000/api
npm run start:mock      # en otra terminal: la app apuntando al mock
```

Con `npm run mock:api:auto`, Carlos se vuelve un conductor automático: acepta cada solicitud a los 6 segundos, se mueve hasta el origen, inicia y completa el viaje en cerca de un minuto. Sirve para probar el flujo del pasajero sin otro teléfono.

| Rol                   | Usuario              | Contraseña     |
| --------------------- | -------------------- | -------------- |
| Administrador         | `admin@uber.com`     | `admin123`     |
| Cliente               | `cliente@uber.com`   | `cliente123`   |
| Cliente               | `maria@uber.com`     | `cliente123`   |
| Conductor aprobado    | `conductor@uber.com` | `conductor123` |
| Conductor sin aprobar | `andres@uber.com`    | `conductor123` |

`npm run mock:test` recorre los flujos de los tres roles contra el mock. `POST /api/__mock/reset` reinicia los datos; esa ruta no existe en el backend real.

## Scripts

| Comando                 | Uso                                |
| ----------------------- | ---------------------------------- |
| `npm start`             | Servidor de desarrollo             |
| `npm run start:mock`    | Servidor de desarrollo con el mock |
| `npm run mock:api`      | Backend simulado                   |
| `npm run mock:test`     | Prueba del backend simulado        |
| `npm run build`         | Build de producción en `www/`      |
| `npm run lint`          | ESLint, tipos de E2E y Prettier    |
| `npm test`              | Pruebas unitarias                  |
| `npm run test:coverage` | Pruebas unitarias con cobertura    |
| `npm run e2e`           | Pruebas E2E en móvil y escritorio  |

## Decisiones

- **Estado:** signals en servicios store por feature, sin NgRx SignalStore, porque cada feature tiene un flujo lineal y pocas entidades.
- **Sin `zone.js`:** es opcional en Ionic 9.
- **Imports de Ionic:** desde `@ionic/angular/<componente>`, porque `@ionic/angular/standalone` ya no existe en Ionic 9.
- **`OnPush`:** es el valor por defecto en Angular 22; ESLint prohíbe `Eager`.
