import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    viewport: { width: 1280, height: 720 },
    locale: 'de-DE',
    trace: 'retain-on-failure',
  },
  snapshotPathTemplate: '{testDir}/../dist/baselines/{arg}{ext}',
  webServer: {
    command: 'node scripts/serve.mjs 8080',
    url: 'http://127.0.0.1:8080/',
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [
    {
      name: 'chromium-swiftshader',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
            '--enable-webgl',
          ],
        },
      },
    },
  ],
});
