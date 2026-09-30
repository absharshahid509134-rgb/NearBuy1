import { defineConfig, devices } from '@playwright/test'

/**
 * NearBuy browser E2E — runs against a running production gateway
 * (API + static SPA) and a real seeded PostgreSQL database.
 *
 *   E2E_BASE_URL=http://127.0.0.1:8080 npm run test:e2e
 *
 * Two viewports per the acceptance criteria:
 *   - desktop 1366×768
 *   - mobile  390×844 (touch)
 *
 * Notes for CI / local:
 *   - `npx playwright install chromium` is required first (only chromium is
 *     used; the suite is UI-framework-agnostic for the other engines).
 *   - The seeded demo accounts are the ones created by
 *     packages/database/prisma/seed.ts — E2E assumes a freshly seeded DB.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // the order state machine + per-IP rate limits demand serial runs
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8080',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
})
