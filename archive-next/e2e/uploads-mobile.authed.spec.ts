import { expect, test } from './fixtures/auth';
import {
  assertNoClippedInteractiveElements,
  assertNoClippedReadableElements,
} from './fixtures/visual-routes';

test('uploads renders its primary workspace @ mobile-375', async ({ roleSession }) => {
  const { page } = await roleSession('editor');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/uploads', { waitUntil: 'networkidle' });

  expect(new URL(page.url()).pathname).toBe('/uploads');
  await expect(page.locator('.add-workspace')).toBeVisible();
  await expect(page.locator('.add-workspace__primary')).toBeVisible();
  await expect(page.getByRole('region', { name: 'إضافة مادة للأرشيف' })).toBeVisible();
  await assertNoClippedInteractiveElements(page, 375, '/uploads [editor] @ mobile-375');
  await assertNoClippedReadableElements(page, 375, '/uploads [editor] @ mobile-375');
  await page.screenshot({
    path: 'visual-evidence/authed--uploads--editor--mobile-375.png',
    fullPage: true,
  });
});
