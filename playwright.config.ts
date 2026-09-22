import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ],
  webServer: {
    // Run the actual authoritative server and WebSocket path in both browsers.
    command: `${process.execPath} node_modules/tsx/dist/cli.mjs server/index.ts --dev`,
    env: { PORT: '4173', HOST: '127.0.0.1', BLUE_STAGE_BASE_URL: 'http://127.0.0.1:4173' },
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: false
  }
});
