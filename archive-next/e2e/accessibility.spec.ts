import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { CORE_ROUTES, VIEWPORTS } from './fixtures/visual-routes';

// V1-303/V1-401: automated axe-core gate for the canonical routes, at the
// project's required breakpoints (375/768/1280).

for (const viewport of VIEWPORTS) {
  test.describe(`a11y @ ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of CORE_ROUTES) {
      test(`${route} has no serious/critical axe violations`, async ({ page }) => {
        await page.goto(route, { waitUntil: 'networkidle' });

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa'])
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
  });
}
