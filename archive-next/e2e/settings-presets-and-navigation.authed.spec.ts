import { expect, test } from './fixtures/auth';

/**
 * V3-SET-006: preset profiles, navigation customization, and the acceptance
 * criteria that a preset/hiddenModules choice can never hide a mandatory
 * surface (/settings, /safety-preview) nor show a capability-disabled
 * module. Covers Arabic (default) and English (via the `archive_locale`
 * cookie, the same mechanism LocaleProvider itself writes) at both desktop
 * and mobile viewports.
 *
 * Requires the live Laravel + Next harness (`pnpm verify:laravel-next:live`)
 * for the `roleSession` fixture -- see e2e/fixtures/auth.ts. This file was
 * written and typechecked in this session but NOT executed against a live
 * harness (no Docker/Laravel bring-up was performed) -- see the task report
 * for details.
 */

const BASE_URL = 'http://127.0.0.1:3000';

async function useEnglish(context: import('@playwright/test').BrowserContext) {
  await context.addCookies([{ name: 'archive_locale', value: 'en', url: BASE_URL }]);
}

test.describe('/settings preset profiles (Arabic, desktop)', () => {
  test('shows all four required personas and applying one updates the profile without a reload', async ({ roleSession }) => {
    const { page } = await roleSession('editor');

    await page.goto('/settings', { waitUntil: 'networkidle' });

    await expect(page.getByText('أمين أرشيف')).toBeVisible();
    await expect(page.getByText('مراجع')).toBeVisible();
    await expect(page.getByText('محرر وسائط')).toBeVisible();
    await expect(page.getByText('عرض مبسط')).toBeVisible();

    const homePageInput = page.getByLabel('الصفحة الرئيسية عند الدخول');
    await expect(homePageInput).toBeVisible();

    const applyButtons = page.getByRole('button', { name: 'تطبيق' });
    await applyButtons.first().click(); // "أمين أرشيف" -- homePage: /archive

    // Optimistic update flows straight through ExperienceProfileProvider's
    // context, so "تجربتي"'s homePage field reflects it without navigating.
    await expect(homePageInput).toHaveValue('/archive', { timeout: 10_000 });
  });

  test('a preset can never leave /settings or /safety-preview hidden from navigation', async ({ roleSession }) => {
    const { page } = await roleSession('editor');

    await page.goto('/settings', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'تطبيق' }).nth(3).click(); // "عرض مبسط" -- the most aggressive hider

    await expect(page.getByLabel('الإعدادات', { exact: true })).toBeChecked({ timeout: 10_000 });

    // The mandatory item's checkbox itself must be disabled -- it is not
    // just checked by coincidence, the UI does not let it be unchecked.
    const settingsCheckbox = page.getByLabel('الإعدادات', { exact: true });
    await expect(settingsCheckbox).toBeDisabled();

    // And the nav sidebar itself still carries a working /settings link.
    await expect(page.locator('#app-primary-nav a[href="/settings"]')).toHaveCount(1);
  });
});

test.describe('/settings navigation customization (Arabic, desktop)', () => {
  test('hiding an ordinary module removes it from the sidebar nav immediately', async ({ roleSession }) => {
    const { page } = await roleSession('editor');

    await page.goto('/settings', { waitUntil: 'networkidle' });

    const kanbanToggle = page.getByLabel('كانبان', { exact: true });
    await kanbanToggle.waitFor({ state: 'attached' });
    if (await kanbanToggle.isChecked()) {
      await kanbanToggle.uncheck();
    }

    await expect(page.locator('#app-primary-nav a[href="/kanban"]')).toHaveCount(0, { timeout: 10_000 });

    // Restore it so this test does not leave state for the next one.
    await kanbanToggle.check();
    await expect(page.locator('#app-primary-nav a[href="/kanban"]')).toHaveCount(1, { timeout: 10_000 });
  });

  test('a capability-disabled module is shown locked, not offered as a toggle a user could "turn on"', async ({ roleSession }) => {
    const { page } = await roleSession('editor');

    await page.goto('/settings', { waitUntil: 'networkidle' });

    // semanticSearch ships disabled by default (archive-settings.php) unless
    // this deployment configured it -- branch like settings-hub.authed.spec.ts
    // does for the mcp capability toggle.
    const discoverToggle = page.getByLabel('الاكتشاف', { exact: true });
    await discoverToggle.waitFor({ state: 'attached' });

    if (await discoverToggle.isDisabled()) {
      await expect(discoverToggle).not.toBeChecked();
      await expect(page.getByText('معطّل على هذا النشر').first()).toBeVisible();
    }
  });

  test('reordering a group moves its items in the rendered sidebar', async ({ roleSession }) => {
    const { page } = await roleSession('editor');

    await page.goto('/settings', { waitUntil: 'networkidle' });

    const groupsBefore = await page.locator('.nav-group').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-section')));
    const moveUp = page.getByRole('button', { name: /نقل لأعلى: المكتبة/ });
    await moveUp.click();

    await expect
      .poll(async () => page.locator('.nav-group').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-section'))), {
        timeout: 10_000
      })
      .not.toEqual(groupsBefore);
  });
});

test.describe('/settings preset profiles (English, desktop)', () => {
  test('renders preset names and the navigation customization copy in English', async ({ roleSession }) => {
    const { page, context } = await roleSession('viewer');
    await useEnglish(context);

    await page.goto('/settings', { waitUntil: 'networkidle' });

    await expect(page.getByText('Archivist')).toBeVisible();
    await expect(page.getByText('Reviewer')).toBeVisible();
    await expect(page.getByText('Media editor')).toBeVisible();
    await expect(page.getByText('Simple view')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Navigation customization' })).toBeVisible();
  });
});

test.describe('/settings navigation customization (mobile)', () => {
  test('hiding a daily-nav module removes it from the mobile bottom bar (Arabic)', async ({ roleSession }) => {
    const { page } = await roleSession('editor');
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/settings', { waitUntil: 'networkidle' });

    const inboxToggle = page.getByLabel('الوارد', { exact: true });
    await inboxToggle.waitFor({ state: 'attached' });
    await inboxToggle.uncheck();

    // /uploads is in the "capture" nav section, whose daily routes include
    // /inbox (see dailyRoutes.capture in lib/navigation.ts) -- unlike "/",
    // which is in "library" and would never show /inbox either way.
    await page.goto('/uploads', { waitUntil: 'networkidle' });
    await expect(page.locator('.mobile-primary-nav a[href="/inbox"]')).toHaveCount(0, { timeout: 10_000 });

    // Restore.
    await page.goto('/settings', { waitUntil: 'networkidle' });
    await page.getByLabel('الوارد', { exact: true }).check();
  });

  test('the preset and navigation sections stay operable at mobile width (English)', async ({ roleSession }) => {
    const { page, context } = await roleSession('viewer');
    await useEnglish(context);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/settings', { waitUntil: 'networkidle' });

    await expect(page.getByText('Ready-made profiles')).toBeVisible();
    const applyButton = page.getByRole('button', { name: 'Apply' }).first();
    await expect(applyButton).toBeVisible();
    await applyButton.click();
    await expect(page.getByText('Profile applied.', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
  });
});
