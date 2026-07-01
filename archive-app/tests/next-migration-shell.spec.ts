import { expect, test } from '@playwright/test';

test('renders the Next.js migration shell with API contract status', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.brand strong')).toHaveText('Archive Suite');
  await expect(page.getByRole('heading', { name: 'واجهة Archive Suite المعتمدة فوق Laravel API.' })).toBeVisible();
  await expect(page.getByLabel('حالة الترحيل')).toContainText('عقد API');
  await expect(page.getByLabel('حالة الترحيل')).toContainText('HttpOnly refresh cookie');
  await expect(page.getByText(/\d+ مسار API/)).toBeVisible();
});

test('renders the Next.js login migration screen', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: /تسجيل دخول Next\.js/ })).toBeVisible();
  await expect(page.getByLabel('البريد الإلكتروني')).toBeVisible();
  await expect(page.getByLabel('كلمة المرور')).toBeVisible();
  await expect(page.getByRole('button', { name: 'تسجيل الدخول' })).toBeVisible();
  await expect(page.getByText('va_refresh')).toBeVisible();
});

test('renders the Next.js public share viewer route', async ({ page }) => {
  await page.goto('/share/demo-token', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'عارض المشاركة العامة.' })).toBeVisible();
  await expect(page.getByLabel('عارض المشاركة')).toContainText('demo-token');
  await expect(page.getByText('/api/v1/share/:token')).toBeVisible();
});

test('renders the Next.js help migration route', async ({ page }) => {
  await page.goto('/help', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'مركز مساعدة Next.js' })).toBeVisible();
  await expect(page.getByLabel('مركز مساعدة Next.js')).toContainText('مسار منخفض المخاطر');
  await expect(page.getByText('عقود API')).toBeVisible();
});

test('renders the Next.js reports migration route', async ({ page }) => {
  await page.goto('/reports', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'تقارير Next.js التشغيلية.' })).toBeVisible();
  await expect(page.getByLabel('تقارير Next.js')).toContainText('بوابة القبول');
  await expect(page.getByText(/App Router/)).toBeVisible();
});

test('renders the Next.js settings migration route', async ({ page }) => {
  await page.goto('/settings', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'إعدادات Archive Suite للقراءة فقط.' })).toBeVisible();
  await expect(page.getByLabel('إعدادات Archive Suite')).toContainText('System');
  await expect(page.getByLabel('إعدادات Archive Suite')).toContainText('API');
  await expect(page.getByLabel('وضع الأمان')).toContainText('مهلة الجلسة');
  await expect(page.getByLabel('وضع الأمان')).toContainText('Webhook allowlist');
});

test('renders the Next.js media jobs route wired for Laravel backend status', async ({ page }) => {
  await page.goto('/media/jobs', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'Media jobs عبر Laravel.' })).toBeVisible();
  await expect(page.getByLabel('فحص media jobs')).toContainText('/api/v1/media/jobs/:id');
  await expect(page.getByLabel('معرّف job')).toBeVisible();
  await expect(page.getByLabel('Access token')).toBeVisible();
});

test('renders the Next.js archive search route without requiring live Laravel data', async ({ page }) => {
  await page.goto('/archive', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'بحث السجلات المحفوظة.' })).toBeVisible();
  await expect(page.getByPlaceholder('ابحث عن السجلات...')).toBeVisible();
  await page.getByPlaceholder('ابحث عن السجلات...').fill('demo');
  await page.getByRole('button', { name: 'بحث' }).click();
  await expect(page.getByPlaceholder('ابحث عن السجلات...')).toHaveValue('demo');
});
