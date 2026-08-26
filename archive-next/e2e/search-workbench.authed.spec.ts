import { expect, test } from './fixtures/auth';

/** V15-SEARCH-005: a real Laravel result can be previewed or cleared directly. */
test.describe('search workbench — live acceptance', () => {
  test('opens a seeded search result in the accessible preview rail and clears its active query in one action', async ({ roleSession }) => {
    const { page } = await roleSession('viewer');

    await page.goto('/search?q=%D8%AA%D9%83%D8%A7%D9%85%D9%84', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'بحث متقدم' })).toBeVisible();
    await expect(page.getByRole('article').getByRole('heading', { name: 'تسجيل تكامل Next/Laravel' })).toBeVisible();

    await page.getByRole('button', { name: 'معاينة' }).first().click();
    const preview = page.getByRole('region', { name: 'معاينة نتيجة البحث' });
    await expect(preview).toBeVisible();
    await expect(preview.getByRole('heading', { name: 'تسجيل تكامل Next/Laravel' })).toBeVisible();
    await expect(preview.getByRole('link', { name: 'فتح التفاصيل' })).toHaveAttribute('href', '/archive/next-laravel-record');

    const removeQuery = page.getByRole('button', { name: /إزالة الفلتر.*تكامل/ });
    await removeQuery.click();
    await expect(removeQuery).toHaveCount(0);
  });
});
