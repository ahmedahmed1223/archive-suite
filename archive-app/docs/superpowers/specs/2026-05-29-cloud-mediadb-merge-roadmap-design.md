# CLOUD-MediaDB Feature Merge — Roadmap Design

**Status:** Approved (scope + sequencing) · **Date:** 2026-05-29 · **Owner:** info@aqnetwork.net

## Context

The user asked to (1) make page tabs/lists always horizontal, and (2) merge features from the sibling project **CLOUD-MediaDB** ("Remix: باحث الأرشيف", a TypeScript app: Dropbox + Firebase + Gemini AI). A thorough read of that repo's code tree, `package.json`, and three planning docs (`FUTURE_ROADMAP.md`, `ARCHIVE_ENHANCEMENT_PLAN.md`, `PROJECT_PLAN.md`) was done via the GitHub API.

**Architectural constraint (non-negotiable):** the current app is offline-first — IndexedDB only, single-file build (`vite-plugin-singlefile`), no backend. CLOUD-MediaDB is cloud-based (Express server + Dropbox + Firebase + Gemini). Therefore only its **client-side, no-backend** features are in scope. CLOUD-MediaDB's own enhancement plan explicitly targets "المنطق البرمجي المباشر دون الاعتماد على الذكاء الاصطناعي" — so most of its archival UX is offline-compatible by design.

## Excluded (require backend / heavy deps — conflict with offline-first)
- Dropbox storage (`dropbox`), Firebase sharing / `SharedProjectView` (`firebase`), Express server, sessions/multer.
- Gemini AI (`@google/genai`) and local transcription via `@xenova/transformers` (browser ML models are hundreds of MB — incompatible with the single-file build).
- `recharts` charts — optional/heavy; the existing Reports page covers analytics without it.

## In scope — 11 offline-compatible features + 1 layout fix

### PR 0 — Tabs always horizontal (layout fix, FIRST)
**Decision:** Settings + DataCenter tabs render as a horizontal top bar at **all** widths — no vertical sidebar at lg+. (Current behavior: horizontal scroller below lg, vertical sidebar ≥1024px — the user wants horizontal always.)
- `SettingsTabs` (`src/features/settings/SettingsControls.jsx`): drop the `lg:block / lg:flex-col` sidebar branch; keep the flex horizontal-scroll bar at all widths. Remove the `lg:flex lg:w-full` per-tab rules so tabs stay intrinsic chips.
- `SettingsPage`: outer grid `lg:grid-cols-[260px_…]` → single column (tabs bar on top, content below).
- `DataCenterPage` + `DataCenterViews.TabButton`: same — `lg:flex-col` container → always-horizontal bar; full-width-row tab rules dropped.
- Active-pill framer-motion `layoutId` animation preserved.

### Tier A — highest value, pure logic

**PR 1 — File Completeness Metrics ("مؤشرات جودة التوصيف")**
Colored per-item completeness score: 🟢 ≥ threshold-high / 🟡 mid / 🔴 low.
- New `src/features/archive/completeness.js`: `computeCompleteness(item, contentType)` → returns `{ percent, tier, missing[] }`. Weighs core fields (title, path/localFile, type) + the type's required custom fields + (optionally) tags/notes.
- Surface: a colored ring/badge on archive cards (`ArchiveViews`) + a breakdown line on `DetailPage`. Dashboard metric "مواد تحتاج تدقيق".
- Pure client; no schema change.

**PR 2 — Time-stamped markers ("الوسوم/الإشارات الزمنية")**
Bookmarks at a video timestamp with a label; click jumps to that moment. **Activates the latent `BOOKMARKS` store** (already in schema + import/export, zero UI today).
- `normalizeBookmark` model `{ id, itemId, timestamp(sec), label, description, createdAt }` + a bookmarks slice (add/remove/list-by-item).
- `DetailPage`: an "إشارات مرجعية" panel under the player — add at current time, list sorted, click → seek the `<video>`.

**PR 3 — Intersection Engine ("مواد ذات صلة")**
Auto-compute related items by shared tags + matching type/subtype, with a mathematical reason and a % score. Smarter than manual relations — no manual linking needed.
- New `src/features/archive/relatedItems.js`: `getRelatedItems(item, allItems, { limit })` → ranked `[{ item, score, sharedTags[], reason }]`. Score = weighted(shared tags, same type, same subtype).
- `DetailPage`: a "مواد قد ترتبط بهذا السياق" panel listing top matches with their reason chip; click navigates.

### Tier B — strong UX

**PR 4 — Conditional fields + strict validation**
- Extend `createCustomFieldValue` with `showWhen: { fieldKey, equals }` and `requiredToSave: bool`.
- `getFieldsForSelection` / the 3 field renderers (AddVideoPage `FieldInput`, DetailPage `EditableField`/`ReadonlyField`) honor `showWhen` (hide unless the referenced field matches).
- AddVideo/Detail save path blocks when a `requiredToSave` field (or `required`) is empty, with a clear Arabic message. TypesPage `FieldsEditor` gains the showWhen + requiredToSave controls.

**PR 5 — Gap detection ("كشف فجوات التوصيف")**
Builds on PR 1. Warn for items with custom tags but no structural classification, or no tags at all. Surfaced as a Dashboard panel + an archive filter "بحاجة لتوصيف".

**PR 6 — Predictive autocomplete**
Upgrade the existing @-vocabulary / #-tags autocomplete to rank suggestions by (a) tag frequency within the selected content type, (b) historically co-occurring tags. Pure ranking over existing data; no new store.

**PR 7 — Split-pane DetailPage ("الواجهة المنقسمة")**
Reshape DetailPage so the video player is pinned (top/side) while metadata + tags + markers + related panels scroll in the other pane — seamless tagging without losing the player. Houses the PR 2 + PR 3 panels cleanly. Sticky player on lg+, stacked on mobile.

### Tier C — nice-to-have

**PR 8 — TagCloud** — a tag-frequency cloud (size ∝ usage) that filters the archive on click. Lightweight; reads existing tag data.

**PR 9 — GraphView** — a relationship network visualization (nodes = items, edges = shared-tag strength from PR 3's engine). Built as a lightweight inline SVG/force layout — **no d3/recharts** (bundle discipline). New lazy page.

**PR 10 — Version history + rollback** — governance feature. **Prerequisite (verified):** the current `changeHistory` record is only `{ itemId, action, title, timestamp }` — it does NOT capture field-level `oldValue`/`newValue` (unlike the legacy `change_history(field, oldValue, newValue)` schema). So true rollback is NOT reconstructable from existing history. This PR therefore splits in two: (10a) extend `updateVideoItem` to record a field-level diff (`{ field, oldValue, newValue }`) per change going forward; (10b) a per-item "سجل التعديلات" timeline + restore-to-previous-version that replays diffs. Rollback only works for changes recorded after 10a ships — documented as a known limitation for pre-existing items.

**PR 11 — Query-based smart collections** — the collections model already has `type: "smart"`. Verify/extend so a smart collection stores a query (tags/type/date filters) and resolves live. Mostly a completion of existing partial support.

## Sequencing & dependencies
1. **PR 0** (tabs) — first, independent, fixes a reported bug.
2. **PR 1 → PR 2 → PR 3** (Tier A).
3. **PR 4, PR 5 (needs PR 1), PR 6, PR 7** (Tier B). PR 7 reshapes DetailPage; PR 2/PR 3 panels can either land in the old layout first then move, or PR 7 can be pulled earlier — decide at plan time.
4. **PR 8, PR 9 (needs PR 3), PR 10, PR 11** (Tier C).

Each PR is independently shippable with `npm run verify` + `npm run build` green and is gated behind the existing review discipline (subagent spec + code review).

## Relationship to the prior legacy plan
This supersedes/absorbs `2026-05-28-archive-enhancements-from-legacy.md`:
- Legacy "rating field" remains valuable and complements PR 1 (completeness can weight a rating field) — fold into Tier A as an optional PR 1.5.
- Legacy "video relations" (manual) is replaced by the smarter PR 3 Intersection Engine + PR 9 GraphView.
- Legacy "review-status chip" is subsumed by PR 1 completeness tiers + PR 5 gap detection.

## Verification per PR
- `npm run verify` (incl. theme-v2 storage tests) + `npm run build` (bundle stays reasonable; no heavy deps added).
- Manual smoke per feature (described in each PR's plan).
- Subagent two-stage review (spec compliance + code quality) before merge.

## Future direction: cloud migration (post-roadmap)

**The user has stated the end goal is to turn this app into a cloud system like CLOUD-MediaDB** (backend + Dropbox/Firebase-style storage + sharing). The offline-first state is therefore a *stage*, not the destination. This roadmap is built **cloud-migration-aware** so none of the 11 features have to be rewritten later:

- **Keep all persistence behind the existing `dbGet/dbPut/dbGetAll` wrappers** (`src/services/storage/`). The later cloud layer swaps the IndexedDB implementation for a remote/synced one in ONE place; feature code that only calls the wrappers migrates for free.
- **Feature logic stays storage-agnostic and pure** — completeness, related-items, autocomplete ranking, conditional-field evaluation all operate on in-memory entities, so they work identically against local or cloud-backed data.
- **The sync scaffolding already shipped is the migration bridge**: `deviceId` + `syncVersion` + `lastModifiedBy` (PRs #35/#36), conflict detection + 3-way merge (PRs #39/#41/#42), and `audit_logs` give us the per-entity versioning a cloud backend needs. PR 10's field-level diffs further strengthen this.
- **Don't bake offline-only assumptions** into new features (e.g. no "this is the only device" logic; respect the existing multi-device sync model).

A dedicated **cloud-migration spec** will be brainstormed separately after this roadmap ships. Likely scope at that time: a backend choice (Firebase/Supabase/custom), auth migration, Dropbox/Drive file linking, real-time presence, and shared projects — each its own spec → plan → PR cycle. Out of scope for THIS roadmap; recorded here only to guide design decisions now.

## Open questions
None blocking. Split-pane sequencing (PR 7 early vs mid) is a plan-time decision, not a design ambiguity.
