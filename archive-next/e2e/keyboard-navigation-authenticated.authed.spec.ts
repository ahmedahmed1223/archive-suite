import { expect, test } from './fixtures/auth';
import { DYNAMIC_ROUTE_PARAMS, ROUTE_COVERAGE } from './fixtures/route-inventory';

/**
 * V1-303D (authenticated half): skip-link + no-keyboard-deadend checks,
 * same shape as keyboard-navigation.spec.ts, but against real authenticated
 * pages instead of CORE_ROUTES — which was found to redirect to /login
 * without a live backend session (see keyboard-navigation.spec.ts's own
 * scope note), and /login has no skip-link at all (its own minimal
 * chrome-less layout, no nav to skip).
 *
 * Scoped to the pages V1-303D names explicitly (onboarding/archive/
 * record/upload/search/admin) rather than the full ROUTE_COVERAGE sweep —
 * a representative real check, not exhaustive, given this needs the live
 * Laravel+Next harness to run at all.
 */

const TARGET_ROUTES = [
  '/work-inbox',
  '/archive',
  '/archive/[id]',
  '/search',
  '/uploads',
  '/settings/users',
  '/system/control',
] as const;

for (const routeKey of TARGET_ROUTES) {
  const coverage = ROUTE_COVERAGE.find((entry) => entry.route === routeKey);
  if (!coverage) {
    throw new Error(`keyboard-navigation-authenticated: no ROUTE_COVERAGE entry for ${routeKey}`);
  }

  test.describe(`${coverage.route} [${coverage.role}]`, () => {
    test(`${coverage.route} [${coverage.role}]: skip link is the first tab stop and moves focus to main content`, async ({
      roleSession,
    }) => {
      const session = await roleSession(coverage.role);
      const { page, data } = session;

      const resolve = DYNAMIC_ROUTE_PARAMS[coverage.route];
      const url = resolve ? resolve({ recordUid: data.recordUid }) : coverage.url;

      await page.goto(url, { waitUntil: 'networkidle' });
      await page.locator('.skip-link').waitFor({ state: 'attached' });

      await page.keyboard.press('Tab');
      const skipLinkFocused = await page.evaluate(() => document.activeElement?.classList.contains('skip-link') ?? false);
      expect(skipLinkFocused, `${url} [${coverage.role}]: first Tab press did not land on the skip link`).toBe(true);

      await page.keyboard.press('Enter');
      const mainFocused = await page.evaluate(() => document.activeElement?.id === 'main-content');
      expect(mainFocused, `${url} [${coverage.role}]: activating the skip link did not move focus to #main-content`).toBe(true);
    });

    test(`${coverage.route} [${coverage.role}]: tabbing through the page never gets stuck`, async ({ roleSession }) => {
      const session = await roleSession(coverage.role);
      const { page, data } = session;

      const resolve = DYNAMIC_ROUTE_PARAMS[coverage.route];
      const url = resolve ? resolve({ recordUid: data.recordUid }) : coverage.url;

      await page.goto(url, { waitUntil: 'networkidle' });
      await page.locator('.skip-link').waitFor({ state: 'attached' });

      const seen: string[] = [];
      for (let i = 0; i < 20; i += 1) {
        await page.keyboard.press('Tab');
        const signature = await page.evaluate(() => {
          const active = document.activeElement;
          if (!active || active === document.body) return 'body';
          const rect = active.getBoundingClientRect();
          return `${active.tagName}#${active.id}.${Array.from(active.classList).join('.')}@${Math.round(rect.top)},${Math.round(rect.left)}`;
        });
        seen.push(signature);
      }

      const stuck = seen.some((signature, index) => index > 0 && signature !== 'body' && signature === seen[index - 1]);
      expect(stuck, `${url} [${coverage.role}]: focus got stuck during Tab traversal: ${JSON.stringify(seen)}`).toBe(false);
    });

    test(`${coverage.route} [${coverage.role}]: announces the route to screen readers`, async ({ roleSession }) => {
      const { page, data } = await roleSession(coverage.role);
      const resolve = DYNAMIC_ROUTE_PARAMS[coverage.route];
      const url = resolve ? resolve({ recordUid: data.recordUid }) : coverage.url;

      await page.goto(url, { waitUntil: 'networkidle' });
      const announcement = page.getByTestId('route-announcer');
      await expect(announcement).toHaveAttribute('aria-live', 'polite');
      await expect(announcement).toHaveAttribute('aria-atomic', 'true');
      await expect(announcement).not.toBeEmpty();
    });
  });
}
