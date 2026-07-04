# Masar Legacy Parity Audit

Date: 2026-07-03

This audit is the canonical checklist for completing the Archive Suite legacy-to-Masar migration. The legacy React app remains reference-only; all implementation work belongs in `archive-next`, `archive-laravel`, and `archive-core`.

## Executive Decision

The earlier cutover note that skipped Discover, System Control, Sync Log, First Run, and Montage parity is superseded. Those features now count as migration gaps unless the row below marks them as intentionally merged into a stronger Masar surface.

## Feature Module Coverage

| Legacy feature module | Canonical Masar target | Status | Required action |
|---|---|---|---|
| `archive-app/src/features/activityLog` | `archive-next/app/activity/page.tsx`, future Laravel audit API | Partial | Replace synthetic activity with audit-backed history and undo/diffs. |
| `archive-app/src/features/ai` | Future `archive-next/app/copilot/page.tsx` | Missing | Add AI assist surface with disabled/config-required state when no provider is configured. |
| `archive-app/src/features/analytics` | `archive-next/app/analytics/page.tsx` | Migrated | Keep in smoke coverage. |
| `archive-app/src/features/archive` | `archive-next/app/archive/page.tsx`, `archive-next/app/archive/[id]/page.tsx` | Partial | Add richer add/archive wizard; relation preview, private item notes, audit-backed history, and team comments are now wired. |
| `archive-app/src/features/automation` | `archive-next/app/automation/page.tsx` | Partial | Persist rules in Laravel and add execution log. |
| `archive-app/src/features/autosave` | Draft handling in Next forms | Partial | Add shared draft/session recovery helpers for intake forms. |
| `archive-app/src/features/collections` | `archive-next/app/collections/page.tsx` | Partial | Move local collections and smart rules to Laravel storage. |
| `archive-app/src/features/comments` | `archive-next/app/media/review/page.tsx`, `archive-next/app/archive/[id]/page.tsx` (Laravel `/records/{id}/comments`) | Migrated | Team record comments with soft-delete and audit logging are wired; keep in smoke coverage. |
| `archive-app/src/features/copilot` | Future `archive-next/app/copilot/page.tsx` | Missing | Restore copilot command/summary affordances with safe provider gating. |
| `archive-app/src/features/dashboard` | `archive-next/app/page.tsx` | Partial | Restore configurable widgets only after persistent preferences exist. |
| `archive-app/src/features/data-center` | `archive-next/app/data-center/page.tsx` | Migrated | Operational hub tying uploads, ingest, backup, status, and settings together is now wired; keep in smoke coverage. |
| `archive-app/src/features/discover` | `archive-next/app/discover/page.tsx` | Migrated | Keep recommendation feedback and smoke coverage. |
| `archive-app/src/features/dnd` | `archive-next/app/kanban/page.tsx` and UI primitives | Migrated | Keep as shared interaction plumbing. |
| `archive-app/src/features/errors` | `archive-next/app/errors/page.tsx` | Migrated | Keep in smoke coverage. |
| `archive-app/src/features/field-acl` | `archive-next/app/types/page.tsx`, Laravel type contracts | Partial | Add field-level visibility/editing rules. |
| `archive-app/src/features/file-manager` | `archive-next/app/files/page.tsx` | Partial | Add handoff/intake queue actions from legacy file manager. |
| `archive-app/src/features/focus` | Masar shell and command palette | Partial | Add focus mode only if operators still need distraction-free workflows. |
| `archive-app/src/features/folders` | `archive-next/app/files/page.tsx` | Partial | Add durable folder metadata and saved folder views. |
| `archive-app/src/features/graph` | `archive-next/app/graph/page.tsx`, Laravel `/relations/graph` | Migrated | Keep graph filters, creation flow, and smoke coverage. |
| `archive-app/src/features/guide` | `archive-next/app/help/page.tsx` | Partial | Add contextual tour/tips launcher. |
| `archive-app/src/features/help` | `archive-next/app/help/page.tsx` | Migrated | Keep updated as new routes land. |
| `archive-app/src/features/hierarchical-tags` | `archive-next/app/tags/page.tsx`, future `/tags/hierarchy` | Partial | Restore tree ordering, colors, merge, and hierarchy operations. |
| `archive-app/src/features/history` | `archive-next/app/activity/page.tsx`, `archive-next/app/archive/[id]/page.tsx` (Laravel `/records/{id}/history`) | Partial | Audit-backed per-record history is now wired; still add restore/undo decisions. |
| `archive-app/src/features/import` | `archive-next/app/ingest/page.tsx`, `archive-next/app/uploads/page.tsx` (Laravel `/import/preview`) | Migrated | Import-from-url metadata preview with SSRF-safe validation is now wired; keep in smoke coverage. |
| `archive-app/src/features/itemNotes` | `archive-next/app/archive/[id]/page.tsx`, Laravel `/records/{id}/notes` | Migrated | Keep private note CRUD in smoke/API coverage. |
| `archive-app/src/features/layout` | `archive-next/components/AppShell.tsx`, `archive-next/components/AppHeader.tsx` | Migrated | Shared shell only. |
| `archive-app/src/features/media` | `archive-next/app/media/*`, `archive-next/components/MediaPlayer.tsx`, `archive-next/components/MediaSourcePicker.tsx` | Partial | Play/compare now browse stored files via `/files/browser` instead of raw path entry; SRT/VTT transcript helper remains manual-paste only. |
| `archive-app/src/features/montage` | `archive-next/app/projects/page.tsx`, Laravel `montage_export` media job | Partial | MP4 export now runs as an async Laravel media job (ffmpeg concat, queued, polled); multi-track, markers/comments, and transitions are still legacy-only. |
| `archive-app/src/features/navigation` | `archive-next/lib/navigation.ts`, `archive-next/components/CommandPalette.tsx` | Migrated | Update after every new route. |
| `archive-app/src/features/notifications` | `archive-next/components/ui/Toast.tsx`, future notifications center | Partial | Add persistent operation notifications and push bridge if needed. |
| `archive-app/src/features/offline` | Future offline/sync support in `archive-next/components/AppProviders.tsx` | Missing | Add connectivity probe, offline queue, and degraded-mode banners. |
| `archive-app/src/features/onboarding` | Future `archive-next/app/first-run/page.tsx` or `/onboarding` | Missing | Add first-run setup gate and preset setup. |
| `archive-app/src/features/projects` | `archive-next/app/projects/page.tsx` | Partial | Persist projects and production tasks in Laravel. |
| `archive-app/src/features/recommendations` | `archive-next/app/discover/page.tsx` | Partial | Discovery feedback exists; add detail-page improvement suggestions later. |
| `archive-app/src/features/relations` | `archive-next/app/archive/[id]/page.tsx`, `archive-next/app/graph/page.tsx`, Laravel `/relations*` | Partial | Stored relations and graph exist; add inline detail add-dialog/toasts for full legacy parity. |
| `archive-app/src/features/rights` | `archive-next/app/rights/page.tsx`, Laravel rights API | Migrated | Keep in contract tests. |
| `archive-app/src/features/search` | `archive-next/app/search/page.tsx`, `archive-next/app/search/saved/page.tsx` (Laravel `/saved-searches`) | Partial | Saved-search manager is now wired; still add backend facets. |
| `archive-app/src/features/server-status` | `archive-next/app/status/page.tsx` (Laravel `/system/status`) | Migrated | Live CPU/memory/disk/queue metrics and DR readiness are now wired; keep in smoke coverage. |
| `archive-app/src/features/settings` | `archive-next/app/settings/page.tsx` | Partial | Restore appearance, file-store tests, Dropbox OAuth, presets, DB tests. |
| `archive-app/src/features/share` | `archive-next/app/shares/page.tsx`, `archive-next/app/share/[token]` | Partial | Add shared-with-me inbox/history. |
| `archive-app/src/features/shortcuts` | `archive-next/components/CommandPalette.tsx`, future settings shortcut editor | Partial | Add shortcut learning/customization state. |
| `archive-app/src/features/storage` | Laravel storage services | Migrated | Shared plumbing only. |
| `archive-app/src/features/suggestions` | Future discover/search suggestions | Missing | Add suggestion engine and feedback hooks. |
| `archive-app/src/features/sync` | `archive-next/app/sync/page.tsx`, Laravel `/sync` | Partial | Sync log and conflict-state listing are now wired; still add selective sync policy. |
| `archive-app/src/features/systemControl` | `archive-next/app/system/control/page.tsx` (Laravel `/system/control/{action}`) | Migrated | Admin-only, env-gated (`SYSTEM_CONTROL_ENABLED`) host actions with audit logging for allowed/blocked attempts are now wired; keep in smoke coverage. |
| `archive-app/src/features/templates` | `archive-next/app/types/page.tsx`, `archive-next/app/uploads/page.tsx` (Laravel `/intake-templates`) | Migrated | Reusable archive-entry intake templates are now wired into the upload wizard; keep in smoke coverage. |
| `archive-app/src/features/theme` | `archive-next/components/ThemeToggle.tsx`, `archive-next/app/theme.css` | Partial | Add presets, custom theme export/import, and schedule if still required. |
| `archive-app/src/features/timeline` | `archive-next/app/timeline/page.tsx` | Migrated | Add SVG export only if needed. |
| `archive-app/src/features/types` | `archive-next/app/types/page.tsx` | Partial | Add field ACL/templates integration. |
| `archive-app/src/features/ui` | `archive-next/components/ui/*`, `archive-next/app/globals.css` | Migrated | Shared primitives only. |
| `archive-app/src/features/upload` | `archive-next/app/uploads/page.tsx` (Laravel `/upload-links`) | Partial | Shareable upload links are now wired; still add full AddVideo wizard metadata parity. |
| `archive-app/src/features/users` | `archive-next/app/settings/users/page.tsx`, Laravel users API | Migrated | Keep admin-only coverage. |
| `archive-app/src/features/videos` | `archive-next/app/uploads/page.tsx`, `archive-next/app/archive/[id]/page.tsx` | Partial | Restore quick add and video-specific metadata workflow. |
| `archive-app/src/features/views` | `archive-next/app/kanban/page.tsx`, saved views in archive/search | Partial | Persist saved views and board views. |
| `archive-app/src/features/vocabulary` | `archive-next/app/vocabulary/page.tsx` | Partial | Persist vocabulary and merge operations in Laravel. |
| `archive-app/src/features/workflow` | `archive-next/app/archive/page.tsx`, `archive-next/app/kanban/page.tsx` | Partial | Persist recent defaults and workflow presets. |

## Legacy Page Coverage

| Legacy page | Canonical Masar route | Status | Required action |
|---|---|---|---|
| `archive-app/src/pages/ActivityPage.tsx` | `/activity` | Partial | Back with Laravel audit history. |
| `archive-app/src/pages/AddVideoPage.tsx` | `/uploads`, future `/archive/new` | Partial | Intake templates and import-from-url preview are now wired; still restore full multi-step wizard metadata flow. |
| `archive-app/src/pages/AnalyticsPage.tsx` | `/analytics` | Migrated | Keep smoke coverage. |
| `archive-app/src/pages/AppearanceSettingsPage.tsx` | Future `/appearance` or `/settings/appearance` | Missing | Add appearance editor/presets. |
| `archive-app/src/pages/ArchivePage.tsx` | `/archive` | Partial | Add richer filters, details rail parity, and saved views persistence. |
| `archive-app/src/pages/AutomationPage.tsx` | `/automation` | Partial | Persist and execute rules. |
| `archive-app/src/pages/CollectionsPage.tsx` | `/collections` | Partial | Persist collections. |
| `archive-app/src/pages/DashboardPage.tsx` | `/` | Partial | Restore configurable widgets if required. |
| `archive-app/src/pages/DataCenterPage.tsx` | `/data-center` | Migrated | Data-center hub is now wired. |
| `archive-app/src/pages/DetailPage.tsx` | `/archive/[id]` | Partial | Add inline relation editing; relation preview, private notes, team comments, and audit-backed history are now wired. |
| `archive-app/src/pages/DiscoverPage.tsx` | `/discover` | Migrated | Keep smoke coverage. |
| `archive-app/src/pages/DuplicatesPage.tsx` | `/duplicates` | Partial | Add merge/undo and visual duplicate checks. |
| `archive-app/src/pages/ErrorLogPage.tsx` | `/errors` | Migrated | Keep smoke coverage. |
| `archive-app/src/pages/FavoritesPage.tsx` | `/favorites` | Migrated | Keep smoke coverage. |
| `archive-app/src/pages/FileManagerPage.tsx` | `/files` | Partial | Restore handoff and ingest queue actions. |
| `archive-app/src/pages/FirstRunPage.tsx` | Future `/first-run` or `/onboarding` | Missing | Add first-run gate. |
| `archive-app/src/pages/GraphViewPage.tsx` | `/graph` | Migrated | Keep smoke coverage and continue refining graph controls. |
| `archive-app/src/pages/HelpPage.tsx` | `/help` | Migrated | Add contextual guide hooks. |
| `archive-app/src/pages/HierarchicalTagsPage.tsx` | `/tags`, future `/tags/hierarchy` | Partial | Restore advanced hierarchy editor. |
| `archive-app/src/pages/HistoryPage.tsx` | `/activity`, `/archive/[id]` history tab | Partial | Audit-backed record history tab is now wired; still add diff and restore decisions. |
| `archive-app/src/pages/InboxPage.tsx` | `/inbox` | Partial | Persist inbox queue. |
| `archive-app/src/pages/KanbanPage.tsx` | `/kanban` | Migrated | Persist view presets later. |
| `archive-app/src/pages/ProductionTasksPage.tsx` | `/projects` or future `/production/tasks` | Partial | Add production task persistence if still required. |
| `archive-app/src/pages/ProjectsPage.tsx` | `/projects` | Partial | Async MP4 export (Laravel `montage_export` media job, status polling) is now wired; multi-track editing and persistent (non-local) projects remain. |
| `archive-app/src/pages/ReadingListsPage.tsx` | Future `/reading-lists` | Missing | Add route or merge into collections with explicit parity note. |
| `archive-app/src/pages/ReportsPage.tsx` | `/reports` | Migrated | Keep smoke coverage. |
| `archive-app/src/pages/SavedSearchesPage.tsx` | `/search/saved` | Partial | Saved-search manager (list/create/delete/run) is now wired; still add alerts. |
| `archive-app/src/pages/SearchPage.tsx` | `/search` | Partial | Add backend facets. |
| `archive-app/src/pages/ServerStatusPage.tsx` | `/status` | Migrated | Live resource metrics and DR readiness are now wired. |
| `archive-app/src/pages/SettingsHubPage.tsx` | `/settings` | Partial | Add hub sections for appearance/system/data center. |
| `archive-app/src/pages/SettingsPage.tsx` | `/settings` | Partial | Restore admin extras. |
| `archive-app/src/pages/SharedLinksPage.tsx` | `/shares` | Migrated | Add backend link history if needed. |
| `archive-app/src/pages/SharedWithMePage.tsx` | Future `/shares/with-me` | Missing | Add inbound share inbox/history. |
| `archive-app/src/pages/SyncLogPage.tsx` | `/sync` | Partial | Sync log page with conflict states is now wired; still add selective sync policy controls. |
| `archive-app/src/pages/SystemControlPage.tsx` | `/system/control` | Migrated | Safe admin control page (env-gated, admin-only, audit-logged) is now wired. |
| `archive-app/src/pages/TimelinePage.tsx` | `/timeline` | Migrated | Add SVG export if needed. |
| `archive-app/src/pages/TranscriberPage.tsx` | `/transcriber` | Migrated | Keep media job coverage. |
| `archive-app/src/pages/TypesPage.tsx` | `/types` | Partial | Add field ACL. |
| `archive-app/src/pages/UploaderPage.tsx` | `/uploads` | Partial | Upload links are now wired; still add multi-file manager. |
| `archive-app/src/pages/UsersPage.tsx` | `/settings/users` | Migrated | Keep admin-only coverage. |
| `archive-app/src/pages/VocabularyPage.tsx` | `/vocabulary` | Partial | Persist and merge vocabulary. |

## Priority Execution Slices

1. Auth/session and first-run gate: login is fixed in `fix(next): restore login session flow`; next add `/first-run`.
2. Discovery and relations: `/discover`, `/graph`, relation storage, and record detail relation panel.
3. Archive intake depth: `/archive/new` or richer `/uploads` wizard, templates, item notes, import-from-url, upload links.
4. History and sync: audit-backed `/activity`, record history, `/sync`, conflict log, and undo/diff decisions.
5. Operations: `/data-center`, `/status` live metrics, `/system/control`, backup/admin extras — done (this slice also added the DR probe and self-service user data export at `/account/export`).
6. Power-user UX: saved search manager, reading lists, appearance editor, shortcuts, contextual guide.
7. Media/project parity: media source picker and play/compare wiring are done; async MP4 export ships as a Laravel `montage_export` media job — advanced multi-track montage (markers/comments/transitions) remains legacy-only.
8. Enterprise integrations: MOS/MXF metadata surface (Laravel `/records/{id}/broadcast-metadata`, `archive-next/components/BroadcastMetadataPanel.tsx`) is now wired with explicit "configuration required" gating when `MOS_ENDPOINT`/`MXF_ENDPOINT` are unset; backup checksum/encryption/retention remain open. (User data export and DR probes shipped in slice 5.)

## Verification Rule

`pnpm run verify:repo-hygiene` must fail if a legacy feature directory or legacy `*Page.tsx` file is not listed in this document. This keeps the migration checklist complete while implementation proceeds in smaller commits.
