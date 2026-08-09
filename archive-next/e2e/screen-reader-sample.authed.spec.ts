import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from './fixtures/auth';
import { DYNAMIC_ROUTE_PARAMS, ROUTE_COVERAGE } from './fixtures/route-inventory';

/**
 * V1-303D (screen-reader half): captures the accessibility tree and the Tab
 * focus order for the daily paths, as a reviewable artifact.
 *
 * Why this instead of a human NVDA/VoiceOver pass: the ARIA snapshot IS the
 * tree a screen reader reads, and the focus walk IS the announcement order it
 * speaks on Tab. What a machine cannot judge is announcement *quality* (is
 * the Arabic wording natural?) — that stays out of scope and is recorded as
 * such in a manual accessibility review. What it CAN catch, and what this
 * asserts, is the defect a human pass actually finds: a focusable control
 * with no accessible name.
 *
 * Same six routes as keyboard-navigation-authenticated.authed.spec.ts, so the
 * keyboard half and the screen-reader half describe the same surface.
 */

const TARGET_ROUTES = [
  '/archive',
  '/archive/[id]',
  '/search',
  '/uploads',
  '/settings/users',
  '/system/control',
] as const;

/** Enough to cross the nav and reach page content; not a full-page sweep. */
const MAX_FOCUS_STOPS = 40;

const EVIDENCE_DIR = path.resolve(process.cwd(), 'test-results/screen-reader-sample');

interface FocusStop {
  readonly index: number;
  readonly role: string;
  readonly name: string;
  readonly tag: string;
}

// ponytail: accessible-name heuristic, not the full accname algorithm. It
// covers every labelling route this app actually uses (aria-label, <label>,
// aria-labelledby, text content, alt/title). Swap for CDP
// Accessibility.getPartialAXTree if a control ever needs the real algorithm.
function readFocusStop() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;

  const labelledBy = el.getAttribute('aria-labelledby');
  const fromLabelledBy = labelledBy
    ? labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ')
    : '';

  const name =
    el.getAttribute('aria-label')?.trim() ||
    fromLabelledBy ||
    (el as HTMLInputElement).labels?.[0]?.textContent?.trim() ||
    el.getAttribute('alt')?.trim() ||
    el.getAttribute('title')?.trim() ||
    el.textContent?.trim() ||
    '';

  return {
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role') ?? el.tagName.toLowerCase(),
    name: name.replace(/\s+/g, ' ').slice(0, 120),
    signature: `${el.getAttribute('id') ?? ''}|${el.tagName}|${name}`,
  };
}

function slugFor(route: string): string {
  return route.replace(/^\//, '').replace(/[[\]/]/g, '-') || 'root';
}

for (const routeKey of TARGET_ROUTES) {
  const coverage = ROUTE_COVERAGE.find((entry) => entry.route === routeKey);
  if (!coverage) {
    throw new Error(`screen-reader-sample: no ROUTE_COVERAGE entry for ${routeKey}`);
  }

  test(`${coverage.route} [${coverage.role}]: every focus stop announces a name`, async ({ roleSession }) => {
    const { page, data } = await roleSession(coverage.role);

    const resolve = DYNAMIC_ROUTE_PARAMS[coverage.route];
    const url = resolve ? resolve({ recordUid: data.recordUid }) : coverage.url;

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('#main-content').waitFor({ state: 'attached' });

    const tree = await page.locator('#main-content').ariaSnapshot();

    const stops: FocusStop[] = [];
    const unnamed: FocusStop[] = [];
    let firstSignature: string | null = null;

    for (let index = 0; index < MAX_FOCUS_STOPS; index += 1) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate(readFocusStop);
      if (!stop) break;
      // Only a return to the very first stop means the tab ring wrapped.
      // Repeats elsewhere are legitimate — sibling controls share names.
      if (firstSignature === null) firstSignature = stop.signature;
      else if (stop.signature === firstSignature) break;

      const record: FocusStop = { index, role: stop.role, name: stop.name, tag: stop.tag };
      stops.push(record);
      if (!stop.name) unnamed.push(record);
    }

    await mkdir(EVIDENCE_DIR, { recursive: true });
    await writeFile(
      path.join(EVIDENCE_DIR, `${slugFor(coverage.route)}.md`),
      [
        `# ${coverage.route} — ${coverage.role}`,
        '',
        `URL: \`${url}\``,
        '',
        '## ترتيب النطق عند Tab',
        '',
        '| # | العنصر | الدور | الاسم المنطوق |',
        '| - | ------ | ----- | ------------- |',
        ...stops.map((s) => `| ${s.index + 1} | \`${s.tag}\` | ${s.role} | ${s.name || '**(بلا اسم)**'} |`),
        '',
        '## شجرة الوصولية (#main-content)',
        '',
        '```yaml',
        tree.trimEnd(),
        '```',
        '',
      ].join('\n'),
      'utf8',
    );

    expect(stops.length, `${url}: no focusable element found — keyboard users cannot reach this page`).toBeGreaterThan(0);
    expect(
      unnamed,
      `${url} [${coverage.role}]: focusable controls a screen reader would announce as blank:\n` +
        unnamed.map((s) => `  stop ${s.index + 1}: <${s.tag} role=${s.role}>`).join('\n'),
    ).toEqual([]);
  });
}
