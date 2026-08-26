import { test, expect } from './fixtures/auth';

const ui = expect.configure({ timeout: 15_000 });

/**
 * V15-DAILY-005 live acceptance for the unified work inbox (/work-inbox).
 *
 * The seeded administrator is used because this operational work surface is
 * permission-gated by the canonical backend and the fixture exercises it
 * through a real authenticated account.
 */
test.describe('work inbox — live acceptance', () => {
  test('an administrator reaches the work inbox and can filter to a single source type', async ({ roleSession }) => {
    const { page } = await roleSession('admin');

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

  test('an administrator can load the rights filter, even when it has no items', async ({ roleSession }) => {
    const { page } = await roleSession('admin');

    await page.goto('/work-inbox');

    await ui(page.getByRole('heading', { name: 'عملك كله في مكان واحد' })).toBeVisible();

    const rightsChip = page.getByRole('button', { name: /^الحقوق/ });
    await ui(rightsChip).toBeVisible();
    await rightsChip.click();
    await expect(rightsChip).toHaveAttribute('data-active', 'true');
  });
});
