import { expect, test } from '@playwright/test';
import { goToPage, seedLocalArchive } from './helpers/seed';

test.describe('Projects workstation', () => {
  test('creates a project and adds a rough cut from the source bin', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await seedLocalArchive(page);
    await goToPage(page, '#/projects');

    await page.getByRole('button', { name: /مشروع جديد|إنشاء مشروع/ }).first().click();
    await page.getByLabel('اسم المشروع').fill('تقرير E2E');
    await page.getByRole('button', { name: 'إنشاء المشروع' }).click();

    await expect(page.getByRole('region', { name: 'مكتبة مواد المشروع' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('region', { name: 'شاشة البرنامج' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'مفتش القصاصة' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'الخط الزمني' })).toBeVisible();
    await expect(page.getByText('مكتبة المصادر')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('استيراد مواد للمونتاج')).toBeVisible();
    await expect(page.getByText('إعدادات المادة المحددة')).toBeVisible();
    await expect(page.getByText('المعاينة وبناء القصاصة')).toBeVisible();
    await expect(page.getByText('مركز التصدير')).toBeVisible();

    const importPanel = page.getByRole('region', { name: 'استيراد مواد للمونتاج' });
    await importPanel.getByLabel('اسم المادة').fill('مادة مستوردة E2E');
    await importPanel.getByLabel('مسار ملف المصدر').fill('D:\\media\\imported-e2e.mp4');
    await importPanel.getByRole('button', { name: 'استيراد وربط بالمشروع' }).click();
    await expect(page.getByRole('button', { name: /مادة مستوردة E2E/ })).toBeVisible();

    const materialInspector = page.getByRole('region', { name: 'إعدادات المادة المحددة' });
    await materialInspector.getByLabel('اسم المادة').fill('مادة مضبوطة E2E');
    await materialInspector.getByLabel('Audio').fill('audio/imported-e2e.wav');
    await materialInspector.getByLabel('Web proxy').fill('proxy/imported-e2e.mp4');
    await materialInspector.getByRole('button', { name: /حفظ إعدادات المادة/ }).click();
    await expect(page.getByRole('button', { name: /مادة مضبوطة E2E/ })).toBeVisible();

    await page.getByRole('button', { name: /فيديو اختبار E2E/ }).first().click();
    await page.getByLabel('In').first().fill('1');
    await page.getByLabel('Out').first().fill('4');
    await page.getByRole('button', { name: 'إضافة للتايملاين' }).click();

    await expect(page.getByText(/1 قصاصة/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /JSON/ })).toBeEnabled();
    await expect(page.getByText('اختر قصاصة من الخط الزمني')).toBeHidden();
    await expect(page.getByText('أدوات القطع')).toBeVisible();
    await page.getByLabel('نوع الانتقال').selectOption('dissolve');
    await page.getByLabel('مدة الانتقال').fill('0.8');
    await page.getByRole('button', { name: 'دافئ' }).click();
    await page.getByLabel('Scale').fill('1.2');
    await page.getByLabel('Rotation').fill('3');
    await page.getByRole('button', { name: /نسخ القصاصة/ }).click();
    await expect(page.getByText(/2 قصاصة/).first()).toBeVisible();
    await page.getByRole('button', { name: 'قص في المنتصف' }).click();
    await expect(page.getByText(/3 قصاصة/).first()).toBeVisible();

    await page.getByPlaceholder('علامة زمنية: افتتاح، ذروة، نهاية...').fill('افتتاح');
    await page.getByRole('button', { name: 'إضافة', exact: true }).click();
    await expect(page.getByText('افتتاح')).toBeVisible();

    await page.getByPlaceholder('تعليق مرتبط بهذه القصاصة والزمن الحالي...').fill('مراجعة صوت البداية');
    await page.getByRole('button', { name: 'إضافة تعليق' }).click();
    await expect(page.getByText('مراجعة صوت البداية')).toBeVisible();

    await expect(page.getByRole('button', { name: /حزمة تسليم/ })).toBeEnabled();
    await expect(page.getByText('لوحة المهام')).toBeHidden();
    await expect(page.getByText('مهام الإنتاج في قسم مستقل')).toBeHidden();
    await goToPage(page, '#/production-tasks');
    await expect(page.getByText('مهام الإنتاج').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('تقرير E2E').first()).toBeVisible();
    await page.getByLabel('عنوان المهمة').fill('مراجعة مونتاج E2E');
    await page.getByRole('button', { name: 'إضافة للوحة' }).click();
    const taskCard = page.locator('article').filter({ hasText: 'مراجعة مونتاج E2E' });
    await taskCard.scrollIntoViewIfNeeded();
    await expect(taskCard).toBeVisible();
    await taskCard.getByRole('combobox').selectOption('review');
    await expect(page.getByText('في المراجعة')).toBeVisible();
  });
});
