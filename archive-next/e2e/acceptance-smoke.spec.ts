import { expect, test } from './fixtures/auth';
import { WHATS_NEW_RELEASE, WHATS_NEW_STORAGE_KEY } from '../lib/whats-new';

const ui = expect.configure({ timeout: 15_000 });
const requestedScenario = process.env.ARCHIVE_ACCEPTANCE_SCENARIO_ID;

function includesScenario(id: string): boolean {
  return !requestedScenario || requestedScenario === id;
}

function assertAcknowledgementContract(): void {
  // roleSession imports these same canonical constants and seeds them with
  // addInitScript before navigation. This guard prevents the acceptance spec
  // from silently drifting to a handwritten acknowledgement value.
  if (!WHATS_NEW_STORAGE_KEY || !WHATS_NEW_RELEASE) {
    throw new Error('canonical Whats New acknowledgement constants are required');
  }
}

test('V1-IA-ARCH-001 editor logs in live, searches, and opens its provisioned record', async ({ roleSession }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'smoke budget permits one desktop browser execution per scenario');
  test.skip(!includesScenario('V1-IA-ARCH-001'), 'selected acceptance scenario differs');
  assertAcknowledgementContract();

  const { account, data, page } = await roleSession('editor');
  await page.goto('/search', { waitUntil: 'networkidle' });
  const searchBox = page.getByRole('combobox', { name: 'اقتراحات البحث' });
  await ui(searchBox).toBeVisible();
  await searchBox.fill(data.recordTitle);
  await page.getByRole('button', { name: 'بحث', exact: true }).click();
  await ui(page.getByRole('heading', { name: data.recordTitle })).toBeVisible();
  await page.getByRole('link', { name: 'فتح التفاصيل' }).click();
  await ui(page).toHaveURL(new RegExp(`/archive/${encodeURIComponent(data.recordUid)}$`));
  await ui(page.getByRole('heading', { name: data.recordTitle })).toBeVisible();
  await ui(page.locator('.workspace-commandbar__user')).toContainText(account.name);
  await page.screenshot({ path: testInfo.outputPath('archive-search-open.png'), fullPage: true });
});

test('V1-IA-ADMIN-001 admin reads a live healthy system status surface', async ({ roleSession }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'smoke budget permits one desktop browser execution per scenario');
  test.skip(!includesScenario('V1-IA-ADMIN-001'), 'selected acceptance scenario differs');
  assertAcknowledgementContract();

  const { account, page } = await roleSession('admin');
  await page.goto('/status', { waitUntil: 'networkidle' });
  await ui(page.getByRole('heading', { name: 'حالة النظام' })).toBeVisible();
  await ui(page.getByRole('status')).toContainText('الاتصال بالخادم مستقر');
  await ui(page.getByText('الخادم الخلفي', { exact: true })).toBeVisible();
  await ui(page.locator('.workspace-commandbar__user')).toContainText(account.name);
  await page.screenshot({ path: testInfo.outputPath('admin-health.png'), fullPage: true });
});

test('V1-IA-MULTI-001 editor and viewer use simultaneous isolated live sessions', async ({ roleSession }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'smoke budget permits one desktop browser execution per scenario');
  test.skip(!includesScenario('V1-IA-MULTI-001'), 'selected acceptance scenario differs');
  assertAcknowledgementContract();

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
    ui(editor.page.locator('.workspace-commandbar__user')).toContainText(editor.account.name),
    ui(viewer.page.locator('.workspace-commandbar__user')).toContainText(viewer.account.name),
  ]);
  await Promise.all([
    editor.page.screenshot({ path: testInfo.outputPath('multi-editor.png'), fullPage: true }),
    viewer.page.screenshot({ path: testInfo.outputPath('multi-viewer.png'), fullPage: true }),
  ]);
});
