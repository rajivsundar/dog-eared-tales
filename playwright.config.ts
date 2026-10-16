import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // The service worker is off for most tests, so they always see the page they just loaded.
  // e2e/pwa.spec.ts turns it on.
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'block' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
