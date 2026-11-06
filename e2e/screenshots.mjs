// Capturas de la app para la documentación. Requiere `npm start` corriendo en el puerto 8100.
// Uso: node e2e/screenshots.mjs <carpeta-de-salida>
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'test-results/screenshots';
mkdirSync(out, { recursive: true });
const BASE = 'http://localhost:8100';

const shots = [
  { name: 'home-light', path: '/home', scheme: 'light', viewport: { width: 390, height: 844 } },
  { name: 'home-dark', path: '/home', scheme: 'dark', viewport: { width: 390, height: 844 } },
  { name: 'ds-mobile-light', path: '/design-system', scheme: 'light', viewport: { width: 390, height: 844 } },
  { name: 'ds-mobile-dark', path: '/design-system', scheme: 'dark', viewport: { width: 390, height: 844 } },
  {
    name: 'ds-desktop-light',
    path: '/design-system',
    scheme: 'light',
    viewport: { width: 1280, height: 800 },
    fullPage: true,
  },
  {
    name: 'ds-desktop-dark',
    path: '/design-system',
    scheme: 'dark',
    viewport: { width: 1280, height: 800 },
    fullPage: true,
  },
];

const browser = await chromium.launch();
for (const shot of shots) {
  const page = await browser.newPage({ viewport: shot.viewport, colorScheme: shot.scheme, deviceScaleFactor: 2 });
  await page.goto(BASE + shot.path, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  if (shot.fullPage) {
    // ion-content hace scroll interno: se expande para capturar la página completa
    const height = await page.evaluate(async () => {
      const content = document.querySelector('ion-content');
      const el = await content.getScrollElement();
      return el.scrollHeight + 60;
    });
    await page.setViewportSize({ width: shot.viewport.width, height });
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: join(out, `${shot.name}.png`) });
  await page.close();
  console.log(`ok ${shot.name}`);
}
await browser.close();
