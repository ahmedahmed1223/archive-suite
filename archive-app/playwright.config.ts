import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Archive Suite E2E tests.
 *
 * Run against the Vite preview server (pnpm build:spa && pnpm preview) or
 * supply E2E_BASE_URL to point at a running dev server.
 *
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Single worker avoids IndexedDB race conditions between tests
  workers: 1,
  timeout: 30_000,

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173',

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

  /*
   * The a11y scripts (run-a11y.mjs, run-interactive-audit.mjs) start and
   * stop the preview server themselves on Windows. For the standard `pnpm e2e`
   * command, start the preview server first with `pnpm build:spa && pnpm preview`.
   */
});
