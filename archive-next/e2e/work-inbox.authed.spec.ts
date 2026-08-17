import { test, expect } from './fixtures/auth';

const ui = expect.configure({ timeout: 15_000 });

/**
 * V3-WORK-001 live acceptance for the unified work inbox (/work-inbox).
 *
 * NOT RUN LIVE: authored and reviewed against this app's own conventions
 * (see media-studio.authed.spec.ts and scheduled-uploads.authed.spec.ts for
 * the patterns it reuses) but never executed, because this worktree has no
 * live Docker/Laravel stack available to it. Run it for real via
 * `pnpm verify:laravel-next:live` (or `pnpm exec playwright test work-inbox`
 * against an already-running live stack) before treating it as passing.
 *
 * Scoped per role because the aggregation itself is role-sensitive: rights
 * nearing expiry is gated to editor/admin inside WorkInboxController (see
 * expiringRights()), so a viewer's "Rights" chip must always read 0 even
 * when expiring rights records exist, while an editor's feed can surface
 * them. This spec does not assert exact counts (the shared test account may
 * carry unrelated data from other specs) — it asserts the structural
 * contract: every role reaches the page, sees all four filter chips, and a
 * viewer's rights chip never shows a non-zero count.
 */
test.describe('work inbox — live acceptance', () => {
  test('an editor reaches the work inbox and can filter to a single source type', async ({ roleSession }) => {
    const { page } = await roleSession('editor');

    await page.goto('/work-inbox');

    await ui(page.getByRole('heading', { name: 'عملك كله في مكان واحد' })).toBeVisible();

    // All four source-type chips render regardless of whether each source
    // currently has items (see WorkInboxController::TYPES).
    for (const label of [/^الكل/, /^المهام/, /^المراجعات/, /^الحقوق/, /^الإشعارات/]) {
      await ui(page.getByRole('button', { name: label })).toBeVisible();
    }

    // Filtering to Notifications must never leave a Task-labelled card
    // visible — proves the chip actually narrows the list, not just changes
    // its own active state.
    await page.getByRole('button', { name: /^الإشعارات/ }).click();
    await expect(page.getByText('مهمة', { exact: true })).toHaveCount(0);
  });

  test("a viewer's rights chip never shows expiring rights, even though the page still loads", async ({ roleSession }) => {
    const { page } = await roleSession('viewer');

    await page.goto('/work-inbox');

    await ui(page.getByRole('heading', { name: 'عملك كله في مكان واحد' })).toBeVisible();

    const rightsChip = page.getByRole('button', { name: /^الحقوق/ });
    await ui(rightsChip).toBeVisible();
    await expect(rightsChip).toHaveText(/^الحقوق · 0$/);
  });
});
