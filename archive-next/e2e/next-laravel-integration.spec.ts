import { expect, test } from '@playwright/test';
import { WHATS_NEW_RELEASE, WHATS_NEW_STORAGE_KEY } from '../lib/whats-new';

const shareToken = process.env.ARCHIVE_E2E_SHARE_TOKEN ?? 'next-laravel-share';
const email = process.env.ARCHIVE_E2E_EMAIL ?? 'it@archive.test';
const password = process.env.ARCHIVE_E2E_PASSWORD ?? 'password123';
const currentThumbnailId = '44444444-4444-4444-8444-444444444444';
const staleThumbnailId = '55555555-5555-4555-8555-555555555555';

// The operational pages (/archive, /archive/[id], /media/jobs) are guarded by
// the cookie-session middleware. The API ROTATES the refresh token on every
// use (AuthController::refresh deletes the session and issues a new one), so
// a cookie captured once in beforeAll is single-use — every later test that
// replayed it got 401 → guest → /login. Log in fresh per test instead; the
// login throttle (30/min per IP) comfortably covers 5 tests x 2 projects.
test.beforeEach(async ({ context }) => {
  const response = await context.request.post('/api/v1/auth/login', {
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error(
      `login failed: ${response.status()} ${response.statusText()} — ${await response.text()}`
    );
  }
  // Suppress the modal whats-new dialog a fresh profile would open.
  // shouldShowWhatsNew is strict equality — store the real current release.
  await context.addInitScript(
    ([key, release]) => {
      window.localStorage.setItem(key, release);
    },
    [WHATS_NEW_STORAGE_KEY, WHATS_NEW_RELEASE] as const,
  );
});

test('renders a public share record through the Next.js to Laravel API rewrite', async ({ page }) => {
  await page.goto(`/share/${shareToken}`, { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'عارض المشاركة العامة' })).toBeVisible();
  await expect(page.getByLabel('محتوى المشاركة')).toContainText('تسجيل تكامل Next/Laravel');
  await expect(page.getByLabel('محتوى المشاركة')).toContainText('الصلاحية');
  await expect(page.getByLabel('محتوى المشاركة')).toContainText('view');
});

// Slices 5a/5b/5d.4: the operational Next pages read DB-backed records/jobs from Laravel.
// `.first()` + 15s: the title renders in both the card and the auto-opened
// preview/breadcrumb (strict-mode), and the dockerized Laravel API answers the
// client-side refresh→fetch chain in ~3-5s per hop.
test('lists the seeded archive record from Laravel on /archive', async ({ page }) => {
  await page.goto('/archive', { waitUntil: 'networkidle' });
  await expect(page.getByText('تسجيل تكامل Next/Laravel').first()).toBeVisible({ timeout: 15_000 });
});

test('renders only the current video derivative in an operational archive card', async ({ page }) => {
  const requestedDerivatives: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/media-derivatives/')) requestedDerivatives.push(request.url());
  });
  const currentThumbnail = page.waitForResponse((response) =>
    response.url().includes(`/media-derivatives/${currentThumbnailId}/content`) && response.status() === 200,
  );

  // The card view is requested explicitly: the desktop default became the
  // table (see getInitialViewMode, V2-DESIGN-001), and what this test is
  // about is the card's derivative handling, not which view opens first.
  await page.goto('/archive?view=grid', { waitUntil: 'networkidle' });

  const card = page.locator('.record-card').filter({ hasText: 'نشرة تكامل الفيديو' });
  await expect(card.getByRole('img', { name: 'معاينة فيديو نشرة تكامل الفيديو' })).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText('01:02')).toBeVisible();
  await expect(card.getByText('النسخة البديلة قيد المعالجة')).toBeVisible();
  await expect(card.getByText('الفحص اجتاز')).toBeVisible();
  await currentThumbnail;

  expect(requestedDerivatives.some((url) => url.includes(staleThumbnailId))).toBe(false);
  await expect(card.locator('img')).toHaveAttribute('src', /^blob:/);
});

test('renders the seeded record detail on /archive/[id]', async ({ page }) => {
  await page.goto('/archive/next-laravel-record', { waitUntil: 'networkidle' });
  await expect(
    page.getByRole('heading', { name: 'تسجيل تكامل Next/Laravel' }),
  ).toBeVisible({ timeout: 15_000 });
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
