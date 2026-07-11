import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the canonical Next.js shell.
 *
 * Point E2E_BASE_URL at a running Next.js server (default: next start on
 * http://127.0.0.1:3000). The live-integration gate
 * (scripts/verify-next-laravel-live.mjs) launches Laravel + Next itself and
 * sets E2E_BASE_URL before invoking these specs.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 30_000,

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',

    // RTL Arabic app — set locale so Intl / date formatting is consistent
    locale: 'ar-SA',

    // Capture artifacts on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
