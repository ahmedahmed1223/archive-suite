import { expect, test } from './fixtures/auth';

/**
 * V3-SET-005: unified settings hub (/settings) -- admin-vs-viewer visibility
 * of the "الإدارة" (Administration) section, and keyboard reachability of
 * the hub's controls. Same shape as keyboard-navigation-authenticated.authed.spec.ts,
 * scoped to the settings hub specifically since it is the one page with a
 * real per-role authorization boundary (admin policy controls) rather than a
 * generic read-only view.
 *
 * Requires the live Laravel + Next harness (`pnpm verify:laravel-next:live`)
 * for the `roleSession` fixture -- see e2e/fixtures/auth.ts.
 */

test.describe('/settings unified hub', () => {
  test('an admin sees the Administration section', async ({ roleSession }) => {
    const { page } = await roleSession('admin');

    await page.goto('/settings', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'الإدارة' })).toBeVisible();
  });

  test('a non-admin never renders the Administration section, not even in the DOM', async ({ roleSession }) => {
    const { page } = await roleSession('viewer');

    await page.goto('/settings', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'الإدارة' })).toHaveCount(0);
    // The unified hub itself (My experience / Media / Notifications) must
    // still render -- this asserts the admin section specifically is absent,
    // not that the whole page failed to load.
    await expect(page.getByRole('heading', { name: 'تجربتي' })).toBeVisible();
  });

  test('tabbing through the settings hub never gets stuck', async ({ roleSession }) => {
    const { page } = await roleSession('admin');

    await page.goto('/settings', { waitUntil: 'networkidle' });
    const hub = page.locator('.settings-hub');
    await hub.waitFor({ state: 'attached' });

    await hub.locator('input, select, button, a[href]').first().focus();

    const seen: string[] = [];
    for (let i = 0; i < 40; i += 1) {
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
    expect(stuck, `settings hub: focus got stuck during Tab traversal: ${JSON.stringify(seen)}`).toBe(false);
  });

  test('a capability toggle is operable with the keyboard alone (Space toggles it)', async ({ roleSession }) => {
    const { page } = await roleSession('admin');

    await page.goto('/settings', { waitUntil: 'networkidle' });

    const mcpToggle = page.locator('#capability-mcp');
    await mcpToggle.waitFor({ state: 'attached' });

    if (await mcpToggle.isDisabled()) {
      // mcp ships adminEditable:false by default (archive-settings.php) --
      // if this deployment has it locked, fall back to a field that is
      // guaranteed interactive: the reduced-motion checkbox in "تجربتي".
      const reducedMotion = page.getByLabel('تقليل الحركة والانتقالات');
      await reducedMotion.focus();
      const before = await reducedMotion.isChecked();
      await page.keyboard.press('Space');
      await expect(reducedMotion).toBeChecked({ checked: !before });
      return;
    }

    await mcpToggle.focus();
    const before = await mcpToggle.isChecked();
    await page.keyboard.press('Space');
    await expect(mcpToggle).toBeChecked({ checked: !before });
  });
});
