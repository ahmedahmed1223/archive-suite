import { expect, test } from './fixtures/auth';
import { ROLE_NAMES } from './fixtures/roles';

/**
 * V1-303B contract test for the role fixture itself.  This intentionally uses
 * rendered pages (rather than an admin API token) so a stale or cross-role
 * storage state cannot masquerade as a valid session.
 */
for (const role of ROLE_NAMES) {
  test(`${role} session renders its own identity and provisioned record/rights`, async ({ roleSession }) => {
    const { account, data, page } = await roleSession(role);

    await page.goto('/');
    await expect(page.locator('.workspace-commandbar__user')).toContainText(account.name);

    await page.goto(`/archive/${encodeURIComponent(data.recordUid)}`);
    await expect(page.getByRole('heading', { name: data.recordTitle })).toBeVisible();
    await expect(page.getByText(data.rightsItemId, { exact: true }).first()).toBeVisible();
  });
}

test('only the admin fixture can render the global backup surface', async ({ roleSession }) => {
  const admin = await roleSession('admin');
  await admin.page.goto('/backup');
  await expect(admin.page.getByRole('heading', { name: 'النسخ الاحتياطي والاستعادة' })).toBeVisible();

  for (const role of ['editor', 'viewer'] as const) {
    const session = await roleSession(role);
    await session.page.goto('/backup');
    await expect(
      session.page.getByText('هذه الصفحة متاحة للمشرفين فقط.', { exact: true }),
      `${role} must receive the API's admin-only backup denial`,
    ).toBeVisible();
  }
});
