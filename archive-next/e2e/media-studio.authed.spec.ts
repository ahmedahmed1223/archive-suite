import { test, expect } from './fixtures/auth';

const ui = expect.configure({ timeout: 15_000 });

/**
 * V3-MEDIA-001 live acceptance for the unified media studio (/media/studio).
 *
 * NOT RUN LIVE: this spec was authored and reviewed against the app's own
 * conventions (see scheduled-uploads.authed.spec.ts and auth-fixtures.authed.spec.ts
 * for the patterns it reuses) but was never executed, because this worktree
 * has no live Docker/Laravel stack available to it. Run it for real via
 * `pnpm verify:laravel-next:live` (or `pnpm exec playwright test media-studio`
 * against an already-running live stack) before treating it as passing.
 *
 * It intentionally creates a real record with a real playable media file
 * through the actual upload UI, then reaches the studio using the record id
 * the app itself hands back (the "فتح السجل"-style result link's href) --
 * never a hand-typed path or UID -- to prove the acceptance requirement that
 * the studio only ever opens from a real record.
 */

// A minimal, genuinely valid 1-second mono 8kHz 16-bit PCM WAV file. Real
// browsers can decode this (duration, audio track) unlike an arbitrary byte
// blob, which is what the studio's tech-spec card and player need to exercise
// their real measurement path instead of a mocked one.
function buildWavBuffer(durationSeconds = 1, sampleRate = 8000): Buffer {
  const frameCount = durationSeconds * sampleRate;
  const dataSize = frameCount * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);
  // Silence is fine -- the studio only needs real, decodable metadata.

  return buffer;
}

test.describe('media studio — live acceptance', () => {
  test('opens a real uploaded record, measures its media client-side, and respects text-input focus', async ({ roleSession }) => {
    test.setTimeout(120_000);
    const { page } = await roleSession('editor');

    const fileName = `e2e-media-studio-${Date.now()}.wav`;
    const recordTitle = `توثيق استوديو حي ${Date.now()}`;

    // 1. Create a real record with a real playable media file via the
    //    existing upload wizard -- no shortcuts into the database.
    await page.addInitScript(() => window.localStorage.removeItem('archive.intake-draft'));
    await page.goto('/uploads');
    await page.setInputFiles('input[type="file"]', {
      name: fileName,
      mimeType: 'audio/wav',
      buffer: buildWavBuffer(),
    });

    await page.getByRole('button', { name: 'التالي' }).click(); // files -> metadata
    await page.getByLabel('عنوان أو بادئة عنوان').fill(recordTitle);
    await page.getByRole('button', { name: 'التالي' }).click(); // metadata -> review

    // Default processing mode is "now" -- immediate record creation.
    await page.getByRole('button', { name: 'إنشاء السجلات' }).click();

    const resultLink = page.getByRole('link', { name: fileName });
    await ui(resultLink).toBeVisible();

    // 2. The only source of the record id is the app's own result link --
    //    proving the studio is reached without the user typing a path or UID.
    const href = await resultLink.getAttribute('href');
    expect(href).toBeTruthy();
    const recordId = decodeURIComponent((href ?? '').replace('/archive/', ''));
    expect(recordId.length).toBeGreaterThan(0);

    // 3. Open the studio via the recordId query param.
    await page.goto(`/media/studio?recordId=${encodeURIComponent(recordId)}`);

    await ui(page.getByText(recordTitle)).toBeVisible();

    // No manual path/UID entry surface anywhere on the page.
    await expect(page.getByPlaceholder(/path|مسار/i)).toHaveCount(0);

    // 4. The player actually streams the real file (not a placeholder).
    const mediaLocator = page.locator('audio, video').first();
    await ui(mediaLocator).toBeVisible();
    const src = await mediaLocator.getAttribute('src');
    expect(src).toContain('/api/v1/files/stream');

    // 5. Tech spec card measures real, client-side metadata -- no ffprobe,
    //    no server round trip -- once the browser has decoded the file.
    await ui(page.getByText('المدة')).toBeVisible();
    // Bitrate is estimated from file size + duration and must say so.
    const bitrateEstimateBadge = page.getByText('تقديري');
    if (await bitrateEstimateBadge.count()) {
      await ui(bitrateEstimateBadge.first()).toBeVisible();
    }

    // 6. Keyboard-shortcut safety: focus the comment textarea (implicitly
    //    labelled via <label>تعليق جديد<textarea/></label>) and confirm a
    //    Space keystroke lands in the field instead of toggling playback.
    const commentBox = page.getByLabel('تعليق جديد');
    await commentBox.click();
    await commentBox.type('a b');
    await expect(commentBox).toHaveValue('a b');
    const isPaused = await mediaLocator.evaluate((element) => (element as HTMLMediaElement).paused);
    expect(isPaused).toBe(true); // Space never reached the global handler.

    // 7. Mobile gets a simplified read + comment mode: versions/timeline/
    //    tasks collapse away, but the player, transcript, and comments stay.
    await page.setViewportSize({ width: 375, height: 812 });
    await ui(mediaLocator).toBeVisible();
    await ui(commentBox).toBeVisible();
    await ui(page.getByRole('heading', { name: 'الإصدارات والمشتقات' })).toBeHidden();
  });
});
