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

test('V1-IA-ADMIN-003 administrator completes the local operating journey', async ({ roleSession }, testInfo) => {
  test.skip(!enabled('V1-IA-ADMIN-003'), 'selected acceptance scenario differs');
  const { page } = await roleSession('admin');
  const checkpoints = [
    ['/data-center', 'مركز البيانات'],
    ['/status', 'حالة النظام'],
    ['/backup', 'النسخ الاحتياطي'],
    ['/activity', 'سجل النشاط'],
    ['/settings', 'الإعدادات'],
  ] as const;
  for (const [path, label] of checkpoints) {
    await page.goto(path, { waitUntil: 'networkidle' });
    await ui(page.getByText(label, { exact: false }).first()).toBeVisible();
  }
  await page.screenshot({ path: testInfo.outputPath('admin-operating-journey.png'), fullPage: true });
});

test('V1-IA-ARCH-002 archivist completes local intake, discovery, and collection journey', async ({ roleSession }, testInfo) => {
  test.skip(!enabled('V1-IA-ARCH-002'), 'selected acceptance scenario differs');
  const { data, page } = await roleSession('editor');
  await page.goto('/uploads', { waitUntil: 'networkidle' });
  await ui(page.getByRole('region', { name: 'إضافة مادة للأرشيف' })).toBeVisible();
  await page.goto('/search', { waitUntil: 'networkidle' });
  const searchBox = page.getByRole('combobox', { name: 'اقتراحات البحث' });
  await ui(searchBox).toBeVisible();
  await searchBox.fill(data.recordTitle);
  await page.getByRole('button', { name: 'بحث', exact: true }).click();
  await ui(page.getByRole('article').filter({ hasText: data.recordTitle })).toBeVisible();
  await page.goto('/collections', { waitUntil: 'networkidle' });
  await ui(page.getByText('المجموعات', { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('archivist-operating-journey.png'), fullPage: true });
});

test('V1-IA-MULTI-002 admin, editor, and viewer retain isolated concurrent workspaces', async ({ roleSession }, testInfo) => {
  test.skip(!enabled('V1-IA-MULTI-002'), 'selected acceptance scenario differs');
  const [admin, editor, viewer] = await Promise.all([roleSession('admin'), roleSession('editor'), roleSession('viewer')]);
  expect(new Set([admin.context, editor.context, viewer.context]).size).toBe(3);
  await Promise.all([
    admin.page.goto('/activity', { waitUntil: 'networkidle' }),
    editor.page.goto(`/archive/${encodeURIComponent(editor.data.recordUid)}`, { waitUntil: 'networkidle' }),
    viewer.page.goto(`/archive/${encodeURIComponent(viewer.data.recordUid)}`, { waitUntil: 'networkidle' }),
  ]);
  await Promise.all([
    ui(admin.page.getByText('سجل النشاط', { exact: false }).first()).toBeVisible(),
    ui(editor.page.getByRole('heading', { name: editor.data.recordTitle })).toBeVisible(),
    ui(viewer.page.getByRole('heading', { name: viewer.data.recordTitle })).toBeVisible(),
  ]);
  await Promise.all([
    admin.page.screenshot({ path: testInfo.outputPath('multi-admin.png'), fullPage: true }),
    editor.page.screenshot({ path: testInfo.outputPath('multi-editor-journey.png'), fullPage: true }),
    viewer.page.screenshot({ path: testInfo.outputPath('multi-viewer-journey.png'), fullPage: true }),
  ]);
});
