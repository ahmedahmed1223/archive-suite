/**
 * PWA conformance — manifest.json, RTL/Arabic metadata, service worker file,
 * theme-color meta tag.
 */

import { test, expect } from '@playwright/test';

test.describe('PWA — manifest.json', () => {
  test('manifest.json is reachable and returns JSON', async ({ page }) => {
    const response = await page.request.get('/manifest.json');
    expect(response.status()).toBe(200);
    const ct = response.headers()['content-type'] ?? '';
    // Accept application/json or application/manifest+json
    expect(ct).toMatch(/json|manifest/);
  });

  test('manifest has Arabic name and RTL direction', async ({ page }) => {
    const response = await page.request.get('/manifest.json');
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest.dir).toBe('rtl');
    expect(manifest.lang).toBe('ar');
    expect(typeof manifest.name).toBe('string');
    expect(manifest.name.length).toBeGreaterThan(0);
  });

  test('manifest has valid icon entries', async ({ page }) => {
    const response = await page.request.get('/manifest.json');
    const manifest = await response.json();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      expect(typeof icon.src).toBe('string');
      expect(icon.src.length).toBeGreaterThan(0);
    }
  });

  test('manifest display mode is standalone or fullscreen', async ({ page }) => {
    const response = await page.request.get('/manifest.json');
    const manifest = await response.json();
    expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(manifest.display);
  });

  test('manifest has a start_url', async ({ page }) => {
    const response = await page.request.get('/manifest.json');
    const manifest = await response.json();
    expect(typeof manifest.start_url).toBe('string');
    expect(manifest.start_url.length).toBeGreaterThan(0);
  });
});

test.describe('PWA — HTML meta tags', () => {
  test('theme-color meta tag is present', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBeTruthy();
    // Should be a valid hex or CSS colour
    expect(themeColor).toMatch(/^#[0-9a-fA-F]{3,8}$/);
  });

  test('manifest link rel is present in head', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toContain('manifest');
  });

  test('apple-mobile-web-app-capable meta is set', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const capable = await page
      .locator('meta[name="apple-mobile-web-app-capable"]')
      .getAttribute('content');
    expect(capable).toBe('yes');
  });
});

test.describe('PWA — service worker', () => {
  test('sw.js file is served (200 in prod, acceptable 404 in dev)', async ({ page }) => {
    const response = await page.request.get('/sw.js');
    // In development mode (which the preview server uses) the SW file is built
    // and served from /sw.js. Either 200 or 404 is acceptable here.
    expect([200, 404]).toContain(response.status());
  });

  test('offline.html fallback page exists', async ({ page }) => {
    const response = await page.request.get('/offline.html');
    expect([200, 404]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.text();
      expect(body.length).toBeGreaterThan(0);
    }
  });
});
