import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { CORE_ROUTES, gotoPublicRoute, VIEWPORTS } from './fixtures/visual-routes';
import { WHATS_NEW_RELEASE, WHATS_NEW_STORAGE_KEY } from '../lib/whats-new';

// V1-303/V1-401: automated axe-core gate for the canonical routes, at the
// project's required breakpoints (375/768/1280).
// V2-806/V2-807: wcag22aa adds the target-size rule (24x24px minimum touch
// target, WCAG 2.5.8) on top of the existing 2.x AA checks.

for (const viewport of VIEWPORTS) {
  test.describe(`a11y @ ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of CORE_ROUTES) {
      test(`${route} has no serious/critical axe violations`, async ({ page }) => {
        await gotoPublicRoute(page, route);

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
          .analyze();

        const seriousOrWorse = results.violations.filter(
          (violation) => violation.impact === 'serious' || violation.impact === 'critical',
        );

        expect(
          seriousOrWorse,
          seriousOrWorse.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`).join('\n'),
        ).toEqual([]);
      });
    }

    test('Focus Command shell exposes the command entry without serious/critical axe violations', async ({ page, context }) => {
      await context.addInitScript(
        ([key, release]) => window.localStorage.setItem(key, release),
        [WHATS_NEW_STORAGE_KEY, WHATS_NEW_RELEASE] as const,
      );
      await page.goto('/first-run', { waitUntil: 'networkidle' });

      const commandEntry = viewport.width <= 375
        ? page.getByTestId('mobile-command-palette-trigger')
        : page.getByRole('button', { name: 'بحث، فتح صفحة، أو تنفيذ أمر' });
      await expect(commandEntry).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze();
      const seriousOrWorse = results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );

      expect(
        seriousOrWorse,
        seriousOrWorse.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`).join('\n'),
      ).toEqual([]);
    });
  });
}
