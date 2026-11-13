# Guía de despliegue

## Configuraciones

| Configuración                  | Backend                                               | Uso                                          |
| ------------------------------ | ----------------------------------------------------- | -------------------------------------------- |
| `development` (`npm start`)    | `environment.ts`                                      | Desarrollo contra el servidor del profesor   |
| `mock` (`npm run start:mock`)  | `http://localhost:8000/api`                           | Desarrollo y pruebas con el backend simulado |
| `production` (`npm run build`) | `environment.prod.ts` (`http://20.20.2.171:8000/api`) | Web y APK finales                            |
| `device` (`npm run apk`)       | La URL que se pasa al compilar                        | APK de prueba en un celular                  |

Si cambia la dirección del backend real, edita `src/environments/environment.prod.ts`.

## Antes de usar el servidor del profesor

Desde la red de la universidad (el servidor `20.20.2.171` solo es accesible ahí):

```bash
npm run check:real                                  # responde y CORS deja entrar a la web y al APK
npm run check:real -- cliente@uber.com cliente123   # además revisa las rutas del rol de esa cuenta
```

Solo consulta: no crea ni modifica datos, y cierra la sesión de prueba que abre. Si todo sale ✅, `npm start` y el APK
de `npm run apk` funcionan con ese servidor.

## Web

```bash
npm ci
npm run build          # genera www/ con la configuración de producción
```

`www/` es una aplicación de una sola página: cualquier servidor estático sirve, siempre que todas las rutas
devuelvan `index.html` (por ejemplo, en Nginx `try_files $uri $uri/ /index.html;`). La API se consume por HTTP, así
que la web debe servirse también por HTTP o el navegador bloqueará las peticiones como contenido mixto.

## Android (APK)

Requisitos: Android SDK y **JDK 21** (Gradle 8.14 no funciona con el JDK 25 de Android Studio).

```bash
npm run apk                      # backend del profesor
npm run apk -- mock              # backend simulado en este computador (IP del Wi-Fi)
npm run apk -- mock 192.168.1.20 # backend simulado en otra IP
```

El script compila la web, sincroniza Capacitor (`npx cap sync android`), ejecuta `gradlew assembleDebug` y deja el
APK en `dist/FeedDrive-<destino>.apk`. Para instalarlo, cópialo al teléfono y permite "instalar apps de origen
desconocido".

- La app usa HTTP sin cifrar (`androidScheme: 'http'` y `cleartext: true` en `capacitor.config.ts`) porque la API
  del curso no tiene HTTPS.
- Con el backend simulado, el teléfono y el computador deben estar en la misma red y `npm run mock:api` debe estar
  corriendo. Si la red no permite que los dispositivos se vean (redes de campus), usa el hotspot del celular.
- Ícono y splash: las fuentes están en `assets/`; para regenerarlos ejecuta
  `npx @capacitor/assets generate --android --iconBackgroundColor "#0f1a14" --splashBackgroundColor "#f5f7f2" --splashBackgroundColorDark "#0b120e"`.
- Para publicar en Play Store haría falta un APK/AAB firmado (`gradlew bundleRelease` con un keystore) y una API
  con HTTPS.

## Verificación antes de entregar

```bash
npm run lint
npm run build
npm test -- --watch=false
npx playwright test     # levanta el backend simulado y la app en modo mock
npm run mock:test
```
