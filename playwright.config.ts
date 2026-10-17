import os from 'node:os'
import { defineConfig, devices } from '@playwright/test'

// About half the CPU cores: the tests run in parallel without starving the machine.
const workers = process.env.CI
  ? 2
  : Math.max(2, Math.floor(os.availableParallelism() / 2))

export default defineConfig({
  testDir: './e2e',
  // Every test is independent (each gets a fresh browser profile), so they all run in parallel.
  fullyParallel: true,
  workers,
  // A stuck run fails within 10 minutes instead of hanging; one stuck test, within a minute.
  globalTimeout: 10 * 60 * 1000,
  timeout: 60 * 1000,
  expect: { timeout: 8000 },
  // On GitHub: annotate failures, keep an HTML report for the artifact, and retry a flaky test once.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // Chromium only: it is the one browser the tests are written against.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // The service worker is off for most tests, so they always see the page they just loaded.
  // e2e/pwa.spec.ts turns it on.
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'block' },
  // One server for the whole run: built once, started by scripts/e2e-server.mjs, stopped at the
  // end. A server already on the port that this script did not start is never reused.
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120 * 1000,
    stdout: 'pipe',
  },
})
