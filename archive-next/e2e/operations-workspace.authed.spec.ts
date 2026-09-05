import { expect, test } from './fixtures/auth';
import type { Page } from '@playwright/test';
import type { MediaJob } from '../lib/archive-api';

const ui = expect.configure({ timeout: 15_000 });

/**
 * V2 Task 4 (2026-09-04-v2-unified-operations-ui.md): whole-batch acceptance
 * for the unified operations shell (Task 1: lib/navigation.ts, AppHeader,
 * AppNavigationDrawer) and the connected ingest -> media-probe workflow
 * (Tasks 2-3: OperationalPage/StateNotice primitives adopted by app/ingest
 * and app/media/jobs).
 *
 * Generic axe/overflow coverage for /ingest and /media/jobs already runs via
 * accessibility-authenticated.authed.spec.ts and
 * visual-regression-authenticated.authed.spec.ts (ROUTE_COVERAGE). This file
 * adds the behavioral assertions those gates don't make: that the shell's
 * domain-grouped navigation actually renders and marks the active domain,
 * and that the workflow stages, technical report, partial failure, and
 * cancel action are all reachable and functional.
 */

const VIEWPORTS = [
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 812 },
] as const;

/** Below 1120px the sidebar is collapsed behind the nav-toggle button; at
 * and above it the sidebar renders unconditionally (see
 * app/styles/08-foundation.css `@media (min-width: 1120px) .route-links`). */
async function revealActiveNavLink(page: Page, viewportWidth: number, linkName: string) {
  if (viewportWidth < 1120) {
    await page.getByRole('button', { name: 'فتح التنقل' }).click();
  }

  const activeLink = page.getByRole('link', { name: linkName, exact: true });
  await ui(activeLink).toBeVisible();
  await ui(activeLink).toHaveAttribute('aria-current', 'page');
}

for (const viewport of VIEWPORTS) {
  test.describe(`unified operations shell — Arabic RTL @ ${viewport.name}`, () => {
    test(`/ingest and /media/jobs render the shared shell with domain-grouped navigation`, async ({ roleSession }) => {
      const { page } = await roleSession('editor');
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await page.goto('/ingest', { waitUntil: 'networkidle' });
      await ui(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await ui(page.getByRole('heading', { name: 'استيراد المحتوى للأرشيف' })).toBeVisible();
      // Task 1: the operational context badge names the active navigation
      // domain, proving the domain-grouped taxonomy rather than a flat list.
      await ui(page.locator('.app-operational-context')).toContainText('الإدخال');
      await revealActiveNavLink(page, viewport.width, 'الاستيراد');

      await page.goto('/media/jobs', { waitUntil: 'networkidle' });
      await ui(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await ui(page.getByRole('heading', { name: 'مهام الوسائط', exact: true })).toBeVisible();
      await ui(page.locator('.app-operational-context')).toContainText('الوسائط');
      // Not asserting the /media/jobs nav-drawer link here: it is gated by
      // the `mediaProcessing` capability (lib/navigation.ts
      // NAV_MODULE_CAPABILITY), which this Docker environment's default
      // `MEDIA_PROCESSOR=fake` config reports as "needs_configuration" --
      // its absence from the drawer is the capability gate working as
      // designed, not a shell regression. /ingest is not capability-gated,
      // so its own drawer link is asserted above.
    });
  });
}

test.describe('ingest → media-probe workflow stages (Task 3)', () => {
  test('the ingest page states the receive → record → probe → review stages and links to media jobs', async ({ roleSession }) => {
    const { page } = await roleSession('editor');
    await page.goto('/ingest', { waitUntil: 'networkidle' });

    const stages = page.getByRole('list', { name: 'مسار إدخال الفيديو إلى الأرشيف' });
    await ui(stages).toBeVisible();
    await ui(stages.getByText('استلام المادة')).toBeVisible();
    await ui(stages.getByText('إنشاء سجل الأرشيف')).toBeVisible();
    await ui(stages.getByText('طلب الفحص الفني', { exact: true })).toBeVisible();
    await ui(stages.getByText('مراجعة السجل')).toBeVisible();

    await ui(page.getByRole('link', { name: 'فتح مهام الوسائط' })).toHaveAttribute('href', '/media/jobs');
  });
});

const PROBE_JOB: MediaJob = {
  id: 'e2e-probe-job',
  operation: 'media_probe',
  recordId: 'e2e-probe-record',
  status: 'completed',
  sourcePath: 'media/sample.mp4',
  queuedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  progressPercent: 100,
  progressStage: null,
  options: {},
  error: null,
  result: {
    artifacts: [
      {
        kind: 'media_probe_report',
        report: {
          formatNames: ['mp4'],
          durationSeconds: 125.4,
          sizeBytes: 52_428_800,
          bitRate: 3_400_000,
          streams: [
            { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
            { index: 1, type: 'audio', codec: 'aac', channels: 2 },
          ],
        },
      },
    ],
  },
};

const FAILED_JOB: MediaJob = {
  id: 'e2e-failed-job',
  operation: 'transcode',
  recordId: 'e2e-failed-record',
  status: 'failed',
  sourcePath: 'media/broken.mov',
  queuedAt: new Date().toISOString(),
  progressPercent: null,
  progressStage: null,
  options: {},
  error: 'ترميز الفيديو غير مدعوم.',
  result: null,
};

const ACTIVE_JOB: MediaJob = {
  id: 'e2e-active-job',
  operation: 'transcription',
  recordId: 'e2e-active-record',
  status: 'processing',
  sourcePath: 'media/active.mp4',
  queuedAt: new Date().toISOString(),
  progressPercent: 42,
  progressStage: 'استخراج الصوت',
  options: {},
  error: null,
  result: null,
};

/**
 * Mocks the media/jobs endpoints so the connected-workflow assertions below
 * are deterministic: a real ffprobe/ffmpeg run's timing and exact codec
 * output are already covered by the Laravel test suite
 * (MediaProbeService/MediaJobsController tests) and by
 * `pnpm verify:laravel-next:live`'s own job creation; this spec's job is to
 * prove the *Next.js UI* renders the technical report, partial-failure
 * banner, queue status, and cancel action correctly once the API returns
 * them — not to re-verify ffprobe itself.
 */
async function mockMediaOperationsWorkflow(page: Page): Promise<void> {
  let activeJob: MediaJob = { ...ACTIVE_JOB };

  await page.route('**/api/v1/media/jobs**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/queue-status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, status: { default: 1, gpu: 0, device: 'cpu', resourceFailure: null } }),
      });
      return;
    }

    if (url.pathname.endsWith('/cancel') && request.method() === 'POST') {
      activeJob = { ...activeJob, status: 'canceled', progressPercent: null, progressStage: null };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, job: activeJob }) });
      return;
    }

    if (request.method() === 'GET') {
      const jobs = [PROBE_JOB, FAILED_JOB, activeJob];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, jobs, pagination: { total: jobs.length, page: 1, limit: 20, hasMore: false } }),
      });
      return;
    }

    await route.fallback();
  });
}

test.describe('connected media operations workspace (Task 3)', () => {
  test('surfaces the technical report, partial failure, queue status, and cancel action', async ({ roleSession }) => {
    const { page } = await roleSession('editor');
    await mockMediaOperationsWorkflow(page);

    await page.goto('/media/jobs', { waitUntil: 'networkidle' });
    await ui(page.getByRole('heading', { name: 'مهام الوسائط', exact: true })).toBeVisible();

    // Technical report: a completed media_probe job's stored artifact renders
    // as a context panel linked to the job card, not a dead "completed" badge.
    const probeCard = page.locator('.media-job-card[data-status="completed"]');
    await ui(probeCard.getByRole('heading', { name: 'سياق التقرير الفني' })).toBeVisible();
    await ui(probeCard.getByText('المدة')).toBeVisible();
    await probeCard.getByText('تفاصيل مسارات الفيديو والصوت والترجمة').click();
    await ui(probeCard.getByText('h264')).toBeVisible();

    // Partial failure: a failed job states the failure and retry guidance
    // instead of leaving the workflow at a silent dead end.
    const failedCard = page.locator('.media-job-card[data-status="failed"]');
    await ui(failedCard.getByText('ترميز الفيديو غير مدعوم.')).toBeVisible();
    await ui(failedCard.getByText('إرشادات إعادة المحاولة')).toBeVisible();
    await ui(page.getByText('تحتاج بعض مهام الوسائط إلى متابعة')).toBeVisible();

    // Queue progress: the aggregate queue-depth banner from the mocked
    // queue-status endpoint, and the active job's own progress bar.
    await ui(page.getByText('طابور المعالجة العام: 1')).toBeVisible();
    const activeCard = page.locator('.media-job-card[data-status="processing"]');
    await ui(activeCard.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');

    // Cancel: the active job exposes a cancel action; using it calls the
    // cancel endpoint and the card leaves the active/processing set.
    const cancelButton = activeCard.getByRole('button', { name: 'إلغاء المهمة' });
    await ui(cancelButton).toBeVisible();
    await cancelButton.click();
    await ui(page.locator('.media-job-card[data-status="canceled"]')).toBeVisible();
    await expect(page.locator('.media-job-card[data-status="processing"]')).toHaveCount(0);
  });
});
