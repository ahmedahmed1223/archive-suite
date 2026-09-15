import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures/auth';
import { uploadForm } from '../lib/i18n/dictionaries/ar/pages/uploadForm';
import type { APIResponse, Page } from '@playwright/test';

/**
 * V2-REL-001 — live acceptance from intake to approval.
 *
 * The task names the chain it wants proved end to end: a real video → an
 * archival record → probe/QC → description → hierarchy → rights →
 * segments/transcript → timed search → review → proxy → approval or hold.
 * Every stage below is that chain's next link, and each one asserts the
 * server's own state rather than a UI affordance that could be rendered from
 * stale client data.
 *
 * Why this runs against the live gate rather than the acceptance harness:
 * scripts/acceptance/registry.mjs declares V1-IA-MEDIA-001 as requiring the
 * "media-worker-and-ffmpeg" capability, which its Docker provider never
 * claims — so that harness reports the scenario blocked and always has. The
 * live gate's container is built from Dockerfile.worker, which carries ffmpeg
 * and ffprobe, and scripts/verify-next-laravel-live.mjs runs a real
 * `queue:work --queue=scheduled-uploads,default` inside it. Every job the
 * upload finalizer enqueues (media_probe, thumbnail, media_qc) lands on
 * `default`, so the pipeline genuinely executes here.
 *
 * MEDIA_PROCESSOR matters and this spec refuses to pass without it. The gate's
 * default is `fake`, whose probe report is a constant (62.52s, no streams)
 * regardless of the bytes uploaded — an acceptance run against it would prove
 * the plumbing and nothing about the video. The probe assertions below read
 * values only ffprobe can produce from THIS fixture, so a fake-processor run
 * fails loudly instead of passing as a simulation.
 *
 * Run it explicitly:
 *   MEDIA_PROCESSOR=real ARCHIVE_E2E_SPECS=e2e/v2-release-acceptance.authed.spec.ts pnpm verify:laravel-next:live
 */

/** 6s of h264+aac — a real encode, so ffprobe reports real streams. */
const SOURCE_VIDEO = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'media',
  'acceptance-source.mp4',
);

/** What ffprobe must report for the fixture above, and what the fake processor cannot. */
const SOURCE_DURATION_SECONDS = 6;
const SOURCE_VIDEO_CODEC = 'h264';
const SOURCE_VIDEO_WIDTH = 320;
const SOURCE_VIDEO_HEIGHT = 240;

/** The whole chain is one sequential journey; the queue does most of the waiting. */
const JOURNEY_TIMEOUT_MS = 420_000;

/** Long enough for a queue worker sleeping 1s between polls to pick a job up and finish it. */
const PIPELINE_TIMEOUT_MS = 90_000;

const ui = expect.configure({ timeout: 20_000 });

async function envelope<T>(label: string, response: APIResponse): Promise<T> {
  const raw = await response.text();
  let payload: { ok?: boolean; error?: string };

  try {
    payload = JSON.parse(raw) as { ok?: boolean; error?: string };
  } catch {
    throw new Error(`${label}: non-JSON response (${response.status()}) — ${raw.slice(0, 300)}`);
  }

  if (!response.ok() || payload.ok === false) {
    throw new Error(`${label}: ${response.status()} — ${payload.error ?? raw.slice(0, 300)}`);
  }

  return payload as T;
}

/**
 * page.request is a raw HTTP client: it carries the context's cookies but not
 * the SPA's in-memory bearer, and the API answers 401 without one. Mint a token
 * the way the app itself does on load — by exchanging the va_refresh cookie.
 */
async function apiFor(page: Page) {
  const { accessToken } = await envelope<{ accessToken: string }>(
    'mint access token',
    await page.request.post('/api/v1/auth/refresh'),
  );
  const headers = { Authorization: `Bearer ${accessToken}` };

  return {
    get: (url: string) => page.request.get(url, { headers }),
    post: (url: string, data?: unknown) =>
      page.request.post(url, data === undefined ? { headers } : { headers, data }),
    patch: (url: string, data: unknown) => page.request.patch(url, { headers, data }),
  };
}

type JourneyApi = Awaited<ReturnType<typeof apiFor>>;

/**
 * Stage 1-2: a real video through the operator's own intake path.
 *
 * Deliberately the UI wizard rather than a direct POST: /uploads is what an
 * archivist actually uses, and it is the wizard — not the endpoint — that
 * decides whether the bytes reach POST /api/v1/uploads at all. Posting
 * straight to the API would have passed even when the wizard was broken.
 */
async function intakeRealVideo(page: Page, title: string): Promise<string> {
  const fileName = `v2-acceptance-${Date.now()}.mp4`;

  await page.addInitScript(() => window.localStorage.removeItem('archive.intake-draft'));
  await page.goto('/uploads');
  await page.setInputFiles('input[type="file"]', {
    name: fileName,
    mimeType: 'video/mp4',
    buffer: readFileSync(SOURCE_VIDEO),
  });

  await page.getByRole('button', { name: uploadForm.nextButton }).click();
  await page.getByLabel(uploadForm.titlePrefixLabel).fill(title);
  await page.getByRole('button', { name: uploadForm.nextButton }).click();
  await page.getByRole('button', { name: uploadForm.createRecordsButton }).click();

  const resultLink = page.getByRole('link', { name: fileName });
  await ui(resultLink).toBeVisible();
  const href = (await resultLink.getAttribute('href')) ?? '';
  const recordId = decodeURIComponent(href.replace('/archive/', ''));

  expect(recordId, 'intake produced no record id').not.toHaveLength(0);
  return recordId;
}

/** Polls the record's own inspections until the named type lands, or fails loudly. */
async function waitForInspection(api: JourneyApi, recordId: string, type: 'probe' | 'qc') {
  let last: unknown = null;

  await expect
    .poll(
      async () => {
        const response = await api.get(
          `/api/v1/records/${encodeURIComponent(recordId)}/media-inspections`,
        );
        if (!response.ok()) return null;
        const { inspections } = (await response.json()) as {
          inspections: { inspectionType: string; status: string; report: unknown }[];
        };
        last = inspections.find((inspection) => inspection.inspectionType === type) ?? null;
        return last;
      },
      {
        timeout: PIPELINE_TIMEOUT_MS,
        message: `no ${type} inspection was recorded for ${recordId} — is the queue worker running?`,
      },
    )
    .not.toBeNull();

  return last as { inspectionType: string; status: string; report: Record<string, unknown> };
}

test.describe('v2 release acceptance — intake to approval', () => {
  test('a real video travels the whole chain and ends in an approval', async ({ roleSession }) => {
    test.setTimeout(JOURNEY_TIMEOUT_MS);

    const { page } = await roleSession('editor');
    const { page: adminPage } = await roleSession('admin');
    const stamp = Date.now();
    const recordTitle = `قبول الإصدار ٢ ${stamp}`;
    // A token that cannot occur anywhere else, so a timed-search hit can only
    // have come from the segment created below.
    const searchToken = `mishkat${stamp}`;

    // ---- 1-2. real video → archival record -------------------------------
    const recordId = await intakeRealVideo(page, recordTitle);

    // Minted after the wizard: the app refreshes on load and rotates the
    // cookie, so a token taken beforehand would already be stale.
    const api = await apiFor(page);

    const created = await envelope<{ record: Record<string, unknown> & { filePath?: string } }>(
      'record after intake',
      await api.get(`/api/v1/records/${encodeURIComponent(recordId)}`),
    );
    const sourcePath = created.record.filePath;
    expect(sourcePath, 'the intake record carries no source path').toBeTruthy();

    // ---- 3. probe / QC ---------------------------------------------------
    // The upload finalizer enqueues these itself; nothing here asks for them.
    const probe = await waitForInspection(api, recordId, 'probe');
    expect(probe.status).toBe('completed');

    // These two assertions are what separate an acceptance from a smoke test.
    // The fake processor answers 62.52s with an empty stream list for every
    // file; only a real ffprobe run can report this fixture's own duration and
    // its h264 stream, so a gate left on MEDIA_PROCESSOR=fake fails here.
    const report = probe.report as {
      durationSeconds?: number;
      streams?: { type?: string; codec?: string; width?: number | null; height?: number | null }[];
    };
    expect(report.durationSeconds, 'probe reported a duration that is not this file').toBeCloseTo(
      SOURCE_DURATION_SECONDS,
      0,
    );
    const videoStream = (report.streams ?? []).find((stream) => stream.type === 'video');
    expect(
      videoStream,
      'probe found no video stream — was this run made with MEDIA_PROCESSOR=fake?',
    ).toBeTruthy();
    expect(videoStream?.codec).toBe(SOURCE_VIDEO_CODEC);
    expect(videoStream?.width).toBe(SOURCE_VIDEO_WIDTH);
    expect(videoStream?.height).toBe(SOURCE_VIDEO_HEIGHT);

    const qc = await waitForInspection(api, recordId, 'qc');
    // A hold is a legitimate outcome of QC; an unreadable one is not.
    expect(['passed', 'warning', 'failed']).toContain(qc.status);

    // ---- 4. description --------------------------------------------------
    // /records/bulk replaces storage_rows.data outright rather than merging
    // into it, so the existing record has to be spread here — a partial write
    // would drop filePath/checksum/disk and orphan the file that was just
    // uploaded.
    await envelope(
      'describe record',
      await api.post('/api/v1/records/bulk', {
        store: 'archive-items',
        records: [
          {
            ...created.record,
            title: recordTitle,
            description: 'مادة اختبار القبول الحي لإصدار 2.',
            type: 'video',
            tags: ['قبول-حي', 'إصدار-2'],
          },
        ],
      }),
    );

    const described = await envelope<{
      record: { title: string; filePath?: string; descriptorCompletion: { status: string } };
    }>('record after description', await api.get(`/api/v1/records/${encodeURIComponent(recordId)}`));
    expect(described.record.title).toBe(recordTitle);
    expect(described.record.filePath, 'describing the record lost its source file').toBe(sourcePath);
    // The descriptor is what "توصيف" means here: all four fields present.
    expect(described.record.descriptorCompletion.status).toBe('green');

    // ---- 5. hierarchy ----------------------------------------------------
    const node = await envelope<{ node: { id: string; recordUid: string | null } }>(
      'attach to hierarchy',
      await api.post('/api/v1/archival-nodes', {
        title: `تسلسل القبول ${stamp}`,
        level: 'item',
        recordStore: 'archive-items',
        recordUid: recordId,
      }),
    );
    expect(node.node.recordUid).toBe(recordId);

    // ---- 6. rights: the refusal comes first -------------------------------
    // Deny-by-default is the point of the rights model, so prove the closed
    // door before proving the open one. Asserting only the granted path would
    // pass just as happily against an enforcement layer that never refuses.
    const beforeGrant = await envelope<{ decisions: { usage: string; allowed: boolean }[] }>(
      'rights before grant',
      await api.get(`/api/v1/rights/${encodeURIComponent(recordId)}/enforcement`),
    );
    expect(
      beforeGrant.decisions.every((decision) => !decision.allowed),
      'a record with no rights window was not refused for every usage',
    ).toBe(true);

    // A window cannot hang off nothing: RightsWindowsController::store answers
    // 404 until the item has a rights record to attach it to.
    await envelope(
      'create rights record',
      await api.post('/api/v1/rights', {
        itemId: recordId,
        rightsHolder: 'أرشيف مسار',
        licenseType: 'OWNED',
        notes: 'سجل حقوق أنشئ ضمن القبول الحي لإصدار 2.',
      }),
    );

    // Granted, but scoped to two territories and one internal platform. The
    // enforcement boundaries ask for territory `global` / platform `web`, so a
    // window this narrow must still refuse — and name itself as the decider
    // rather than reporting "no window", which is how an operator tells a
    // missing licence apart from a licence that does not reach this use.
    const window = await envelope<{ window: { id: string } }>(
      'grant a territory-scoped editorial_reuse window',
      await api.post(`/api/v1/rights/${encodeURIComponent(recordId)}/windows`, {
        usage: 'editorial_reuse',
        territories: ['PS', 'JO'],
        platforms: ['archive-internal'],
        granted: true,
      }),
    );

    const scoped = await envelope<{ decisions: { usage: string; allowed: boolean; decidedBy: string }[] }>(
      'rights under a scoped window',
      await api.get(`/api/v1/rights/${encodeURIComponent(recordId)}/enforcement`),
    );
    const scopedDecision = scoped.decisions.find((decision) => decision.usage === 'editorial_reuse');
    expect(scopedDecision?.allowed, 'a window outside the requested territory still allowed it').toBe(false);
    expect(scopedDecision?.decidedBy, 'the refusal did not name the window that caused it').toBe(window.window.id);

    // Widen the same window to every territory and platform: that, and only
    // that, is what opens the door.
    await envelope(
      'widen the window',
      await api.patch(`/api/v1/rights-windows/${window.window.id}`, {
        territories: [],
        platforms: [],
      }),
    );

    const afterGrant = await envelope<{ decisions: { usage: string; allowed: boolean }[] }>(
      'rights after grant',
      await api.get(`/api/v1/rights/${encodeURIComponent(recordId)}/enforcement`),
    );
    expect(
      afterGrant.decisions.find((decision) => decision.usage === 'editorial_reuse')?.allowed,
      'the granted usage is still refused',
    ).toBe(true);
    expect(
      afterGrant.decisions.find((decision) => decision.usage === 'broadcast')?.allowed,
      'granting one usage leaked into another',
    ).toBe(false);

    // ---- 7. timed segments + transcript ----------------------------------
    const segment = await envelope<{ segment: { id: string; startFrame: number } }>(
      'create timed segment',
      await api.post(`/api/v1/records/${encodeURIComponent(recordId)}/timed-description-segments`, {
        startFrame: 24,
        endFrame: 96,
        title: `لقطة ${searchToken}`,
        description: 'مقطع موصوف زمنيًا للبحث الزمني.',
        subjects: ['اختبار'],
      }),
    );
    expect(segment.segment.startFrame).toBe(24);

    // Cue timings, not prose: TranscriptSearchService parses the stored string
    // as VTT/SRT and finds nothing in a transcript without timing lines, so a
    // plain paragraph would store fine and stay permanently unsearchable.
    const transcript = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      `نص تفريغ للقبول الحي يذكر ${searchToken} مرة واحدة.`,
      '',
      '00:00:03.000 --> 00:00:05.000',
      'سطر ثانٍ بلا كلمة البحث.',
    ].join('\n');

    await envelope(
      'write transcript',
      await api.patch(`/api/v1/records/${encodeURIComponent(recordId)}/transcript`, { transcript }),
    );

    // ---- 8. timed search --------------------------------------------------
    // Not "search finds the record" — search finds the *moment*, with the
    // timecode that makes it navigable. The two timed sources are reached by
    // two different modes: keyword search returns matching description
    // segments, while the transcript lives behind mode=transcript (the keyword
    // matcher deliberately reads only uid/title/description/type/tags).
    type SearchBody = {
      records: { uid: string; moments?: { kind: string; timestampSeconds: number | null }[] }[];
      segmentMatches: { recordId: string; startFrame: number; title: string }[];
    };

    const byKeyword = await envelope<SearchBody>(
      'timed search — description segments',
      await api.get(`/api/v1/search?q=${encodeURIComponent(searchToken)}`),
    );
    const match = byKeyword.segmentMatches.find((candidate) => candidate.recordId === recordId);
    expect(match, 'timed search returned no segment for the described moment').toBeTruthy();
    expect(match?.startFrame).toBe(24);

    const byTranscript = await envelope<SearchBody>(
      'timed search — transcript cues',
      await api.get(`/api/v1/search?q=${encodeURIComponent(searchToken)}&mode=transcript`),
    );
    const transcriptRecord = byTranscript.records.find((candidate) => candidate.uid === recordId);
    expect(transcriptRecord, 'transcript search did not return the record').toBeTruthy();
    const transcriptMoment = (transcriptRecord?.moments ?? []).find(
      (moment) => moment.kind === 'transcript',
    );
    expect(transcriptMoment, 'the transcript cue produced no searchable moment').toBeTruthy();
    // The cue starts at 00:00:01.000 — a moment that cannot justify its time
    // is not navigable, so the timestamp is the assertion that matters.
    expect(transcriptMoment?.timestampSeconds).toBe(1);

    // ---- 9. review session ------------------------------------------------
    const session = await envelope<{ session: { id: string; state: string } }>(
      'open review session',
      await api.post(`/api/v1/records/${encodeURIComponent(recordId)}/review-sessions`, {
        notes: 'مراجعة القبول الحي.',
      }),
    );
    const sessionId = session.session.id;
    expect(session.session.state).toBe('draft');

    await envelope('start review', await api.post(`/api/v1/review-sessions/${sessionId}/start`));

    // ---- 10. proxy --------------------------------------------------------
    const derivative = await envelope<{ derivative: { id: string; derivativeType: string } }>(
      'request proxy',
      await api.post('/api/v1/media-derivatives', { recordId, type: 'proxy', sourcePath }),
    );
    const derivativeId = derivative.derivative.id;

    await expect
      .poll(
        async () => {
          const response = await api.get(
            `/api/v1/records/${encodeURIComponent(recordId)}/media-derivatives`,
          );
          if (!response.ok()) return null;
          const { derivatives } = (await response.json()) as {
            derivatives: { id: string; status: string; error?: string | null }[];
          };
          return derivatives.find((candidate) => candidate.id === derivativeId)?.status ?? null;
        },
        { timeout: PIPELINE_TIMEOUT_MS, message: 'the proxy derivative never left the queue' },
      )
      .toBe('ready');

    // The rights window granted above is what makes this download legal; the
    // same endpoint answers 403 with a reason when no window covers the item.
    const proxyContent = await api.get(`/api/v1/media-derivatives/${derivativeId}/content`);
    expect(proxyContent.status(), 'the proxy was not servable under the granted window').toBe(200);
    expect((await proxyContent.body()).byteLength).toBeGreaterThan(0);

    // ---- 11. hold, then approval ------------------------------------------
    // Both outcomes the acceptance names, proved on the same real session:
    // the hold first, then the release and the approval.
    const held = await envelope<{ session: { state: string } }>(
      'hold for changes',
      await api.post(`/api/v1/review-sessions/${sessionId}/request-changes`, {
        notes: 'حجز للمراجعة: تحقق من الحقوق قبل الاعتماد.',
      }),
    );
    expect(held.session.state).toBe('changes_requested');

    await envelope('resume review', await api.post(`/api/v1/review-sessions/${sessionId}/resume`));

    // The editor opened this session, so the editor may not close it out:
    // ReviewSessionService's self-approval guard answers 403. Proving that
    // refusal here keeps the four-eyes rule part of the acceptance rather than
    // an untested claim, and the admin's approval below is what releases it.
    const selfApproval = await api.post(`/api/v1/review-sessions/${sessionId}/approve`, {
      notes: 'محاولة اعتماد ذاتي.',
    });
    expect(selfApproval.status(), 'the requester was allowed to approve their own review').toBe(403);

    const adminApi = await apiFor(adminPage);
    const approved = await envelope<{ session: { state: string; decidedAt: string | null } }>(
      'approve as a second pair of eyes',
      await adminApi.post(`/api/v1/review-sessions/${sessionId}/approve`, {
        notes: 'معتمد بعد اكتمال السلسلة.',
      }),
    );
    expect(approved.session.state).toBe('approved');
    expect(approved.session.decidedAt, 'an approval recorded no decision time').toBeTruthy();

    // The decision has to be visible to someone other than the account that
    // made it, or "approved" is a claim one session made about itself.
    const readBack = await envelope<{ sessions: { id: string; state: string }[] }>(
      'read the decision back as the requester',
      await api.get(`/api/v1/records/${encodeURIComponent(recordId)}/review-sessions`),
    );
    expect(readBack.sessions.find((candidate) => candidate.id === sessionId)?.state).toBe('approved');
  });
});
