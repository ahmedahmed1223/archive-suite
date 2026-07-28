# V1-795 mobile audit: Help and Files

> **Status update — 2026-07-28.** P1 is fixed in code (`4b24182e`). P2's coverage
> half was already true when this audit was written; only its evidence half is
> still open. P3 remains open, blocked on the same live run as P2. Details in
> [Follow-up status](#follow-up-status-2026-07-28) at the end. The original
> findings below are left unedited as the record of what was observed on 07-27.

Date: 2026-07-27  
Scope: canonical Next.js routes `/help` and `/files` at 375px and 768px wide. The audit reviewed responsive source, existing tests, and available screenshot evidence. No product CSS was changed: no contained, one-line defect could be verified safely without an authenticated files dataset.

## Findings

### P1 — The unauthenticated visual test does not inspect `/help`

`archive-next/e2e/visual-regression.spec.ts` includes `/help` in `CORE_ROUTES` and reports passes at `mobile-375` and `tablet-768`. In the current app, however, visiting `/help` without an authenticated session redirects to login. The test's generated `help--mobile-375.png` was therefore a login page, not the help page.

Impact: the current green visual result cannot demonstrate that help content has no horizontal overflow or clipped interactive controls at either audited width.

Recommended follow-up: move `/help` into the authenticated visual suite (or make it intentionally public), then assert the final URL/route identity before the overflow and screenshot assertions.

### P2 — `/files` has no current 375px/768px visual-regression coverage

The shared visual route inventory covers `/help` but omits `/files`; the authenticated visual evidence contains a 375px files screenshot but no tablet (768px) equivalent. The files page changes behavior across the compact breakpoint (`MOBILE_VIEWPORT_QUERY` is `max-width: 760px`): cards are selected at 375px, while 768px starts in the table view. That makes 768px a material mode boundary which should be covered with realistic file rows.

Impact: table wrapping/scroll containment, the preview rail, and file action reachability are unverified at 768px. The existing `DataTable` correctly provides a focusable horizontal scroll region, but this is not a substitute for route-level evidence with actual file data.

Recommended follow-up: add authenticated `/files` checks at 375px and 768px with fixture data, asserting the expected initial view mode, no document overflow, and in-viewport interactive controls. Keep the table-region horizontal scroll as the documented exception rather than treating it as page overflow.

### P3 — Help content is source-level responsive, but only historical mobile evidence exists

Source inspection found the relevant safety rules: `.help-content` is constrained to `min(100%, 74rem)` with `overflow-wrap: anywhere`; shared grids use `minmax(min(100%, ...), 1fr)`; and the shell resets descendant `min-inline-size` to zero. Historical authenticated 375px evidence shows the help sections, checklist, feature cards, and persistent mobile navigation without page-width clipping.

Impact: low current risk in the static help layout, but the evidence is not a fresh 768px authenticated run.

Recommended follow-up: resolve P1; its authenticated regression check should supply refreshed evidence for both target widths.

## Checks performed

- Ran the existing Chromium visual-regression selection for `/help`: 3 passed (375px, 768px, 1280px). This is recorded as a test-execution result only, not as page-layout evidence, because of the redirect described in P1.
- Reviewed `archive-next/lib/responsive-layout.test.ts`, which already checks shell inline-size safety, 44px target rules, checklist hit area, and the help width constraint.
- Reviewed responsive styles in `archive-next/app/styles/02-layout.css`, `04-tables.css`, `05-status.css`, and `06-widgets.css`; and route behavior in `archive-next/app/help/page.tsx` and `archive-next/app/files/page.tsx`.

## Decision

No CSS change was made. The observed gaps are coverage/route-state issues rather than a verified local layout regression; changing CSS without exercising an authenticated files dataset would be speculative.

## Follow-up status (2026-07-28)

### P1 — fixed

Commit `4b24182e` removed `/help` (with `/`, `/reports`, `/settings`, `/archive`
and `/media/jobs`) from `CORE_ROUTES`, leaving only `/login` and
`/share/demo-token` — verified directly against `proxy.ts`'s
`publicPathPrefixes` as the only two paths that survive without a session. Two
guards now prevent the silent-redirect class of defect from returning: an
import-time check in `fixtures/visual-routes.ts` rejects any non-public entry,
and `gotoPublicRoute` asserts the landed pathname, so an app-side redirect fails
the gate loudly instead of screenshotting the wrong page. `/help` keeps its
375/768/1280 coverage against a real session through `ROUTE_COVERAGE`.

### P2 — coverage was already correct; evidence is still missing

The coverage claim needs a correction. `/files` entered `ROUTE_COVERAGE` in
`a4e1732f` on 2026-07-15, twelve days *before* this audit, and
`visual-regression-authenticated.authed.spec.ts` iterates all three `VIEWPORTS`
across every covered route. So 768px `/files` has been exercised in code the
whole time — what was missing is the stored 768px screenshot artifact, not the
check. P2 is therefore an evidence gap only, and narrower than written.

### P3 — still open

Unchanged: the static help layout looks safe at source level, but there is no
fresh authenticated 768px run behind it.

### What was attempted and did not complete

A live authenticated run was started to produce the missing artifacts:

```
ARCHIVE_E2E_SPECS=e2e/visual-regression-authenticated.authed.spec.ts \
  node scripts/verify-next-laravel-live.mjs
```

It was abandoned after ~17 minutes with no container started and no port
listening — no evidence it was progressing. **No fresh screenshot evidence was
produced, so P2 and P3 stay open.** Anyone resuming should run the command above
and confirm Laravel comes up before assuming the suite is running; the artifacts
land in `visual-evidence/authed--files--viewer--tablet-768.png` and the matching
`help` file.

## Live run completed (2026-07-28)

### Why the earlier attempts produced nothing

Two separate causes, both now resolved:

1. Docker was unavailable in the previous session. It is up here (29.6.1) and
   the stack came up on the first try.
2. More seriously, the suite was collecting **zero tests**. `4b24182e` added an
   import-time guard to `e2e/fixtures/visual-routes.ts` that imports
   `isPublicPath` from `proxy.ts`, and `proxy.ts` imports `next/server`, which
   Playwright's loader cannot resolve. Playwright reports an unresolvable
   import as "No tests found" rather than as an error, so
   `visual-regression`, `visual-regression-authenticated`, `accessibility` and
   `keyboard-navigation` all silently ran nothing. Fixed in `ba07b380` by
   moving the prefix list to `lib/public-paths.ts`; collection went from 0 to
   181 tests.

So the "green visual result" this audit distrusted in P1 was worse than
described: for the four affected specs there was no result at all.

### Result: 95 passed, 56 failed (17.2m)

| Viewport | Pass | Fail |
|---|---|---|
| mobile-375 | 42 | 5 |
| tablet-768 | 0 | **50** |
| desktop-1280 | 49 | 0 |

Every failure is the `assertNoClippedInteractiveElements` half of the gate, not
the document `scrollWidth` half — meaning a container clips these controls
without the page ever reporting horizontal overflow. That is precisely the case
that assertion was written for, and it is why the page-level checks looked
clean.

Screenshots are taken after the assertions, so failing routes produced no
artifact: `authed--*--tablet-768.png` does not exist for any route. P2/P3's
evidence gap is therefore still open, but for a new reason — the pages fail the
gate rather than the run failing to start.

### N1 — P1 — The 761–1119px band has no navigation layout at all

All 50 authenticated routes fail at 768px, and the offending elements are the
same on every one: the route links and topbar actions — «يومي», «الرفعات
المجدولة», «التفريغ», «الوسائط», «الوارد», «الاستيراد», «إضافة مادة»,
«اللوحة», «الأرشيف», «البحث» — sitting at negative `left` (−33px to −97px) with
a shared `right` of 38.5px. In an RTL layout that is the nav running off the
inline-start edge.

> **Mechanism corrected 2026-07-28 (later).** The paragraph below originally
> blamed `.topbar-actions` being an unwrappable max-content row. A live probe at
> 768px disproved that; see [Probe results](#probe-results-768px) at the end.
> The band diagnosis holds, the mechanism does not.

The cause is a gap between two breakpoints, not a per-page defect:

- **≤760px** (`06-widgets.css:559`): mobile treatment — `.topbar` becomes a
  two-column grid, the route links collapse behind the «المسارات» toggle, and
  `.primary-action-link` / `.focus-mode-toggle` / `.density-toggle` are hidden.
- **≥1120px** (`06-widgets.css:938`): sidebar shell — `.topbar` becomes a
  full-height vertical rail with `.topbar-actions` stretched to `inline-size:
  100%`.
- **761–1119px**: neither applies. `.topbar` falls back to
  `grid-template-columns: auto auto minmax(0, 1fr)` (`06-widgets.css:822`) with
  `.topbar-actions { display: inline-flex; justify-self: start }` — an
  unwrappable max-content row in a cell that cannot hold it.

Impact: on a 768px-wide tablet in portrait — the single most common tablet
width — every navigation link and every header action on every authenticated
page is off-screen and unreachable. Desktop (1280) and phone (375) are both
fine, which is exactly why this survived: the two widths anyone tests by hand
are the two that work.

Recommended follow-up (**V1-819**): give `.topbar-actions` and `.route-links` a
layout for the band, most cheaply by letting them wrap and shrink
(`flex-wrap: wrap; max-inline-size: 100%`) rather than by adding a third
bespoke breakpoint. Not applied here: it is a shell-wide change that needs its
own before/after evidence at 768, 900 and 1119, which is a full 17-minute live
run per iteration.

### N2 — P1 — The nav toggle is unreachable at 375px on five routes

`/search`, `/search/saved`, `/settings/users`, `/uploads` and
`/uploads/scheduled` place the «المسارات» toggle at `left=321 right=423` — 48px
past the 375px viewport. Since the toggle is the only way to reach navigation
at mobile width, these five pages strand the user with no way out except the
browser's back button. Every other 375px route passes, so this is
content-driven: something on these pages widens the topbar's grid track without
growing `document.scrollWidth`.

Recommended follow-up (**V1-820**).

### N3 — P2 — `/rights` renders three copies of a control fully off-screen

`/rights` at 375px reports «فحص الإنفاذ» three times at `left=-314
right=-223` — entirely outside the viewport, roughly one full screen-width to
the inline-start. The triplication suggests a per-row action rendered by a
collapsed or mispositioned container rather than a wrapping problem.

Recommended follow-up (**V1-821**).

### Status of the original findings

- **P1** — fixed in `4b24182e`, and the deeper cause behind its symptom fixed in
  `ba07b380`.
- **P2** — the coverage half was already correct (see above). The evidence half
  is still open: `/files` fails at 768px under N1, so no artifact is written.
- **P3** — `/help` likewise fails at 768px under N1. The static help layout is
  still source-level safe; what blocks it is the shell, not the page.

Both P2 and P3 resolve for free once N1 is fixed — that run will write the
missing `authed--files--viewer--tablet-768.png` and
`authed--help--viewer--tablet-768.png`.

## Probe results (768px)

A throwaway spec loaded `/files` at 768px with a viewer session and reported
layout facts instead of asserting. Results:

```
dir: rtl        docScroll: 768   docClient: 768   shellCols: 768px
topbarDisplay: grid              topbarNavOpen: "false"
offenders: "إضافة مادة" left=-64 right=39 parent=nav-section scroller=NONE
           "الرفعات المجدولة" left=-97 right=39 parent=nav-section scroller=NONE
           … 8 more, all parent=nav-section, all right=39
```

Four facts, and they change the diagnosis:

1. `docScroll === docClient === 768` — the page genuinely does not overflow.
   The controls are clipped, exactly what the assertion exists to catch.
2. `scroller: NONE` — the probe walked each element's ancestors looking for one
   with `overflow-x: auto|scroll` **and** actual horizontal overflow, and found
   none. So these are **not** scrolled-out items in the `.route-links` rail, and
   the assertion is **not** a false positive here. They are unreachable.
3. The parent is `.nav-section`, not `.topbar-actions`. My earlier claim that
   `.topbar-actions` was the unwrappable row is **wrong** — that element is not
   involved.
4. `topbarNavOpen: "false"` with the links still laid out and merely pushed
   off-screen. At ≤760px the closed drawer is removed from layout (which is why
   375 passes) and at ≥1120px the sidebar is permanently open (why 1280 passes).
   In the 761–1119 band it is neither hidden nor open.

So the defect is that **the closed navigation drawer stays in the layout and in
the focus order between 761 and 1119px**, positioned off-screen. That makes it a
keyboard/screen-reader defect as well as a visual one: a keyboard user tabs
through a dozen invisible links. The fix belongs in the drawer's closed state
(removing it from layout in the band, or giving the band the sidebar treatment),
**not** in `.topbar-actions` flex-wrap as V1-819 originally suggested.

One thing the probe did not explain: all ten offenders share `right=39` while
`.route-links` is `display: flex; flex-wrap: nowrap`, which should lay them out
in a row with differing right edges. Something is overriding that to a vertical
stack in this state. Whoever takes V1-819 should resolve that before choosing a
fix — it likely names the real culprit rule.

## N1 fixed (2026-07-28)

Root cause, measured rather than guessed: the overflow nav links live in
`<details class="nav-more">`, and `.nav-section { display: contents }` lets a
`display: contents` box escape the closed disclosure. The links stayed laid out
and in the focus order, painted off the inline-start edge. `>=1120px` was spared
only because the sidebar rules give `.nav-section` a real box.

An isolated Chromium test settled which rule actually fixes it — the first
attempt (`display: grid`) shipped and changed nothing, which is what prompted
measuring instead of reasoning:

| wrapper, `<details>` closed | link box |
|---|---|
| `display: contents` (before) | 41x39 — renders |
| `display: grid` (failed attempt) | 46x40 — still renders |
| `:not([open]) { display: none }` | 0x0 — hidden |

Fix: `.nav-more:not([open]) .nav-section { display: none }` in `01-base.css`,
with a regression assertion in `lib/responsive-layout.test.ts` pinned to that
exact shape (asserting "has some display" would have passed the broken version).

Live result: **134 passed / 17 failed**, from 95/56.

| Viewport | Before | After |
|---|---|---|
| mobile-375 | 42 / 5 | 44 / 6 |
| tablet-768 | 0 / 50 | **39 / 11** |
| desktop-1280 | 49 / 0 | 49 / 0 |

**P2 and P3 of the original audit are now closed**: this run wrote
`visual-evidence/authed--files--viewer--tablet-768.png` and
`authed--help--viewer--tablet-768.png`, the artifacts they were blocked on.

The 11 remaining 768px failures are a separate, much narrower defect — the
command-palette hint "Ctrl / Cmd + K" at `left=-21`, plus one adjacent nav label
on some routes. Filed as V1-822.

## V1-820/V1-822 fixed (2026-07-28, later)

Same root cause as N1/V1-819 but a distinct symptom: below 1120px,
`.topbar-actions` shared an implicit `auto` grid column with `.nav-toggle`,
with no width ceiling. It grew to fit whatever content it held —
the contextual guide link on `/search`, `/uploads`, `/settings/users`; a
longer session-chip name; the `Ctrl / Cmd + K` command-trigger hint at
768px — and pushed `.nav-toggle`, the only way to reach navigation at that
width, off the viewport edge.

Fix: `grid-column: 1 / -1; overflow-x: auto` on `.topbar-actions`, the same
pattern `.route-links` and `.app-breadcrumb` already use. Verified first with
a targeted 8-route probe (5 previously-broken + 3 control routes, both
viewports) before trusting it, then with the full live gate.

**Full gate result: 150 passed / 1 failed**, up from 134/17 after V1-819
alone.

| Viewport | After V1-819 | After V1-820/822 |
|---|---|---|
| mobile-375 | 44 / 6 | 49 / **1** |
| tablet-768 | 39 / 11 | **48 / 0** |
| desktop-1280 | 49 / 0 | **50 / 0** |

The one remaining failure across all 151 tests is `/rights` at mobile-375 —
V1-821, unchanged and untouched by this fix, since it's a different
mechanism entirely: three copies of an enforcement-check button render at
`left=-314` inside a `<table class="data-table">` sitting in a
`div.scroll-x` with `overflow-x: auto`. The table itself is 672px wide in a
317px-wide scroll region, which is the documented, intentional exception —
but the button renders off-screen from the very first paint, not merely
scrolled out by user action. Worth checking on pickup: whether an RTL page's
horizontally-scrollable container defaults its `scrollLeft` to the wrong end
on load, which would explain content appearing pre-scrolled to a
[-355, 0] range instead of starting at `scrollLeft: 0`.
