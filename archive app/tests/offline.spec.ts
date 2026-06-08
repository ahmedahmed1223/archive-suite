/**
 * Offline / network resilience — offline banner, online/offline events,
 * service worker asset caching.
 *
 * These tests seed IndexedDB so the app is in the authenticated state
 * when the network is toggled.
 */

import { test, expect } from '@playwright/test';
import { seedLocalArchive, goToPage } from './helpers/seed';

test.describe('Offline — OfflineBanner', () => {
  test('offline banner appears when network is disabled', async ({
    page,
    context,
  }) => {
    await seedLocalArchive(page);
    await goToPage(page, '#/dashboard');

    await page.waitForSelector('[class*="va-app-shell"]', { timeout: 15_000 });

    // Simulate going offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    // The OfflineBanner renders with role="alert" and contains Arabic text
    const banner = page.locator('[role="alert"]').first();
    await expect(banner).toBeVisible({ timeout: 5_000 });

    // Restore network
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
  });

  test('offline banner disappears when network is restored', async ({
    page,
    context,
  }) => {
    await seedLocalArchive(page);
    await goToPage(page, '#/dashboard');
    await page.waitForSelector('[class*="va-app-shell"]', { timeout: 15_000 });

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    const banner = page.locator('[role="alert"]').first();
    await expect(banner).toBeVisible({ timeout: 5_000 });

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // Banner should disappear
    await expect(banner).not.toBeVisible({ timeout: 5_000 });
  });

  test('banner has assertive aria-live attribute', async ({ page, context }) => {
    await seedLocalArchive(page);
    await goToPage(page, '#/dashboard');
    await page.waitForSelector('[class*="va-app-shell"]', { timeout: 15_000 });

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    const banner = page.locator('[role="alert"]').first();
    await expect(banner).toBeVisible({ timeout: 5_000 });

    const ariaLive = await banner.getAttribute('aria-live');
    expect(ariaLive).toBe('assertive');

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
  });
});

test.describe('Offline — app stability', () => {
  test('app remains functional when offline (no JS crash)', async ({
    page,
    context,
  }) => {
    await seedLocalArchive(page);
    await goToPage(page, '#/dashboard');
    await page.waitForSelector('[class*="va-app-shell"]', { timeout: 15_000 });

    // Capture console errors before going offline
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    // Navigate to another page to stress-test offline stability
    await page.keyboard.press('Control+k');
    const palette = page.locator('[role="dialog"][aria-label="لوحة الأوامر"]');
    const paletteOpened = await palette.isVisible({ timeout: 3_000 }).catch(() => false);
    if (paletteOpened) {
      await page.keyboard.press('Escape');
    }

    // Check no unhandled JS errors occurred
    const fatal = errors.filter(
      (msg) =>
        !msg.includes('Failed to fetch') &&
        !msg.includes('NetworkError') &&
        !msg.includes('net::ERR'),
    );
    expect(fatal).toHaveLength(0);

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
  });
});
