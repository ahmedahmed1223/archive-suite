import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/auth';
import {
  DYNAMIC_ROUTE_PARAMS,
  ROUTE_COVERAGE,
  type RouteState,
} from './fixtures/route-inventory';

/**
 * V1-303C: axe over the authenticated classified routes.
 *
 * V1-303A (accessibility.spec.ts) covers the public routes. This is its
 * authenticated counterpart: every route in ROUTE_COVERAGE, as the least
 * privileged role that can render it, in each declared state, at the
 * project's three breakpoints plus 200% zoom.
 *
 * The route list is not written here — it comes from the same fixture that
 * route-inventory.spec.ts diffs against the real App Router tree, so a new
 * page cannot end up covered in one file and missing from the other.
 */

const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
] as const;

/** Collection keys the API returns; emptied to force a real empty state. */
const EMPTY_ENVELOPE_KEYS = [
  'records', 'entries', 'jobs', 'rules', 'runs', 'collections', 'types', 'tags',
  'relations', 'shares', 'links', 'projects', 'backups', 'items', 'results',
  'suggestions', 'notifications', 'terms', 'nodes', 'plugins', 'users', 'trash',
];

/**
 * Force a non-ready state by intercepting the API rather than hunting for a
 * UI affordance that triggers it. `ready` passes through untouched so the
 * seeded per-role data is what actually renders.
 */
async function applyState(page: Page, state: RouteState): Promise<void> {
  if (state === 'ready') return;

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();

    // Never stub the session bootstrap: without it the app falls back to the
    // guest shell and we would be auditing the login redirect, not the route.
    if (/\/auth\/(refresh|me|login)/.test(request.url())) {
      await route.fallback();
      return;
    }

    if (state === 'loading') {
      // Hang the data request so the route stays in its pending state while
      // axe runs. The context teardown in the fixture releases it.
      await new Promise(() => {});
      return;
    }

    if (state === 'error') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, code: 'INTERNAL', error: 'حدث خطأ في الخادم.' }),
      });
      return;
    }

    // empty: keep the ok envelope but drain every collection it may carry, so
    // pages render their real empty state instead of an error.
    const body: Record<string, unknown> = { ok: true };
    for (const key of EMPTY_ENVELOPE_KEYS) body[key] = [];
    body.pagination = { total: 0, page: 1, limit: 50, hasMore: false };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function auditAxe(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

  const seriousOrWorse = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );

  expect(
    seriousOrWorse,
    `${label}\n${seriousOrWorse.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`).join('\n')}`,
  ).toEqual([]);
}

/** `loading` never reaches networkidle by design — it is a hung request. */
async function visit(page: Page, url: string, state: RouteState): Promise<void> {
  await page.goto(url, {
    waitUntil: state === 'loading' ? 'domcontentloaded' : 'networkidle',
  });
}

for (const viewport of VIEWPORTS) {
  test.describe(`authenticated a11y @ ${viewport.name}`, () => {
    for (const coverage of ROUTE_COVERAGE) {
      for (const state of coverage.states) {
        test(`${coverage.route} [${coverage.role}/${state}] has no serious/critical axe violations`, async ({
          roleSession,
        }) => {
          const session = await roleSession(coverage.role);
          const { page, data } = session;

          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await applyState(page, state);

          const resolve = DYNAMIC_ROUTE_PARAMS[coverage.route];
          const url = resolve ? resolve({ recordUid: data.recordUid }) : coverage.url;

          await visit(page, url, state);
          await auditAxe(page, `${url} [${coverage.role}/${state}] @ ${viewport.name}`);
        });
      }
    }
  });
}

/**
 * WCAG 1.4.4 / 1.4.10: at 200% zoom the 1280 layout must not lose content or
 * introduce violations. Emulated the way the criterion is actually assessed —
 * halving the CSS viewport at the same device scale — on the `ready` state,
 * where there is real content to reflow.
 */
test.describe('authenticated a11y @ desktop-1280 zoom-200%', () => {
  for (const coverage of ROUTE_COVERAGE) {
    test(`${coverage.route} [${coverage.role}] has no serious/critical axe violations at 200% zoom`, async ({
      roleSession,
    }) => {
      const session = await roleSession(coverage.role);
      const { page, data } = session;

      await page.setViewportSize({ width: 640, height: 400 });

      const resolve = DYNAMIC_ROUTE_PARAMS[coverage.route];
      const url = resolve ? resolve({ recordUid: data.recordUid }) : coverage.url;

      await visit(page, url, 'ready');
      await auditAxe(page, `${url} [${coverage.role}/ready] @ 200% zoom`);
    });
  }
});
