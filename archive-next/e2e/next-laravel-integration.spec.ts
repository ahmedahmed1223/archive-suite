import { expect, test } from '@playwright/test';
import type { Cookie } from '@playwright/test';

const shareToken = process.env.ARCHIVE_E2E_SHARE_TOKEN ?? 'next-laravel-share';
const email = process.env.ARCHIVE_E2E_EMAIL ?? 'it@archive.test';
const password = process.env.ARCHIVE_E2E_PASSWORD ?? 'password123';

// The operational pages (/archive, /archive/[id], /media/jobs) are guarded by the
// cookie-session middleware. /auth/login is throttled (10/min, see V1-104) — 5
// tests x 2 browser projects x CI retries would blow past that logging in once
// per test, failing every test on an unrelated 429 instead of a real bug.
// Log in exactly once per project instead, and hand the resulting cookie to
// each test's context locally (no extra network round trip).
let sessionCookie: Cookie | undefined;

test.beforeAll(async ({ browser }) => {
  // A real browser context (not the standalone `request` API context) —
  // matches how the previous per-test page.request.post() successfully
  // captured the cookie. A bare APIRequestContext's storageState() did not
  // reliably surface the Set-Cookie from this rewritten response in CI;
  // browser-context cookies() is the same mechanism the working per-test
  // version relied on.
  const setupContext = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
  });

  const response = await setupContext.request.post('/api/v1/auth/login', {
    data: { email, password },
  });
  expect(response.ok()).toBeTruthy();

  sessionCookie = (await setupContext.cookies()).find((c) => c.name === 'va_refresh');
  expect(sessionCookie).toBeDefined();

  await setupContext.close();
});

test.beforeEach(async ({ context }) => {
  if (sessionCookie) {
    await context.addCookies([sessionCookie]);
  }
});

test('renders a public share record through the Next.js to Laravel API rewrite', async ({ page }) => {
  await page.goto(`/share/${shareToken}`, { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'عارض المشاركة العامة.' })).toBeVisible();
  await expect(page.getByLabel('محتوى المشاركة')).toContainText('تسجيل تكامل Next/Laravel');
  await expect(page.getByText('صلاحية المشاركة: view')).toBeVisible();
});

// Slices 5a/5b/5d.4: the operational Next pages read DB-backed records/jobs from Laravel.
test('lists the seeded archive record from Laravel on /archive', async ({ page }) => {
  await page.goto('/archive', { waitUntil: 'networkidle' });
  await expect(page.getByText('تسجيل تكامل Next/Laravel')).toBeVisible();
});

test('renders the seeded record detail on /archive/[id]', async ({ page }) => {
  await page.goto('/archive/next-laravel-record', { waitUntil: 'networkidle' });
  await expect(page.getByText('تسجيل تكامل Next/Laravel')).toBeVisible();
});

test('lists the seeded media job from Laravel on /media/jobs', async ({ page }) => {
  await page.goto('/media/jobs', { waitUntil: 'networkidle' });
  await expect(page.getByText('next-laravel-record')).toBeVisible();
});

// /files is filesystem-backed; the integration env may have no ingest fixtures,
// so assert the page renders its shell rather than specific files.
test('renders the files page shell over the Laravel files API', async ({ page }) => {
  await page.goto('/files', { waitUntil: 'networkidle' });
  await expect(page.getByRole('main')).toBeVisible();
});
