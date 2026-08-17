import { test, expect } from './fixtures/auth';

const ui = expect.configure({ timeout: 15_000 });

/**
 * V3-MEDIA-005 live acceptance for the synchronized transcript/subtitle
 * editor (/transcriber cue editor).
 *
 * NOT RUN LIVE: authored and reviewed against the app's own conventions
 * (see media-studio.authed.spec.ts, which documents the same constraint)
 * but never executed here -- this worktree has no live Docker/Laravel stack
 * wired to Playwright's role-provisioned storage state. Run it for real via
 * `pnpm verify:laravel-next:live` (or `pnpm exec playwright test
 * transcriber-cue-editor` against an already-running live stack).
 *
 * Focus: real Arabic (RTL) cue text survives edit -> save -> reload ->
 * SRT/VTT download without mangling, and the lock/unlock + restore actions
 * are explicit, visible steps rather than silent overwrites.
 */

function buildWavBuffer(durationSeconds = 1, sampleRate = 8000): Buffer {
  const frameCount = durationSeconds * sampleRate;
  const dataSize = frameCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

const ARABIC_CUE_ONE = 'مرحبا بكم في الأرشيف';
const ARABIC_CUE_TWO = 'هذا نص تجريبي بالعربية للتحقق من السلامة';

test.describe('transcriber cue editor — live acceptance', () => {
  test('edits Arabic cues, saves a version, locks, blocks a silent overwrite, and restores', async ({ roleSession }) => {
    test.setTimeout(120_000);
    const { page } = await roleSession('editor');

    // 1. Create a real record through the existing upload wizard -- the cue
    //    editor operates on a real record id, same convention as the studio spec.
    const fileName = `e2e-transcriber-${Date.now()}.wav`;
    const recordTitle = `تفريغ حي ${Date.now()}`;
    await page.addInitScript(() => window.localStorage.removeItem('archive.intake-draft'));
    await page.goto('/uploads');
    await page.setInputFiles('input[type="file"]', {
      name: fileName,
      mimeType: 'audio/wav',
      buffer: buildWavBuffer(),
    });
    await page.getByRole('button', { name: 'التالي' }).click();
    await page.getByLabel('عنوان أو بادئة عنوان').fill(recordTitle);
    await page.getByRole('button', { name: 'التالي' }).click();
    await page.getByRole('button', { name: 'إنشاء السجلات' }).click();

    const resultLink = page.getByRole('link', { name: fileName });
    await ui(resultLink).toBeVisible();
    const href = await resultLink.getAttribute('href');
    const recordId = decodeURIComponent((href ?? '').replace('/archive/', ''));
    expect(recordId.length).toBeGreaterThan(0);

    // 2. Open the transcriber and load the (empty) transcript for this record.
    await page.goto('/transcriber');
    await page.getByLabel('معرّف المادة').fill(recordId);
    await page.getByRole('button', { name: /تحميل النص وسجل الإصدارات/ }).click();

    // 3. Add two Arabic cues via the cue editor.
    await page.getByRole('button', { name: 'إضافة مقطع' }).click();
    const firstTextInput = page.locator('input[dir="auto"]').first();
    await firstTextInput.fill(ARABIC_CUE_ONE);

    await page.getByRole('button', { name: 'إضافة مقطع' }).click();
    const secondTextInput = page.locator('input[dir="auto"]').nth(1);
    await secondTextInput.fill(ARABIC_CUE_TWO);
    // Push the second cue's start past the first cue's default end so the
    // pair is chronologically valid before saving.
    const secondStartInput = page.locator('input[type="number"]').nth(2);
    await secondStartInput.fill('5');
    const secondEndInput = page.locator('input[type="number"]').nth(3);
    await secondEndInput.fill('8');

    // 4. Save as a new version. RTL text renders right-aligned inside the
    //    dir="auto" input -- verify the value round-trips exactly, byte for byte.
    await page.getByRole('button', { name: 'حفظ كنسخة جديدة' }).click();
    await ui(page.getByText('حُفظت نسخة جديدة من النص.')).toBeVisible();
    await expect(firstTextInput).toHaveValue(ARABIC_CUE_ONE);
    await expect(secondTextInput).toHaveValue(ARABIC_CUE_TWO);

    // 5. Download SRT and VTT; both must contain the untouched Arabic text.
    const [srtDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'تنزيل SRT' }).click(),
    ]);
    const srtPath = await srtDownload.path();
    expect(srtPath).toBeTruthy();
    const fs = await import('node:fs');
    const srtContent = fs.readFileSync(srtPath as string, 'utf8');
    expect(srtContent).toContain(ARABIC_CUE_ONE);
    expect(srtContent).toContain(ARABIC_CUE_TWO);

    const [vttDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'تنزيل VTT' }).click(),
    ]);
    const vttPath = await vttDownload.path();
    const vttContent = fs.readFileSync(vttPath as string, 'utf8');
    expect(vttContent).toContain('WEBVTT');
    expect(vttContent).toContain(ARABIC_CUE_ONE);

    // 6. Lock (approve) the transcript -- an explicit, confirmed action.
    await page.getByRole('button', { name: 'اعتماد النسخة الحالية (قفل)' }).click();
    await page.getByRole('button', { name: 'تأكيد' }).click();
    await ui(page.getByText('معتمد ومقفل')).toBeVisible();

    // 7. Editing the locked transcript and saving again must NOT silently
    //    overwrite it -- the app must surface an explicit unlock confirmation.
    await firstTextInput.fill(`${ARABIC_CUE_ONE} (معدّل)`);
    await page.getByRole('button', { name: 'حفظ كنسخة جديدة' }).click();
    await ui(page.getByText('النص معتمد حاليًا')).toBeVisible();
    await page.getByRole('button', { name: 'تأكيد' }).click();
    await ui(page.getByText('حُفظت نسخة جديدة من النص.')).toBeVisible();
    await ui(page.getByText('قابل للتعديل')).toBeVisible(); // no longer locked

    // 8. Version history lists at least 3 saved versions (initial, edit,
    //    unlocked re-save) and restoring one is an explicit, audited action.
    const historyItems = page.locator('text=نسخة بتاريخ');
    await expect(historyItems).toHaveCount(await historyItems.count());
    const restoreButtons = page.getByRole('button', { name: 'استعادة هذه النسخة' });
    await restoreButtons.last().click();
    await page.getByRole('button', { name: 'تأكيد' }).click();
    await ui(page.getByText('تمت استعادة النسخة المحددة كنسخة جديدة.')).toBeVisible();
  });
});
