import { expect, test } from './fixtures/auth';
import { WHATS_NEW_RELEASE, WHATS_NEW_STORAGE_KEY } from '../lib/whats-new';

const ui = expect.configure({ timeout: 15_000 });
const requested = new Set(
  (process.env.ARCHIVE_ACCEPTANCE_SCENARIO_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
);
const enabled = (id: string) => requested.size === 0 || requested.has(id);

function canonicalAcknowledgementIsAvailable(): void {
  if (!WHATS_NEW_STORAGE_KEY || !WHATS_NEW_RELEASE) throw new Error('canonical Whats New acknowledgement constants are required');
}

test('V1-IA-ARCH-001 editor logs in live, searches, and opens its provisioned record', async ({ roleSession }, testInfo) => {
  test.skip(!enabled('V1-IA-ARCH-001'), 'selected acceptance scenario differs');
  canonicalAcknowledgementIsAvailable();
  const { account, data, page } = await roleSession('editor');
  await page.goto('/search', { waitUntil: 'networkidle' });
  const searchBox = page.getByRole('combobox', { name: 'اقتراحات البحث' });
  await ui(searchBox).toBeVisible();
  await searchBox.fill(data.recordTitle);
  await page.getByRole('button', { name: 'بحث', exact: true }).click();
  const resultCard = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: data.recordTitle }),
  });
  await ui(resultCard.getByRole('heading', { name: data.recordTitle })).toBeVisible();
  await resultCard.getByRole('link', { name: 'فتح التفاصيل' }).click();
  await ui(page).toHaveURL(new RegExp(`/archive/${encodeURIComponent(data.recordUid)}$`));
  await ui(page.locator('.workspace-commandbar__user')).toContainText(account.name);
  await page.screenshot({ path: testInfo.outputPath('archive-search-open.png'), fullPage: true });
});

test('V1-IA-ADMIN-001 admin reads a live healthy system status surface', async ({ roleSession }, testInfo) => {
  test.skip(!enabled('V1-IA-ADMIN-001'), 'selected acceptance scenario differs');
  canonicalAcknowledgementIsAvailable();
  const { account, page } = await roleSession('admin');
  await page.goto('/status', { waitUntil: 'networkidle' });
  await ui(page.getByRole('heading', { name: 'حالة النظام' })).toBeVisible();
  await ui(page.getByRole('status')).toContainText('اتصال الخادم سليم');
  await ui(page.locator('.workspace-commandbar__user')).toContainText(account.name);
  await page.screenshot({ path: testInfo.outputPath('admin-health.png'), fullPage: true });
});

test('V1-IA-MULTI-001 editor and viewer use simultaneous isolated live sessions', async ({ roleSession }, testInfo) => {
  test.skip(!enabled('V1-IA-MULTI-001'), 'selected acceptance scenario differs');
  canonicalAcknowledgementIsAvailable();
  const [editor, viewer] = await Promise.all([roleSession('editor'), roleSession('viewer')]);
  expect(editor.context).not.toBe(viewer.context);
  expect(editor.account.email).not.toBe(viewer.account.email);
  await Promise.all([
    editor.page.goto(`/archive/${encodeURIComponent(editor.data.recordUid)}`, { waitUntil: 'networkidle' }),
    viewer.page.goto(`/archive/${encodeURIComponent(viewer.data.recordUid)}`, { waitUntil: 'networkidle' }),
  ]);
  await Promise.all([
    ui(editor.page.getByRole('heading', { name: editor.data.recordTitle })).toBeVisible(),
    ui(viewer.page.getByRole('heading', { name: viewer.data.recordTitle })).toBeVisible(),
  ]);
  await Promise.all([
    editor.page.screenshot({ path: testInfo.outputPath('multi-editor.png'), fullPage: true }),
    viewer.page.screenshot({ path: testInfo.outputPath('multi-viewer.png'), fullPage: true }),
  ]);
});
