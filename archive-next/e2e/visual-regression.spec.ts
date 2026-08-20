import { expect, test } from '@playwright/test';
import {
  assertNoClippedInteractiveElements,
  assertNoClippedReadableElements,
  CORE_ROUTES,
  gotoPublicRoute,
  VIEWPORTS,
} from './fixtures/visual-routes';
import { WHATS_NEW_RELEASE, WHATS_NEW_STORAGE_KEY } from '../lib/whats-new';

const LOCALES = [
  { name: 'arabic', locale: 'ar-SA' },
  { name: 'english', locale: 'en-US' },
] as const;

/**
 * V1-303E: live visual review for the core routes at the three required
 * breakpoints.
 *
 * Three checks, deliberately kept separate from axe (accessibility.spec.ts):
 *
 * 1. Zero horizontal overflow — `document.documentElement.scrollWidth` must
 *    not exceed the viewport width. This is the objective, cross-platform
 *    part of "no essential action out of reach": content that overflows
 *    horizontally at a breakpoint is either clipped or forces a scrollbar
 *    that hides actions past the fold.
 * 2. No interactive element rendered outside the viewport's horizontal
 *    bounds (`assertNoClippedInteractiveElements`, fixtures/visual-routes.ts)
 *    — catches the case an `overflow: hidden` container clips an action
 *    without ever growing document scrollWidth, which check 1 alone misses.
 * 3. A full-page screenshot per route/viewport, saved as evidence for manual
 *    review rather than pixel-diffed with `toHaveScreenshot()`. Playwright's
 *    screenshot baselines are OS/font-rendering specific (this repo develops
 *    on Windows, CI runs ubuntu-latest); comparing across the two would fail
 *    on font-hinting differences, not real regressions. Upgrading to a real
 *    pixel-diff gate needs baselines generated inside the same Linux
 *    container CI uses (see archive-laravel/Dockerfile.worker), not committed
 *    from a local machine.
 *
 * "Documented exceptions only" per V1-303E: no route is currently excluded
 * from this gate — CORE_ROUTES is the full, backend-free set already
 * established for V1-303A/E. Authenticated routes are covered by
 * visual-regression-authenticated.authed.spec.ts.
 */

test.describe('visual regression: zero horizontal overflow + screenshot evidence', () => {
  for (const language of LOCALES) {
    test.describe(`@ ${language.name}`, () => {
      test.use({ locale: language.locale });

      for (const viewport of VIEWPORTS) {
        test.describe(`@ ${viewport.name}`, () => {
          test.use({ viewport: { width: viewport.width, height: viewport.height } });

          for (const route of CORE_ROUTES) {
            test(`${route} has no horizontal overflow`, async ({ page }) => {
              await gotoPublicRoute(page, route);

              const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
              const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

              expect(
                scrollWidth,
                `${route} @ ${language.name} @ ${viewport.name}: content scrolls horizontally ` +
                  `(scrollWidth ${scrollWidth}px > clientWidth ${clientWidth}px)`,
              ).toBeLessThanOrEqual(clientWidth);

              const label = `${route} @ ${language.name} @ ${viewport.name}`;
              await assertNoClippedInteractiveElements(page, viewport.width, label);
              await assertNoClippedReadableElements(page, viewport.width, label);

              const safeName = route === '/' ? 'home' : route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
              await page.screenshot({
                path: `visual-evidence/${safeName}--${language.name}--${viewport.name}.png`,
                fullPage: true,
              });
            });
          }
        });
      }
    });
  }
});

test.describe('visual regression: Focus Command shell', () => {
  for (const viewport of VIEWPORTS) {
    test(`first-run exposes the expected command entry @ ${viewport.name}`, async ({ page, context }) => {
      await context.addInitScript(
        ([key, release]) => window.localStorage.setItem(key, release),
        [WHATS_NEW_STORAGE_KEY, WHATS_NEW_RELEASE] as const,
      );
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/first-run', { waitUntil: 'networkidle' });

      const commandEntry = viewport.width <= 375
        ? page.getByRole('button', { name: 'فتح الأوامر' })
        : page.getByRole('button', { name: 'بحث، فتح صفحة، أو تنفيذ أمر' });
      await expect(commandEntry).toBeVisible();

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
      await assertNoClippedInteractiveElements(page, viewport.width, `/first-run @ ${viewport.name}`);
      await assertNoClippedReadableElements(page, viewport.width, `/first-run @ ${viewport.name}`);

      await page.screenshot({
        path: `visual-evidence/focus-command-shell--${viewport.name}.png`,
        fullPage: true,
      });
    });
  }
});

// V2-807: open-menu states are a distinct render path from the closed shell
// above (fixed/absolute overlays, off-canvas panels) and can overflow or
// clip on their own even when the closed state is clean.
test.describe('visual regression: mobile menu open states', () => {
  test('first-run nav-toggle drawer has no overflow when open @ mobile-375', async ({ page, context }) => {
    await context.addInitScript(
      ([key, release]) => window.localStorage.setItem(key, release),
      [WHATS_NEW_STORAGE_KEY, WHATS_NEW_RELEASE] as const,
    );
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/first-run', { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: 'فتح التنقل' }).click();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    await assertNoClippedInteractiveElements(page, 375, 'first-run nav drawer open @ mobile-375');
    await assertNoClippedReadableElements(page, 375, 'first-run nav drawer open @ mobile-375');

    await page.screenshot({ path: 'visual-evidence/first-run-nav-open--mobile-375.png', fullPage: true });
  });

  test('first-run "more actions" menu has no overflow when open @ mobile-375', async ({ page, context }) => {
    await context.addInitScript(
      ([key, release]) => window.localStorage.setItem(key, release),
      [WHATS_NEW_STORAGE_KEY, WHATS_NEW_RELEASE] as const,
    );
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/first-run', { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: 'إجراءات إضافية' }).click();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    await assertNoClippedInteractiveElements(page, 375, 'first-run more-actions menu open @ mobile-375');
    await assertNoClippedReadableElements(page, 375, 'first-run more-actions menu open @ mobile-375');

    await page.screenshot({ path: 'visual-evidence/first-run-more-actions-open--mobile-375.png', fullPage: true });
  });
});
