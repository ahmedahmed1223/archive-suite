import { expect, test } from './fixtures/auth';
import { DYNAMIC_ROUTE_PARAMS, ROUTE_COVERAGE } from './fixtures/route-inventory';
import { VIEWPORTS } from './fixtures/visual-routes';

/**
 * V1-303E (authenticated half): same zero-horizontal-overflow gate as
 * visual-regression.spec.ts, extended to the authenticated routes in
 * ROUTE_COVERAGE — the same fixture route-inventory.spec.ts diffs against the
 * real App Router tree, so this can't silently drift from what actually
 * exists.
 *
 * Scoped to the `ready` state only, unlike the axe gate (which also checks
 * loading/empty/error): those states render small, centered placeholder
 * content by convention across this app, not the full layout that can
 * actually overflow. `ready` is where real data — long titles, wide tables,
 * dense toolbars — could push a layout past its breakpoint.
 */

for (const viewport of VIEWPORTS) {
  test.describe(`authenticated visual regression @ ${viewport.name}`, () => {
    for (const coverage of ROUTE_COVERAGE) {
      test(`${coverage.route} [${coverage.role}] has no horizontal overflow`, async ({
        roleSession,
      }) => {
        const session = await roleSession(coverage.role);
        const { page, data } = session;

        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        const resolve = DYNAMIC_ROUTE_PARAMS[coverage.route];
        const url = resolve ? resolve({ recordUid: data.recordUid }) : coverage.url;

        await page.goto(url, { waitUntil: 'networkidle' });

        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

        expect(
          scrollWidth,
          `${url} [${coverage.role}] @ ${viewport.name}: content scrolls horizontally ` +
            `(scrollWidth ${scrollWidth}px > clientWidth ${clientWidth}px)`,
        ).toBeLessThanOrEqual(clientWidth);

        const safeName = coverage.route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
        await page.screenshot({
          path: `visual-evidence/authed--${safeName}--${coverage.role}--${viewport.name}.png`,
          fullPage: true,
        });
      });
    }
  });
}
