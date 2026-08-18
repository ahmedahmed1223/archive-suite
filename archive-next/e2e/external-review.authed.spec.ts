import { test, expect } from './fixtures/auth';

const ui = expect.configure({ timeout: 15_000 });

/**
 * V3-MEDIA-007 live acceptance for external (public, token-gated) review:
 * an editor mints a time-bounded review link for a record, an anonymous
 * reviewer (a fresh, cookie-less browser context -- no archive session at
 * all) opens it, submits an approve decision, and the editor's authenticated
 * report call proves the version + reviewer + decision. A second case
 * checks an expired link fails closed for both the anonymous read and the
 * decision endpoint.
 *
 * NOT RUN LIVE: authored and reviewed against this repo's own e2e
 * conventions (media-studio-timeline.authed.spec.ts's upload + page.request
 * out-of-band pattern) but not executed here, because this worktree has no
 * live Docker/Laravel stack available to it. Run for real via
 * `pnpm verify:laravel-next:live` before treating it as passing.
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

async function uploadRecord(page: import('@playwright/test').Page, titlePrefix: string): Promise<string> {
  const fileName = `e2e-external-review-${Date.now()}.wav`;
  const recordTitle = `${titlePrefix} ${Date.now()}`;

  await page.addInitScript(() => window.localStorage.removeItem('archive.intake-draft'));
  await page.goto('/uploads');
  await page.setInputFiles('input[type="file"]', {
    name: fileName,
    mimeType: 'audio/wav',
    buffer: buildWavBuffer(2),
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

  return recordId;
}

test.describe('external review link — live acceptance', () => {
  test('an anonymous reviewer approves through the public link and the editor report proves it', async ({ roleSession, browser }) => {
    test.setTimeout(120_000);
    const { page: editorPage } = await roleSession('editor');
    const recordId = await uploadRecord(editorPage, 'مراجعة خارجية');

    const createResponse = await editorPage.request.post(`/api/v1/media/${encodeURIComponent(recordId)}/review-links`, {
      data: { permission: 'comment', durationHours: 1, watermarkPolicy: 'visible' },
    });
    expect(createResponse.ok()).toBe(true);
    const { token } = (await createResponse.json()) as { token: string };
    expect(token.length).toBeGreaterThan(0);

    // A fresh, cookie-less context: the reviewer never authenticates with
    // the archive at all, only holds the link.
    const reviewerContext = await browser.newContext();
    const reviewerPage = await reviewerContext.newPage();
    await reviewerPage.goto(`/review/${token}`);

    await ui(reviewerPage.getByText('Reviewed media').or(reviewerPage.getByText('المادة قيد المراجعة'))).toBeVisible();
    await ui(reviewerPage.getByText('Watermarked review copy').or(reviewerPage.getByText('نسخة مراجعة تحمل علامة مائية'))).toBeVisible();

    const nameField = reviewerPage.getByLabel('Your name').or(reviewerPage.getByLabel('اسمك'));
    await nameField.fill('Anonymous External Reviewer');
    await reviewerPage.getByRole('button', { name: /Approve|موافقة/ }).click();

    await ui(reviewerPage.getByText('Decision recorded').or(reviewerPage.getByText('تم تسجيل القرار'))).toBeVisible();
    await reviewerContext.close();

    const reportResponse = await editorPage.request.get(`/api/v1/review-links/${token}/report`);
    expect(reportResponse.ok()).toBe(true);
    const { report } = (await reportResponse.json()) as {
      report: { versionToken: string; reviewers: Array<{ reviewerName: string; decision: string }>; session: { state: string } };
    };
    expect(report.versionToken).toContain('record:');
    expect(report.reviewers).toHaveLength(1);
    expect(report.reviewers[0]?.reviewerName).toBe('Anonymous External Reviewer');
    expect(report.reviewers[0]?.decision).toBe('approve');
    expect(report.session.state).toBe('approved');
  });

  test('an expired link fails closed for both the read and the decision endpoint', async ({ roleSession, browser }) => {
    test.setTimeout(60_000);
    const { page: editorPage } = await roleSession('editor');
    const recordId = await uploadRecord(editorPage, 'رابط منتهي');

    const createResponse = await editorPage.request.post(`/api/v1/media/${encodeURIComponent(recordId)}/review-links`, {
      data: { expiresAt: new Date(Date.now() - 60_000).toISOString() },
    });
    expect(createResponse.ok()).toBe(true);
    const { token } = (await createResponse.json()) as { token: string };

    const reviewerContext = await browser.newContext();
    const reviewerPage = await reviewerContext.newPage();
    await reviewerPage.goto(`/review/${token}`);
    await ui(reviewerPage.getByText('Could not load the review link').or(reviewerPage.getByText('تعذر تحميل رابط المراجعة'))).toBeVisible();

    const decisionResponse = await reviewerPage.request.post(`/api/v1/review-links/${token}/decisions`, {
      data: { reviewerName: 'Too Late', decision: 'approve' },
    });
    expect(decisionResponse.status()).toBe(404);

    await reviewerContext.close();
  });
});
