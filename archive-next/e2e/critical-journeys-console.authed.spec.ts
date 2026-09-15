import { expect, test } from './fixtures/auth';

/**
 * V2-REL-002: the critical journeys must run with a clean error console.
 *
 * Nothing in the suite watched the console before, so a page could throw on
 * every load and still pass every assertion as long as the markup it had
 * already rendered was correct. This walks the journeys an operator actually
 * takes and fails on anything the browser reports as an error -- console
 * errors and uncaught page exceptions alike.
 *
 * Requires the live Laravel + Next harness (`pnpm verify:laravel-next:live`).
 */
const JOURNEY = [
  '/',
  '/work-inbox',
  '/materials/inbox',
  '/archive',
  '/media/jobs',
  '/rights',
  '/search',
] as const;

/**
 * Failed network responses surface as console errors in Chromium. The seeded
 * environment has no ingest fixtures and no realtime broadcaster, so those two
 * are expected absences rather than defects; everything else counts.
 */
const EXPECTED_ABSENCES = [/\/api\/v1\/broadcasting/i, /reverb/i, /websocket/i, /ERR_CONNECTION_REFUSED/i];

test('the critical journeys leave a clean error console', async ({ roleSession }) => {
  const { page } = await roleSession('editor');
  const problems: string[] = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (EXPECTED_ABSENCES.some((pattern) => pattern.test(text))) return;
    problems.push(`console error on ${page.url()}: ${text}`);
  });
  page.on('pageerror', (error) => {
    problems.push(`uncaught exception on ${page.url()}: ${error.message}`);
  });

  for (const path of JOURNEY) {
    await page.goto(path, { waitUntil: 'networkidle' });
    await expect(page.getByRole('main')).toBeVisible();
  }

  expect(problems, problems.join('\n')).toEqual([]);
});
