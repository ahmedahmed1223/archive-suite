import { expect, test } from '@playwright/test';
import { seedLocalArchive } from './helpers/seed';

test.describe('Navigation — responsive sidebar', () => {
  test('mobile drawer opens and closes, then desktop sidebar returns after resize', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedLocalArchive(page);
    await page.goto('/#/dashboard', { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });

    const sidebar = page.getByRole('navigation', { name: 'القائمة الجانبية', exact: true });
    await expect(sidebar).toBeHidden({ timeout: 15_000 });

    await page.getByLabel('فتح القائمة الجانبية').click();
    await expect(sidebar).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

    await page.keyboard.press('Escape');
    await expect(sidebar).toBeHidden({ timeout: 15_000 });

    await page.getByRole('button', { name: 'فتح القائمة الكاملة' }).click();
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('فتح القائمة الجانبية')).toBeHidden();
  });
});
