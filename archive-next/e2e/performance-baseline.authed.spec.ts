import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from './fixtures/auth';

/**
 * V1-307B/C: the measurement harness the performance contract names but did
 * not have — "web-vitals JSON emitted by Playwright trace harness" and
 * "HTTP timing JSON emitted by deterministic load harness".
 *
 * Emits two event files that scripts/performance-collect.mjs folds into one
 * run artifact, which scripts/performance-regression.mjs then judges against
 * docs/performance/baseline.v1.json. This file only measures; every budget
 * and threshold stays in the contract.
 *
 * Must run on the declared resource profile (rc-baseline-linux-x64) for its
 * output to be attributable — see docs/performance/README.md.
 */

const OUTPUT_DIR = path.resolve(process.cwd(), '..', process.env.ARCHIVE_PERF_OUTPUT_DIR ?? 'docs/performance/runs');

/** contract.requiredRoutes; /archive/:id is resolved from the role's own record. */
const ROUTES = ['/', '/archive', '/archive/:id', '/search', '/uploads'] as const;

/** contract.measurement.minimumSamples per metric. 5 routes x 4 passes = 20. */
const PASSES_PER_ROUTE = 4;
const API_SAMPLES = 20;

/** contract.resourceProfile.viewportWidths, cycled so all three are exercised. */
const VIEWPORT_WIDTHS = [375, 768, 1280] as const;

interface MetricEvent {
  readonly metric: string;
  readonly value: number;
  readonly route: string;
  readonly viewportWidth?: number;
}

/**
 * Reads LCP and CLS accumulated since navigation. Registered after load, so
 * it relies on buffered entries — both types are buffered by the browser.
 */
function readWebVitals(): Promise<{ lcp: number; cls: number }> {
  return new Promise((resolve) => {
    let lcp = 0;
    let cls = 0;

    const lcpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) lcp = Math.max(lcp, entry.startTime);
    });
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) cls += shift.value;
      }
    });

    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    clsObserver.observe({ type: 'layout-shift', buffered: true });

    // One frame plus a settle window: buffered entries flush on the next task.
    setTimeout(() => {
      lcpObserver.disconnect();
      clsObserver.disconnect();
      resolve({ lcp, cls });
    }, 500);
  });
}

/** Longest interaction latency observed while the callback runs — the INP sample. */
function measureInteraction(): Promise<number> {
  return new Promise((resolve) => {
    let longest = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longest = Math.max(longest, entry.duration);
    });
    observer.observe({ type: 'event', durationThreshold: 16 } as PerformanceObserverInit);
    setTimeout(() => {
      observer.disconnect();
      resolve(longest);
    }, 600);
  });
}

test('V1-307B/C: collect frontend web-vitals and API timings on the baseline profile', async ({ roleSession }) => {
  test.setTimeout(15 * 60_000);

  const { page, data } = await roleSession('editor');
  const frontendEvents: MetricEvent[] = [];
  const apiEvents: MetricEvent[] = [];

  for (let pass = 0; pass < PASSES_PER_ROUTE; pass += 1) {
    for (const [routeIndex, route] of ROUTES.entries()) {
      const width = VIEWPORT_WIDTHS[(pass * ROUTES.length + routeIndex) % VIEWPORT_WIDTHS.length];
      await page.setViewportSize({ width, height: 900 });

      const url = route === '/archive/:id' ? `/archive/${data.recordUid}` : route;
      await page.goto(url, { waitUntil: 'load' });

      const vitals = await page.evaluate(readWebVitals);
      frontendEvents.push({ metric: 'lcpP75Ms', value: vitals.lcp, route, viewportWidth: width });
      frontendEvents.push({ metric: 'clsP75', value: vitals.cls, route, viewportWidth: width });

      // INP needs a real interaction; the skip link is on every page and its
      // activation is cheap and side-effect free.
      const pending = page.evaluate(measureInteraction);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      frontendEvents.push({ metric: 'inpP75Ms', value: await pending, route, viewportWidth: width });
    }
  }

  // The API takes a short-lived bearer; the refresh cookie alone gets a 401.
  // Minted once — /auth/refresh is rate limited and rotates the cookie.
  const accessToken = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
    const payload = (await response.json()) as { accessToken?: string };
    return payload.accessToken ?? '';
  });
  expect(accessToken, 'could not mint an access token for the API timing harness').not.toBe('');

  const apiCalls = [
    { metric: 'searchP95Ms', path: '/api/v1/search?q=%D8%A3&limit=25', init: { method: 'GET' } },
    { metric: 'recordOpenP95Ms', path: `/api/v1/records/${data.recordUid}`, init: { method: 'GET' } },
    {
      metric: 'uploadSessionStartP95Ms',
      path: '/api/v1/uploads/sessions',
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Extension must be on the ingest allowlist; chunkSize is the
        // configured minimum (ingest.chunk_upload.min_chunk_bytes).
        body: JSON.stringify({ fileName: 'perf-probe.mp4', totalSize: 1_048_576, chunkSize: 262_144 }),
      },
    },
  ] as const;

  for (const call of apiCalls) {
    for (let sample = 0; sample < API_SAMPLES; sample += 1) {
      const elapsed = await page.evaluate(
        async ({ url, init, token }) => {
          const started = performance.now();
          const response = await fetch(url, {
            ...init,
            credentials: 'include',
            headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` },
          });
          await response.arrayBuffer();
          return { ms: performance.now() - started, status: response.status };
        },
        { url: call.path, init: call.init as RequestInit, token: accessToken },
      );

      expect(elapsed.status, `${call.metric} sample ${sample + 1} returned HTTP ${elapsed.status}`).toBeLessThan(400);
      apiEvents.push({ metric: call.metric, value: elapsed.ms, route: call.path });
    }
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(OUTPUT_DIR, 'frontend-events.json'), `${JSON.stringify(frontendEvents, null, 2)}\n`, 'utf8');
  await writeFile(path.join(OUTPUT_DIR, 'api-events.json'), `${JSON.stringify(apiEvents, null, 2)}\n`, 'utf8');

  // The contract's own floor. Failing here means the run is unusable as
  // evidence, regardless of how fast the numbers look.
  for (const metric of ['lcpP75Ms', 'clsP75', 'inpP75Ms']) {
    expect(frontendEvents.filter((event) => event.metric === metric).length, `${metric} sample count`).toBeGreaterThanOrEqual(20);
  }
  for (const metric of ['searchP95Ms', 'recordOpenP95Ms', 'uploadSessionStartP95Ms']) {
    expect(apiEvents.filter((event) => event.metric === metric).length, `${metric} sample count`).toBeGreaterThanOrEqual(20);
  }
});
