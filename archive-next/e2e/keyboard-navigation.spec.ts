import { expect, test } from '@playwright/test';
import { WHATS_NEW_RELEASE, WHATS_NEW_STORAGE_KEY } from '../lib/whats-new';

/**
 * V1-303D: keyboard navigation — skip link + no keyboard dead-end.
 *
 * Two checks, both real browser keyboard semantics — not achievable in
 * jsdom/Vitest, which is why this lives here rather than in
 * ConfirmDialog.test.tsx:
 *
 * 1. Skip link — the very first Tab press must land on the skip link
 *    (`AppShell.tsx`'s `<a class="skip-link" href="#main-content">`), and
 *    activating it must move focus to `<main id="main-content" tabIndex={-1}>`
 *    so keyboard users can bypass the nav on every page load.
 * 2. No keyboard dead-end — repeated Tab presses must keep moving focus
 *    (`document.activeElement` changes every time). A dead end — focus stuck
 *    on one element, or silently dropping to `<body>` mid-page — is the
 *    generic signature of a focus trap bug outside of an intentional modal.
 *
 * Route scope: CORE_ROUTES (fixtures/visual-routes.ts) was tried first and
 * dropped — every one of those routes requires an authenticated session and
 * client-side redirects to /login without one (confirmed: even /help, which
 * has no auth logic of its own, still goes through AppShell's session
 * bootstrap and redirects). /login itself has no skip-link at all — it's a
 * deliberately separate, chrome-less layout with no nav to skip. So the only
 * route that's both genuinely public (works for a guest, no redirect) *and*
 * wrapped in AppShell (has real nav + a skip-link) is /first-run — the
 * onboarding wizard, which is exactly what V1-303D names first. The
 * authenticated pages V1-303D also names (archive/record/upload/search/
 * admin) are covered against a live session in
 * keyboard-navigation-authenticated.authed.spec.ts instead.
 */

const PUBLIC_APPSHELL_ROUTES = ['/first-run'];

test.describe('keyboard navigation: skip link + no dead-end tabbing', () => {
  test.beforeEach(async ({ context }) => {
    // Suppress the auto-opening What's New dialog a fresh profile would
    // show — it correctly traps focus (Radix dialog, WCAG-compliant), which
    // would otherwise take the first Tab stop instead of the skip link this
    // suite is testing. Same pattern as next-laravel-integration.spec.ts.
    await context.addInitScript(
      ([key, release]) => {
        window.localStorage.setItem(key, release);
      },
      [WHATS_NEW_STORAGE_KEY, WHATS_NEW_RELEASE] as const,
    );
  });

  for (const route of PUBLIC_APPSHELL_ROUTES) {
    test(`${route}: skip link is the first tab stop and moves focus to main content`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'networkidle' });
      // networkidle fires once requests settle, not once React hydration
      // finishes — several routes show a brief loading state first. Wait
      // for the skip link to actually attach before asserting on it.
      await page.locator('.skip-link').waitFor({ state: 'attached' });

      await page.keyboard.press('Tab');
      const skipLinkFocused = await page.evaluate(() => {
        const active = document.activeElement;
        return active?.classList.contains('skip-link') ?? false;
      });
      expect(skipLinkFocused, `${route}: first Tab press did not land on the skip link`).toBe(true);

      await page.keyboard.press('Enter');
      const mainFocused = await page.evaluate(() => document.activeElement?.id === 'main-content');
      expect(mainFocused, `${route}: activating the skip link did not move focus to #main-content`).toBe(true);
    });

    test(`${route}: tabbing through the page never gets stuck`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'networkidle' });
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

      // A dead end shows up as the same non-body signature repeating back to
      // back — the browser gave up moving focus forward. Cycling back to an
      // earlier stop (a short page with fewer than 20 focusable elements) is
      // normal and not a bug, so only immediate repeats are flagged.
      const stuck = seen.some((signature, index) => index > 0 && signature !== 'body' && signature === seen[index - 1]);
      expect(stuck, `${route}: focus got stuck during Tab traversal: ${JSON.stringify(seen)}`).toBe(false);
    });

    test(`${route}: command dialog traps focus and Escape returns it to its trigger`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'networkidle' });
      const trigger = page.getByRole('button', { name: 'فتح لوحة الأوامر' });
      await trigger.click();

      const dialog = page.getByRole('dialog', { name: 'لوحة أوامر مسار' });
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Tab');
      await expect(dialog).toContainText('إجراءات سريعة');
      const focusIsInsideDialog = await page.evaluate(() => {
        const dialogElement = document.querySelector<HTMLElement>('[role="dialog"]');
        return Boolean(dialogElement?.contains(document.activeElement));
      });
      expect(focusIsInsideDialog).toBe(true);

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  }
});
