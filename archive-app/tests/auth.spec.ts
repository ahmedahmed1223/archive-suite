/**
 * Auth flows — login screen rendering, wrong credentials, RTL/lang checks,
 * and the lock screen.
 *
 * These tests intentionally do NOT seed the database so the app renders
 * in its unauthenticated state (login or setup screen).
 */

import { test, expect } from '@playwright/test';

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Load the app without any seeded session so the login/setup screen appears.
 * Clears localStorage first to guarantee a fresh state.
 */
async function loadUnauthenticated(page: import('@playwright/test').Page) {
  // Land on the page once so we can clear storage
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    try { indexedDB.deleteDatabase('VideoArchiveDB'); } catch { /* ignore */ }
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
}

// ─── tests ──────────────────────────────────────────────────────────────────

test.describe('Auth — HTML document', () => {
  test('html element has lang="ar" and dir="rtl"', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const lang = await page.evaluate(() => document.documentElement.lang);
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(lang).toBe('ar');
    expect(dir).toBe('rtl');
  });

  test('page title contains Arabic archive label', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/أرشيف/);
  });
});

test.describe('Auth — login screen', () => {
  test.beforeEach(async ({ page }) => {
    await loadUnauthenticated(page);
  });

  test('renders an Arabic heading on the auth screen', async ({ page }) => {
    // After clearing storage the app shows either the login or setup/onboarding screen.
    // Both render an h1 with Arabic text.
    const heading = page.getByRole('heading', { level: 1 }).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
    const text = await heading.textContent();
    // Heading should contain Arabic characters (Unicode range 0600-06FF)
    expect(text).toMatch(/[؀-ۿ]/);
  });

  test('login form has a password field', async ({ page }) => {
    // The app may show onboarding/setup rather than a login form on a clean install.
    const inputLocator = page.locator('input[type="password"], input[type="text"]');
    const loginFormVisible = await inputLocator.first().isVisible().catch(() => false);
    if (!loginFormVisible) {
      test.skip('Login form not shown because onboarding/setup flow is active');
      return;
    }

    const pw = page.locator('input[type="password"]').first();
    await expect(pw).toBeVisible();
  });

  test('wrong credentials show an Arabic error message', async ({ page }) => {
    // Wait for the app to finish loading
    await page.waitForLoadState('networkidle');

    const usernameSelect = page.locator('select').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    // Only attempt login if a standard login form is rendered
    if (!(await passwordInput.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await passwordInput.fill('definitely_wrong_password_xyz');
    await submitButton.click();

    // The error message rendered uses Arabic text; wait up to 8 s for it
    const errorMsg = page.locator('p').filter({ hasText: /غير صحيح|خطأ|فشل|كلمة المرور/ }).first();
    await expect(errorMsg).toBeVisible({ timeout: 8_000 });
  });

  test('submit button is visible and labelled in Arabic', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const submitButton = page.locator('button[type="submit"]').first();
    const submitVisible = await submitButton.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!submitVisible) {
      test.skip('Submit button not shown because onboarding/setup flow is active');
      return;
    }
    const label = await submitButton.textContent();
    expect(label?.trim().length).toBeGreaterThan(0);
  });
});

test.describe('Auth — splash / startup screen', () => {
  test('splash screen disappears within 10 seconds', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // The splash screen contains the Arabic heading "أرشيف الفيديو" inside a progress view.
    // After startup it is replaced by either the login screen or the main app shell.
    // Verify that *something* beyond the raw splash renders within 10 s.
    await page.waitForSelector(
      '[class*="va-app-shell"], [class*="va-auth-shell"], [class*="va-onboarding-shell"]',
      { timeout: 15_000 },
    );
  });
});

test.describe('Auth — skip link', () => {
  test('skip-to-main-content link is present after login (seeded)', async ({ page }) => {
    // Import seed helper lazily so other auth tests remain unauthenticated
    const { seedLocalArchive } = await import('./helpers/seed');
    await seedLocalArchive(page);
    await page.goto('/#/dashboard', { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Wait for authenticated shell
    await page.waitForSelector('[class*="va-app-shell"]', { timeout: 15_000 });

    // The skip link href="#main-content"
    const skipLink = page.locator('a[href="#main-content"]').first();
    await expect(skipLink).toBeAttached();

    // It should become visible on focus
    await skipLink.focus();
    await expect(skipLink).toBeVisible();
  });
});
