import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // On GitHub: annotate failures, keep an HTML report for the artifact, and retry a flaky test once.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
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
