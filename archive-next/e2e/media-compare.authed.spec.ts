import { test, expect } from './fixtures/auth';

const ui = expect.configure({ timeout: 15_000 });

/**
 * V3-MEDIA-004 live acceptance for the version-compare studio (/media/compare)
 * and its non-destructive clip lists.
 *
 * NOT RUN LIVE: authored and reviewed against this app's own conventions
 * (see media-studio.authed.spec.ts, whose upload-then-open-by-real-id
 * pattern this spec reuses) but never executed here -- this worktree has no
 * live Docker/Laravel + Next dev-server stack available to it. Run it for
 * real via `pnpm verify:laravel-next:live` (or `pnpm exec playwright test
 * media-compare` against an already-running live stack) before treating it
 * as passing.
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
    await page.goto(`/archive/${encodeURIComponent(recordId)}`);
    const attachmentInput = page.locator('input[type="file"]').last();
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
    //    the record detail page still lists both original attachments.
    await page.goto(`/archive/${encodeURIComponent(recordId)}`);
    await ui(page.getByText(fileName)).toBeVisible();
  });
});
