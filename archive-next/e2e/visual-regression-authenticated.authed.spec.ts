import { expect, test } from './fixtures/auth';
import { DYNAMIC_ROUTE_PARAMS, ROUTE_COVERAGE } from './fixtures/route-inventory';
import {
  assertNoClippedInteractiveElements,
  assertNoClippedReadableElements,
  VIEWPORTS,
} from './fixtures/visual-routes';
import { stubForbiddenApi } from './fixtures/route-states';

/**
 * V1-303E (authenticated half): same zero-horizontal-overflow gate as
 * visual-regression.spec.ts, extended to the authenticated routes in
 * ROUTE_COVERAGE — the same fixture route-inventory.spec.ts diffs against the
 * real App Router tree, so this can't silently drift from what actually
 * exists.
 *
 * Scoped to the `ready` state, unlike the axe gate (which also checks
 * loading/empty/error): those states render small, centered placeholder
 * content by convention across this app, not the full layout that can
 * actually overflow. `ready` is where real data — long titles, wide tables,
 * dense toolbars — could push a layout past its breakpoint.
 *
 * `no-permission` is the exception, captured separately at the end of this
 * file. It is not a placeholder — it is a designed surface an operator has to
 * read and act on — and V2-UX-002 asks for it by name, so it gets its own
 * image rather than an axe check alone.
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

        await assertNoClippedInteractiveElements(page, viewport.width, `${url} [${coverage.role}] @ ${viewport.name}`);

        const safeName = coverage.route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
        await page.screenshot({
          path: `visual-evidence/authed--${safeName}--${coverage.role}--${viewport.name}.png`,
          fullPage: true,
        });
      });
    }
  });
}

/**
 * V2-UX-002: the refusal surface, as the least-privileged role sees it when
 * the server says no. ROUTE_COVERAGE visits every route as the least
 * privileged role that can render it, so an admin screen is only ever opened
 * by an admin — which means nobody had ever looked at what the refusal itself
 * looks like. These are the images for that state.
 */
for (const viewport of VIEWPORTS) {
  test.describe(`authenticated no-permission surface @ ${viewport.name}`, () => {
    for (const coverage of ROUTE_COVERAGE) {
      test(`${coverage.route} [${coverage.role}] renders a refusal without overflow`, async ({
        roleSession,
      }) => {
        const session = await roleSession(coverage.role);
        const { page, data } = session;

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await stubForbiddenApi(page);

        const resolve = DYNAMIC_ROUTE_PARAMS[coverage.route];
        const url = resolve ? resolve({ recordUid: data.recordUid }) : coverage.url;

        // A refused page issues no further requests, so networkidle is quick —
        // but a page that retries a 403 on a timer never reaches it, which is
        // itself worth knowing rather than hanging the suite.
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15_000 });

        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

        expect(
          scrollWidth,
          `${url} [${coverage.role}/no-permission] @ ${viewport.name}: content scrolls ` +
            `horizontally (scrollWidth ${scrollWidth}px > clientWidth ${clientWidth}px)`,
        ).toBeLessThanOrEqual(clientWidth);

        const safeName = coverage.route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
        await page.screenshot({
          path: `visual-evidence/authed--${safeName}--${coverage.role}--no-permission--${viewport.name}.png`,
          fullPage: true,
        });
      });
    }
  });
}
