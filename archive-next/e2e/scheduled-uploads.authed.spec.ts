import { test, expect } from './fixtures/auth';

const ui = expect.configure({ timeout: 30_000 });

/**
 * datetime-local inputs (and this app's validateScheduleTime) treat the value
 * as browser-local wall-clock time, not UTC — `date.toISOString()` returns
 * UTC and silently reads as "in the past" (button stays disabled) whenever
 * the host isn't running in the UTC timezone. Use local getters instead.
 */
function toDatetimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function login(page: import('@playwright/test').Page, account: { email: string; password: string }, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('البريد الإلكتروني').fill(account.email);
  await page.getByRole('textbox', { name: 'كلمة المرور' }).fill(account.password);
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await page.waitForURL(new RegExp(next.replace(/\//g, '\\/') + '$'), { timeout: 30_000 });
}

/**
 * V1-712 Task 9: live acceptance for the durable scheduled-upload feature —
 * schedule/list/reschedule/cancel through the real UI+API, and a due-now
 * schedule actually reaching 'completed' via the live scheduler+worker
 * containers (infra/docker-compose.laravel-next.yml's laravel-scheduler +
 * laravel-worker, V1-712 Task 8), not a mock.
 */
test.describe('scheduled uploads — live acceptance', () => {
  test('schedule a file, see it listed, reschedule it, then cancel it', async ({ roleSession }) => {
    test.setTimeout(120_000);
    const { page, account } = await roleSession('editor');
    await login(page, account, '/uploads');

    await page.setInputFiles('input[type="file"]', {
      name: `e2e-scheduled-${Date.now()}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from('V1-712 live acceptance fixture content'),
    });

    await page.getByRole('button', { name: 'التالي' }).click(); // files -> metadata
    await page.getByLabel('عنوان أو بادئة عنوان').fill('توثيق مجدول حي');
    await page.getByRole('button', { name: 'التالي' }).click(); // metadata -> review

    await page.getByRole('radio', { name: 'جدولة المعالجة' }).check();
    const scheduledAt = toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
    await page.getByLabel('موعد المعالجة').fill(scheduledAt);
    await ui(page.getByRole('button', { name: 'رفع وجدولة' })).toBeEnabled();
    await page.getByRole('button', { name: 'رفع وجدولة' }).click();

    await ui(page.getByText('تمت جدولة المعالجة')).toBeVisible();
    await page.getByRole('link', { name: 'عرض الرفعات المجدولة' }).click();
    await page.waitForURL(/\/uploads\/scheduled$/);

    const row = page.getByRole('listitem').filter({ hasText: `e2e-scheduled-` });
    await ui(row).toBeVisible();
    await ui(row.getByText('مجدولة')).toBeVisible();

    await row.getByRole('button', { name: 'إعادة الجدولة' }).click();
    const newValue = toDatetimeLocalValue(new Date(Date.now() + 2 * 60 * 60 * 1000));
    await page.getByLabel('موعد المعالجة الجديد').fill(newValue);
    await page.getByRole('button', { name: 'حفظ الموعد الجديد' }).click();
    await ui(page.getByLabel('موعد المعالجة الجديد')).toBeHidden();

    await row.getByRole('button', { name: 'إلغاء' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'إلغاء الجدولة' }).click();
    await ui(row.getByText('ملغاة')).toBeVisible();
  });

  test('a due-now schedule reaches completed via the live scheduler and worker', async ({ roleSession }) => {
    test.setTimeout(180_000);
    const { page, account } = await roleSession('editor');
    await login(page, account, '/uploads');

    const fileName = `e2e-due-now-${Date.now()}.txt`;
    await page.setInputFiles('input[type="file"]', {
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('V1-712 due-now live acceptance fixture content'),
    });
    await page.getByRole('button', { name: 'التالي' }).click();
    await page.getByLabel('عنوان أو بادئة عنوان').fill('معالجة فورية عبر الجدولة');
    await page.getByRole('button', { name: 'التالي' }).click();

    await page.getByRole('radio', { name: 'جدولة المعالجة' }).check();
    // Two minutes out: due almost immediately, but with enough margin that the
    // upload/staging round trip before the schedule is actually created can't
    // push it past the API's >= now()-30s validation window.
    const dueNow = toDatetimeLocalValue(new Date(Date.now() + 2 * 60 * 1000));
    await page.getByLabel('موعد المعالجة').fill(dueNow);
    await page.getByRole('button', { name: 'رفع وجدولة' }).click();
    await ui(page.getByText('تمت جدولة المعالجة')).toBeVisible();

    await page.getByRole('link', { name: 'عرض الرفعات المجدولة' }).click();
    await page.waitForURL(/\/uploads\/scheduled$/);

    const row = page.getByRole('listitem').filter({ hasText: fileName });
    // laravel-scheduler dispatches every minute, laravel-worker drains
    // scheduled-uploads immediately after — comfortably done within 2 minutes.
    await expect(row.getByText('مكتملة')).toBeVisible({ timeout: 150_000 });
    await ui(row.getByRole('link', { name: /فتح السجل/ })).toBeVisible();
  });
});
