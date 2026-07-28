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
