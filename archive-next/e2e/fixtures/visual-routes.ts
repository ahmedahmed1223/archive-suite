import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * V1-303A/E: the project's required breakpoints and the core routes exercised
 * at each of them. Shared by accessibility.spec.ts (axe) and
 * visual-regression.spec.ts (overflow + screenshot evidence) so the two gates
 * can never drift onto different route lists.
 *
 * Routes below don't require a live Laravel backend or auth cookie (see
 * next-migration-shell.spec.ts) — that is what keeps them usable as the
 * baseline "core routes" set for gates that run without a backend.
 */

export const CORE_ROUTES = [
  '/',
  '/login',
  '/help',
  '/reports',
  '/settings',
  '/archive',
  '/share/demo-token',
  '/media/jobs',
];

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
