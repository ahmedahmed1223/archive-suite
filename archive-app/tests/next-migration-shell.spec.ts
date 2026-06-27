import { expect, test } from '@playwright/test';

test('renders the Next.js migration shell with API contract status', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.brand strong')).toHaveText('Archive Suite');
  await expect(page.getByRole('heading', { name: /واجهة Next\.js الجديدة/ })).toBeVisible();
  await expect(page.getByLabel('حالة الترحيل')).toContainText('عقد API');
  await expect(page.getByLabel('حالة الترحيل')).toContainText('HttpOnly refresh cookie');
  await expect(page.getByText(/يحتوي على \d+ مسارا أساسيا/)).toBeVisible();
});
