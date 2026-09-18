import { expect, test } from './fixtures/auth';
import { VIEWPORTS } from './fixtures/visual-routes';
import { dataCenter } from '../lib/i18n/dictionaries/ar/pages/dataCenter';
import { reports } from '../lib/i18n/dictionaries/ar/pages/reports';
import { settingsUsers } from '../lib/i18n/dictionaries/ar/pages/settingsUsers';
import { status } from '../lib/i18n/dictionaries/ar/pages/status';
import { systemControl } from '../lib/i18n/dictionaries/ar/pages/systemControl';

/**
 * V2-UX-002: the "no permission" state, which the visual and axe gates never
 * exercised. ROUTE_COVERAGE deliberately visits every route as the LEAST
 * privileged role that can render it, so an admin surface is only ever seen by
 * an admin — nobody had looked at what a viewer gets. The answer, before this
 * spec existed, was three different wrong things: a retryable error banner on
 * /reports and /settings/users (retrying a refusal the server repeats every
 * time), and three panels silently vanishing on /status.
 *
 * Copy comes from the shipped dictionary, not a local copy, so rewording the
 * page cannot leave this asserting a string no user ever sees.
 */

const ADMIN_ONLY_SURFACES = [
  { url: '/reports', name: 'reports', heading: reports.forbidden.title },
  { url: '/settings/users', name: 'settings-users', heading: settingsUsers.forbiddenTitle },
  { url: '/status', name: 'status', heading: status.metrics.forbiddenTitle },
  { url: '/system/control', name: 'system-control', heading: systemControl.forbiddenTitle },
  { url: '/data-center', name: 'data-center', heading: dataCenter.forbidden },
] as const;

// Desktop and phone only: the acceptance asks for both, and the two
// intermediate widths add no new branch for a text banner.
const SIZES = VIEWPORTS.filter((viewport) => viewport.name === 'desktop-1280' || viewport.name === 'mobile-375');

for (const viewport of SIZES) {
  test.describe(`no-permission surface @ ${viewport.name}`, () => {
    for (const surface of ADMIN_ONLY_SURFACES) {
      test(`${surface.url} tells a viewer why, instead of failing`, async ({ roleSession }) => {
        const { page } = await roleSession('viewer');
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(surface.url, { waitUntil: 'networkidle' });

        await expect(
          page.getByText(surface.heading, { exact: true }),
          `${surface.url} @ ${viewport.name}: a viewer is not told this surface is admin-only`,
        ).toBeVisible();

        // A refusal must never be dressed up as a fault the user can retry.
        await expect(
          page.locator('.state-banner-error'),
          `${surface.url} @ ${viewport.name}: permission refusal rendered as a retryable error`,
        ).toHaveCount(0);

        await page.screenshot({
          path: `visual-evidence/denied--${surface.name}--viewer--${viewport.name}.png`,
          fullPage: true,
        });
      });
    }
  });
}
