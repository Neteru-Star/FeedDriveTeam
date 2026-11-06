import { defineConfig, devices } from '@playwright/test';

// Las pruebas E2E corren contra el backend simulado (mock-api) y la app en configuración "mock",
// en un puerto propio para no reutilizar un `npm start` que apunte al servidor real.
const baseURL = 'http://localhost:4300';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'Desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: 'npm run mock:api',
      url: 'http://localhost:8000/api/fares/active',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npx ng serve --configuration mock --port 4300',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
