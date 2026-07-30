import { test, expect } from './fixtures/auth';

const ui = expect.configure({ timeout: 30_000 });

/**
 * V1-762: the folder picker itself only needs a "connected" Dropbox account,
 * which only exists with a live external credential (tracked separately as
 * V1-X01, blocked externally). Route-mock the Dropbox endpoints so the UI
 * flow -- browse, drill into a subfolder, go back, select -- is covered
 * without a real Dropbox account.
 */
test.describe('Dropbox folder picker — mocked connection', () => {
  test('browses subfolders and selects one', async ({ roleSession }) => {
    const { page } = await roleSession('admin');

    let currentFolder = '/incoming';
    await page.route('**/api/v1/system/dropbox', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({
        json: { ok: true, dropbox: { status: 'connected', configured: true, folderPath: currentFolder } },
      });
    });
    await page.route('**/api/v1/system/dropbox/folders*', async (route) => {
      const url = new URL(route.request().url());
      const path = url.searchParams.get('path') || '/';
      const folders =
        path === '/2024'
          ? [{ name: 'january', path: '/2024/january' }]
          : [{ name: '2024', path: '/2024' }, { name: '2023', path: '/2023' }];
      await route.fulfill({ json: { ok: true, folders } });
    });
    await page.route('**/api/v1/system/dropbox/folder', async (route) => {
      const body = route.request().postDataJSON() as { folderPath: string };
      currentFolder = body.folderPath;
      await route.fulfill({
        json: { ok: true, dropbox: { status: 'connected', configured: true, folderPath: currentFolder } },
      });
    });

    await page.goto('/settings');

    await ui(page.getByText('متصل بالمجلد /incoming')).toBeVisible();
    await page.getByRole('button', { name: 'اختيار مجلد' }).click();

    const dialog = page.getByRole('dialog', { name: 'اختيار مجلد Dropbox' });
    await ui(dialog.getByRole('heading', { name: /تصفح مجلدات Dropbox — \// })).toBeVisible();
    await ui(dialog.getByText('2024')).toBeVisible();

    await dialog.getByRole('listitem').filter({ hasText: '2024' }).getByRole('button', { name: 'فتح' }).click();
    await ui(dialog.getByRole('heading', { name: /— \/2024$/ })).toBeVisible();
    await ui(dialog.getByText('january')).toBeVisible();

    await dialog.getByRole('button', { name: 'المجلد السابق' }).click();
    await ui(dialog.getByRole('heading', { name: /— \/$/ })).toBeVisible();

    await dialog.getByRole('listitem').filter({ hasText: '2023' }).getByRole('button', { name: 'فتح' }).click();
    await dialog.getByRole('button', { name: 'اختيار «/2023»' }).click();

    await ui(dialog).toBeHidden();
    await ui(page.getByText('متصل بالمجلد /2023')).toBeVisible();
  });
});
