import { expect, test } from '@playwright/test';

const shareToken = process.env.ARCHIVE_E2E_SHARE_TOKEN ?? 'next-laravel-share';

test('renders a public share record through the Next.js to Laravel API rewrite', async ({ page }) => {
  await page.goto(`/share/${shareToken}`, { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'عارض المشاركة العامة.' })).toBeVisible();
  await expect(page.getByLabel('محتوى المشاركة')).toContainText('تسجيل تكامل Next/Laravel');
  await expect(page.getByText('صلاحية المشاركة: view')).toBeVisible();
});
