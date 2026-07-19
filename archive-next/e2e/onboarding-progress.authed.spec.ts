import { test, expect } from './fixtures/auth';

const ui = expect.configure({ timeout: 30_000 });

test('admin onboarding progress waits for the server, retries, and persists the complete journey', async ({ roleSession }) => {
  test.setTimeout(120_000);
  const { page, account } = await roleSession('admin');
  await page.goto('/login?next=%2Ffirst-run');
  await page.getByLabel('البريد الإلكتروني').fill(account.email);
  await page.getByRole('textbox', { name: 'كلمة المرور' }).fill(account.password);
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await page.waitForURL(/\/first-run$/, { timeout: 30_000 });

  // Idempotency: a reused DB carries the completed stages this test persists.
  // Un-complete any stage before asserting the pristine journey.
  await ui(page.getByRole('heading', { name: 'مراحل أول استخدام المؤسسة' })).toBeVisible();
  const undoButtons = page.getByRole('button', { name: /^إلغاء إكمال / });
  while ((await undoButtons.count()) > 0) {
    await undoButtons.first().click();
    await page.waitForTimeout(500);
  }

  const organization = page.getByRole('button', { name: 'إكمال إعداد المؤسسة' });
  await ui(organization).toHaveAttribute('aria-pressed', 'false');

  await page.route('**/api/v1/onboarding/progress/organization', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'تعذر الحفظ مؤقتاً.' }) });
      return;
    }
    await route.continue();
  });
  await organization.click();
  await ui(page.getByText('تعذر الحفظ مؤقتاً.')).toBeVisible();
  await page.unroute('**/api/v1/onboarding/progress/organization');

  await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
  await ui(organization).toHaveAttribute('aria-pressed', 'false');
  await organization.click();
  await ui(organization).toHaveAttribute('aria-pressed', 'true');

  for (const title of ['تأكيد التخزين', 'دعوة الفريق', 'إضافة أول مادة', 'إجراء أول بحث']) {
    const stage = page.getByRole('button', { name: `إكمال ${title}` });
    await ui(stage).toHaveAttribute('aria-pressed', 'false');
    await stage.click();
    await ui(stage).toHaveAttribute('aria-pressed', 'true');
  }

  await page.reload();
  await page.goto('/login?next=%2Ffirst-run');
  await page.getByLabel('البريد الإلكتروني').fill(account.email);
  await page.getByRole('textbox', { name: 'كلمة المرور' }).fill(account.password);
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await page.waitForURL(/\/first-run$/, { timeout: 30_000 });
  for (const title of ['إعداد المؤسسة', 'تأكيد التخزين', 'دعوة الفريق', 'إضافة أول مادة', 'إجراء أول بحث']) {
    await ui(page.getByRole('button', { name: `إلغاء إكمال ${title}` })).toHaveAttribute('aria-pressed', 'true');
  }
});
