import { expect, test } from '@playwright/test';

const shareToken = process.env.ARCHIVE_E2E_SHARE_TOKEN ?? 'next-laravel-share';

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
