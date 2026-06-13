# Archive Enhancements from the Legacy Build — Work Plan

**Status:** Planned · **Date:** 2026-05-28 · **Source:** UI/UX mining of `Base_old/video-archive.html` (112k lines / 5.6 MB legacy single-file build)

## Context

The legacy build was mined for UI/UX strengths worth porting. Most of its surface is already matched or exceeded by the current app (Arabic-locale sorting, hierarchical tags, collections, content types, backup, shortcuts, and the new theme v2). Four genuine gaps were confirmed against the current codebase and are captured here as work items.

This plan was written **after** examining the current custom-fields system and the archive page layout (see "Codebase examination" below), so each item lists the exact files/functions to touch.

---

## Codebase examination (current state)

### Custom-fields system — `src/features/types/viewModel.js`
- `FIELD_TYPE_OPTIONS` (11 types): text, textarea, number, date, select, tags, checkbox, url, **duration**, **thumbnail**, localFile. **No `rating`.**
- `FIELD_TYPE_IDS` is a `Set` derived from `FIELD_TYPE_OPTIONS` — adding an entry there auto-validates the new type in `createCustomFieldValue` (line 38).
- `createCustomFieldValue` already carries rich metadata: `searchable`, `hidden`, `multiple`, `defaultValue`, `options`, `placeholder`, `description`, `groupId`, `status` (active/archived), `order`. **No schema change needed for rating** — it's just another `type` string; the value lives in the item's `metadata[storageKey]`.
- Default content types (`DEFAULT_ARCHIVE_CONTENT_TYPE_DEFINITIONS`, 6 presets) are rich but **none ship a rating or review-status field**.

### Field rendering — 3 renderers must each gain a branch
1. `src/pages/AddVideoPage.jsx` → `FieldInput` (≈ lines 152-177): branches for textarea/checkbox/select/tags/localFile, else generic `<input>`.
2. `src/pages/DetailPage.jsx` → `EditableField` (≈ lines 77-85): same branch shape.
3. `src/pages/DetailPage.jsx` → `ReadonlyField` (≈ lines 88-95): renders the stored value read-only.
- `TypesPage` `FieldsEditor` (PR #28): the type `<select>` is driven by `FIELD_TYPE_OPTIONS`, so a new type appears automatically. The "options" sub-input only shows for select/tags/radio/multiselect — rating needs no options, so no change there.

### Archive page layout — split in PR #33
- `src/pages/ArchivePage.jsx` (191 lines) composes `useArchivePageState` + `ArchivePageHero` + `ArchivePageDetailedFilters` + `ArchivePageResults`.
- `ArchivePageResults.jsx`: results grid is `grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]` (items + 360px preview panel). The view-mode switch (grid/list/table/tiles) renders `VideoCard`/`VideoListItem`/`VideoTableView`/`VideoTileItem` from `ArchiveViews.jsx`.
- `ArchiveViews.jsx`: every variant renders `item.isFavorite` as a "مفضلة" badge (lines 382/483/563/650). **`isFavorite` is a root-level boolean on the item**, not a custom field — so a star badge here is easy, but a *rating* is a per-content-type custom field living in `metadata`, which the generic card doesn't know how to find. Surfacing rating on cards therefore needs the card to be told which field (if any) is the type's "primary rating" — deferred to a phase 2.

---

## Work items

### Item 1 — `rating` custom field type (★★★ priority)
A first-class 5-star rating field, matching the legacy `type: "rating"`.

**Scope:**
- `viewModel.js`: add `{ id: "rating", label: "تقييم" }` to `FIELD_TYPE_OPTIONS` (auto-validates via `FIELD_TYPE_IDS`).
- New shared component `src/components/common/StarRating.jsx`: a controlled 1–5 star input (clickable, keyboard-accessible, hover preview, `aria-label` per star, RTL-aware, sizes sm/md) + a read-only display mode. Amber fill (`fill-amber-400`) on selected, muted otherwise — honors theme v2 tokens.
- Wire the `rating` branch into the 3 renderers (AddVideoPage `FieldInput`, DetailPage `EditableField` interactive; DetailPage `ReadonlyField` read-only).
- Value stored as a number 0–5 in `metadata[storageKey]`. 0 / undefined = unrated.

**Verification:** create a type with a rating field → AddVideo shows clickable stars → Detail shows + edits them → value persists in IndexedDB and survives reload. axe-core: stars are keyboard-operable with labels.

**Risk:** low. Additive; no schema migration; behind the existing custom-field machinery.

### Item 2 — Rating + review-status presets on default content types (★★ priority)
Enrich the 6 default content types with the legacy archival vocabulary so new users get useful fields out of the box.

**Scope (`DEFAULT_ARCHIVE_CONTENT_TYPE_DEFINITIONS`):**
- Add a `التقييم` (rating) field to the relevant types (programs, social-clips, interviews).
- Add a `حالة المراجعة` (review status) `select` field with options `["يحتاج مراجعة", "قيد المراجعة", "معتمد"]` to programs + reports.
- Consider adding broadcast-archive fields seen in legacy where they fit: `تاريخ البث` (date), `سنة الإنتاج` (number), `المدة` (duration — already a type), `الربط الخارجي` (url).
- `getMissingDefaultArchiveContentTypes` only seeds types the user doesn't have, so existing installs are unaffected; this only improves the first-run set.

**Verification:** fresh install → new types carry the rating + review-status fields; AddVideo renders them.

**Risk:** low. Data-definition only; existing users keep their types.

### Item 3 — Item-level "review status" surfacing (★ priority, depends on Item 2)
Once review-status fields exist, surface a small status chip on archive cards/rows for at-a-glance triage.

**Scope:** teach `ArchiveViews` variants to read a designated review-status field. Because review status is a custom field (in `metadata`), the cleanest approach is a convention: a field whose `storageKey === "reviewStatus"` is treated as the card's status chip. Render it via the existing `.va-2-chip` semantic variants (warning = يحتاج مراجعة, info = قيد المراجعة, success = معتمد).

**Verification:** items with a reviewStatus value show the colored chip in grid/list/table; items without it show nothing.

**Risk:** medium (touches the shared card components + needs the storageKey convention documented).

### Item 4 — Surface rating on archive cards (★ priority, depends on Item 1, phase 2)
Show the star rating on cards/rows, like the review chip in Item 3, via a `storageKey === "rating"` convention. Same risk profile as Item 3.

---

## Sequencing

1. **PR — Item 1** (rating field type + StarRating component + 3 renderer branches). Self-contained, highest value, lowest risk. Ship first.
2. **PR — Item 2** (default-type presets). Tiny, builds on Item 1.
3. **PR — Items 3 + 4** (card surfacing via storageKey conventions). Together, since they share the card-convention mechanism.

## Deeper pass — data-model comparison (legacy SQLite schema vs current)

Extracting the legacy `CREATE TABLE` schema revealed its full data model. Cross-checked against the current app, these additional items surfaced:

### Item 5 — Video bookmarks / time-markers ("إشارات مرجعية") (★★★ priority — LATENT)
Legacy `bookmarks(itemId, timestamp REAL, label, description)` = named markers at a specific second inside a video, with insert/delete ("إدراج/حذف إشارة مرجعية").
- **Current state:** the `BOOKMARKS` IndexedDB store EXISTS (schema.js, archiveSlice loadAllData, and the data-portability layer already import/export/validate it) — but there is **zero UI**. It's a fully latent feature.
- **Scope:** a `normalizeBookmark` model + a bookmarks slice (add/remove/list by itemId) + a "إشارات مرجعية" panel on `DetailPage` (add at a timestamp, label, jump-to). Highest archival value; the persistence + transfer plumbing is already done.
- **Risk:** low-medium (additive UI + a slice; store + transfer already exist).

### Item 6 — Video relations ("روابط بين المواد") (★★ priority — LATENT)
Legacy `video_relations(sourceId, targetId, relationType, label)` = links between items (related / part-of / sequel).
- **Current state:** the `relations` store EXISTS (loaded in archiveSlice, handled by data-portability) but has **no UI**.
- **Scope:** a relations slice + a "مواد ذات صلة" section on `DetailPage` (link/unlink + navigate). 
- **Risk:** medium (new UI + slice; store exists).

### Item 7 — Surface avatar + email on users (★ priority — LATENT)
Legacy users had `avatar, email`. The current user model (`normalizeUser`) already carries `avatar`, `email`, `customPermissions` — but the `UserForm` only edits username/displayName/role/password, so avatar + email are never set or shown.
- **Scope:** add avatar (emoji/initial/color) + email inputs to `UserForm`; show avatar on user cards + the sidebar widget.
- **Risk:** low. Modest value (nicer identity); fields already in the model.

### Item 8 — Custom roles + permissions registry (☆ strategic — ABSENT, big scope)
Legacy had `roles(name, nameAr, permissions[], isDefault)` + `permissions(name, category, isDangerous)` + per-user `customPermissions` — i.e. admins could define their own roles, categorize permissions, flag dangerous ones, and override per user.
- **Current state:** the app uses a **deliberate fixed 3-role matrix** (`ROLE_ACTIONS`: admin/editor/viewer) chosen in Phase 3 for simplicity. `customPermissions` exists on the model but isn't honored or editable.
- **Assessment:** this is a large RBAC expansion (custom-role CRUD, a permissions registry UI, merging role + custom permissions in `canPerform`). Only worth it if granular/custom roles are genuinely needed. **Recommend deferring** unless required — the fixed matrix covers the common case.

### Already covered / deliberately not needed
- **Saved searches** (legacy `saved_searches`) ≈ current **saved views** (`savedArchiveViews`, max 12 on Archive). Covered.
- **Per-user theme/density/sidebar** (legacy `user_settings`) — current handles via `settings.ui` (per install). Covered for single-device; per-account split is YAGNI here.
- **Sessions/multi-device** (legacy `sessions`/`user_sessions`) — current uses a random session token + 12h TTL + the new device-identity/sync layer. Sufficient; no IP/userAgent tracking needed for a local-first tool.
- **user_profiles** (bio/location/website/socialLinks) — YAGNI for an internal archive.

## Updated sequencing (all items)

1. **Item 1** — rating field type (self-contained, highest value, lowest risk).
2. **Item 5** — video bookmarks UI (latent, high archival value, plumbing done).
3. **Item 2** — rating + review-status presets on default types.
4. **Item 6** — video relations UI (latent).
5. **Items 3 + 4** — surface rating + review-status chips on archive cards.
6. **Item 7** — avatar + email on users (small polish).
7. **Item 8** — custom roles (strategic, deferred unless needed).

## Out of scope (legacy features deliberately NOT ported)
- The legacy build is a Tailwind-compiled bundle with only the stock `bounce/ping/pulse/spin` keyframes — no custom motion worth porting (theme v2's spring + glassmorphism already exceed it).
- Arabic-locale sorting — already present in 6 modules.
- QR / print — confirmed false positives (base64 alphabet + WASM `k.print`), not real legacy features.
