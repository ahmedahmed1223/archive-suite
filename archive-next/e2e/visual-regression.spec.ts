import { expect, test } from '@playwright/test';
import { CORE_ROUTES, VIEWPORTS } from './fixtures/visual-routes';

/**
 * V1-303E: live visual review for the core routes at the three required
 * breakpoints.
 *
 * Two checks, deliberately kept separate from axe (accessibility.spec.ts):
 *
 * 1. Zero horizontal overflow — `document.documentElement.scrollWidth` must
 *    not exceed the viewport width. This is the objective, cross-platform
 *    part of "no essential action out of reach": content that overflows
 *    horizontally at a breakpoint is either clipped or forces a scrollbar
 *    that hides actions past the fold.
 * 2. A full-page screenshot per route/viewport, saved as evidence for manual
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
 * established for V1-303A/E. Authenticated routes (see route-inventory.ts)
 * are out of scope here; they get their overflow coverage when V1-306C's
 * per-page audit work extends into this file.
 */

test.describe('visual regression: zero horizontal overflow + screenshot evidence', () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`@ ${viewport.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of CORE_ROUTES) {
        test(`${route} has no horizontal overflow`, async ({ page }) => {
          await page.goto(route, { waitUntil: 'networkidle' });

          const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
          const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

          expect(
            scrollWidth,
            `${route} @ ${viewport.name}: content scrolls horizontally ` +
              `(scrollWidth ${scrollWidth}px > clientWidth ${clientWidth}px)`,
          ).toBeLessThanOrEqual(clientWidth);

          const safeName = route === '/' ? 'home' : route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
          await page.screenshot({
            path: `visual-evidence/${safeName}--${viewport.name}.png`,
            fullPage: true,
          });
        });
      }
    });
  }
});
