import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { isPublicPath } from '../../proxy';

/**
 * V1-303A/E: the project's required breakpoints and the core routes exercised
 * at each of them. Shared by accessibility.spec.ts (axe) and
 * visual-regression.spec.ts (overflow + screenshot evidence) so the two gates
 * can never drift onto different route lists.
 *
 * Routes below don't require a live Laravel backend or auth cookie (see
 * next-migration-shell.spec.ts) — that is what keeps them usable as the
 * baseline "core routes" set for gates that run without a backend.
 *
 * V1-817: this list used to also carry '/', '/help', '/reports', '/settings',
 * '/archive' and '/media/jobs'. None of those is public — proxy.ts redirects
 * every path outside `publicPathPrefixes` to /login when the session cookie is
 * absent, so the unauthenticated gates were measuring overflow, clipped
 * controls and axe violations on the login page while reporting a pass per
 * route. All six are already covered with a real session, at these same three
 * viewports, by ROUTE_COVERAGE in fixtures/route-inventory.ts. The import-time
 * check below keeps the two lists from drifting apart again.
 */

export const CORE_ROUTES = ['/login', '/share/demo-token'];

for (const route of CORE_ROUTES) {
  if (!isPublicPath(route)) {
    throw new Error(
      `CORE_ROUTES contains "${route}", which proxy.ts redirects to /login without a session. ` +
        'Unauthenticated gates would silently assert against the login page — cover it in ' +
        'ROUTE_COVERAGE (fixtures/route-inventory.ts) instead.',
    );
  }
}

/**
 * Navigates and proves the route rendered itself rather than a redirect target.
 * The import-time check above catches a bad CORE_ROUTES entry; this catches the
 * other direction — an app-side redirect (auth, feature flag, rewrite) that
 * makes a genuinely public route stop being one.
 */
export async function gotoPublicRoute(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: 'networkidle' });

  const pathname = new URL(page.url()).pathname;

  expect(pathname, `${route}: navigation landed on ${pathname} — the gate would assert against the wrong page`).toBe(
    route,
  );
}

export const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
] as const;

/**
 * V1-303E: the "essential action out of reach" half of the visual-regression
 * gate, distinct from the document-level scrollWidth check. A container can
 * clip its own overflow (`overflow: hidden`) without ever growing
 * `document.documentElement.scrollWidth` — an action rendered inside such a
 * container can be genuinely unreachable while the page-level overflow check
 * stays green. This walks every visible, interactive element (buttons, links,
 * inputs, selects, and explicit `role="button"`) and asserts its bounding box
 * sits within the horizontal viewport — the generic, page-agnostic form of
 * "no essential action out of reach" the task asks for, since enumerating a
 * hand-picked "essential" element per route would need constant upkeep as
 * pages change.
 */
export async function assertNoClippedInteractiveElements(
  page: Page,
  viewportWidth: number,
  label: string,
): Promise<void> {
  const boxes = await page.evaluate(() => {
    const elements = document.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [role="button"]',
    );
    const results: Array<{ text: string; left: number; right: number }> = [];
    for (const element of elements) {
      const style = window.getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      results.push({
        text: (element.textContent || element.getAttribute('aria-label') || element.tagName).trim().slice(0, 60),
        left: rect.left,
        right: rect.right,
      });
    }
    return results;
  });

  const outOfReach = boxes.filter((box) => box.left < -1 || box.right > viewportWidth + 1);

  expect(
    outOfReach,
    `${label}: interactive element(s) rendered outside the visible viewport width (${viewportWidth}px):\n` +
      outOfReach.map((box) => `"${box.text}" left=${box.left} right=${box.right}`).join('\n'),
  ).toEqual([]);
}
