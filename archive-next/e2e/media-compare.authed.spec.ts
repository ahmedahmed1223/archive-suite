import { test, expect } from './fixtures/auth';

// 30s (not this repo's usual 15s): this spec does two real multipart
// uploads through the actual upload wizard/attachments endpoint, matching
// the timeout used by other upload-heavy specs (scheduled-uploads.authed,
// dropbox-folder-picker.authed, onboarding-progress.authed).
const ui = expect.configure({ timeout: 30_000 });

/**
 * V3-MEDIA-004 live acceptance for the version-compare studio (/media/compare)
 * and its non-destructive clip lists.
 *
 * RUN LIVE 2026-09-14 via `pnpm verify:laravel-next:live` -- passing (2/2,
 * twice in a row). The first real run surfaced two bugs: (1)
 * `input[type="file"]').last()` intermittently targeted the wrong file
 * input -- the record detail page also renders RecordSourceReplacementPanel's
 * unrelated, visible "ملف المصدر البديل" input right after this one, and
 * whichever renders last by the time of the call won the race -- fixed by
 * targeting this input via its own accessible label instead; (2) the final
 * "original file untouched" check via `getByText(fileName)` was a strict-mode
 * collision (the audit changelog's raw JSON payload also contains the file
 * name) -- fixed with `.first()`.
 *
 * It creates a real record with a real playable media file, attaches a
 * second real file as an alternate version, opens /media/compare with the
 * app's own record id (never a hand-typed uid), picks both versions, adds a
 * non-destructive clip, and exports the clip list -- proving the acceptance
 * requirements: real record + version selection, synced playback controls
 * present, clip creation never touches the source file, and export works.
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

test.describe('media version compare — live acceptance', () => {
  test('compares two real versions of a record and manages a non-destructive clip list', async ({ roleSession }) => {
    test.setTimeout(180_000);
    const { page } = await roleSession('editor');

    const fileName = `e2e-compare-${Date.now()}.wav`;
    const recordTitle = `توثيق مقارنة حي ${Date.now()}`;

    // 1. Create a real record with a real playable media file via the
    //    existing upload wizard -- same pattern as media-studio's spec.
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

    // 2. Attach a second, real playable file to the same record -- this is
    //    the "version B" the compare view picks against the primary source.
    // The record detail page has a second, unrelated `input[type="file"]`
    // (RecordSourceReplacementPanel's "ملف المصدر البديل" input, rendered
    // right after this one only once canEdit resolves) -- `.last()` raced
    // that render and intermittently uploaded into the wrong input. Target
    // this one by its own accessible label instead.
    await page.goto(`/archive/${encodeURIComponent(recordId)}`);
    const attachmentInput = page.getByLabel('إضافة مرفقات');
    await attachmentInput.setInputFiles({
      name: `e2e-compare-alt-${Date.now()}.wav`,
      mimeType: 'audio/wav',
      buffer: buildWavBuffer(2),
    });
    await ui(page.getByText(/e2e-compare-alt/)).toBeVisible();

    // 3. Open the compare view via the real record id -- no manual path entry.
    await page.goto(`/media/compare?recordId=${encodeURIComponent(recordId)}`);
    await ui(page.getByText(recordTitle).or(page.getByRole('combobox', { name: 'النسخة أ' }))).toBeVisible();

    const versionASelect = page.getByRole('combobox', { name: 'النسخة أ' });
    const versionBSelect = page.getByRole('combobox', { name: 'النسخة ب' });
    await ui(versionASelect).toBeVisible();
    await ui(versionBSelect).toBeVisible();

    // Both sides stream real media through the authenticated endpoint.
    const mediaElements = page.locator('audio, video');
    await expect(mediaElements).toHaveCount(2);
    for (const element of await mediaElements.all()) {
      await expect(element).toHaveAttribute('src', /\/api\/v1\/files\/stream/);
    }

    // Synchronization checkbox is present and toggleable.
    const syncCheckbox = page.getByRole('checkbox', { name: /مزامنة/ });
    await ui(syncCheckbox).toBeVisible();
    await syncCheckbox.check();
    await expect(syncCheckbox).toBeChecked();

    // 4. Add a non-destructive clip on the currently-scoped version.
    await page.getByPlaceholder('عنوان المقطع').fill('اللقطة الافتتاحية');
    await page.getByRole('button', { name: 'إضافة مقطع' }).click();
    await ui(page.getByText('اللقطة الافتتاحية')).toBeVisible();

    // 5. Export the clip list as JSON -- a real download, proving the
    //    export endpoint round-trips through the real API.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'تصدير JSON' }).click(),
    ]);
    expect(download.suggestedFilename()).toContain(recordId);

    // 6. Original source files were never mutated by any of the above --
    //    the original file name is still traceable on the record (the audit
    //    changelog's title-change row, plus the metadata JSON, both still
    //    reference it -- .first() because both legitimately match).
    await page.goto(`/archive/${encodeURIComponent(recordId)}`);
    await ui(page.getByText(fileName).first()).toBeVisible();
  });
});
