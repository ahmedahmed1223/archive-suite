import { expect, test } from './fixtures/auth';
import { assertNoClippedInteractiveElements } from './fixtures/visual-routes';

/**
 * P10 (V14-UX-011 leftover): the mobile navigation drawer must carry a
 * dismiss control inside the thumb zone (lower half of a 375x812 viewport).
 * On phones the overlay drawer leaves almost no tappable backdrop strip, so
 * one-handed users cannot rely on backdrop-tap or the top header toggle.
 *
 * Requires the live Laravel + Next harness (`pnpm verify:laravel-next:live`)
 * for the `roleSession` fixture -- see e2e/fixtures/auth.ts.
 */
test('nav drawer close control sits in the thumb zone @ mobile-375', async ({ roleSession }) => {
  const { page } = await roleSession('viewer');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/', { waitUntil: 'networkidle' });

  expect(new URL(page.url()).pathname).toBe('/');

  // Open the drawer from the header toggle (its accessible name flips open->close).
  const toggle = page.locator('button.nav-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  const drawer = page.locator('#app-primary-nav');
  await expect(drawer).toBeVisible();

  // The drawer-carried close control must sit in the thumb zone.
  const close = drawer.getByRole('button', { name: 'إغلاق التنقل' });
  await expect(close).toBeVisible();
  const box = await close.boundingBox();
  expect(box, 'drawer close control must have a measurable box').not.toBeNull();
  const centerY = box!.y + box!.height / 2;
  expect(centerY, `close center (${Math.round(centerY)}px) must sit in the thumb zone (y > 406)`).toBeGreaterThan(406);

  // It dismisses the drawer and returns focus to the header toggle.
  await close.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();

  await assertNoClippedInteractiveElements(page, 375, '/ [viewer] drawer @ mobile-375');
});
