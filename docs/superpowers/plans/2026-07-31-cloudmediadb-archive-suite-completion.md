# CloudMediaDB Archive Suite Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify and close AS-01 through AS-18 in the canonical Laravel and Next.js product, adding only evidenced gaps and committing each AS item independently.

**Architecture:** Existing canonical controllers, OpenAPI contract, manual Next API client, and operational pages are the only implementation surface. Each AS item is an acceptance slice: prove existing behavior with focused tests, add a failing test before any gap fix, then update the ledger and changelog after green verification.

**Tech Stack:** Laravel/PHPUnit/Docker, Next.js/React 19, TypeScript/Vitest/Playwright, OpenAPI JSON, pnpm.

## Global Constraints

- Change only `archive-laravel`, `archive-next`, and `docs/api` for product behavior.
- Use a failing test before every production-code change.
- Public API changes update OpenAPI, the Next API client, generated bindings, and contract checks together.
- Never record cloud credentials, tokens, source media, or raw metadata in test fixtures or audit logs.
- Each AS task has one focused verification and one dedicated commit.

---

### Task 1: AS-01 Unified archival record

**Files:** `archive-laravel/tests/Feature/RecordsApiTest.php`, `RecordAttachmentsApiTest.php`, `RecordSnapshotsApiTest.php`, `archive-next/app/archive/page.tsx`, `TASKS.md`, `ChangeLog.md`.

- [x] Run `node scripts/laravel-docker.mjs test tests/Feature/RecordsApiTest.php tests/Feature/RecordAttachmentsApiTest.php tests/Feature/RecordSnapshotsApiTest.php` (also covered by the final full Laravel suite: 150 tests / 509 assertions).
- [x] Verify records carry file, metadata, tags, classifications, approval/review state, and history without a second record store.
- [x] No acceptance field was absent; ledger evidence was updated after focused verification.
- [x] Commit `docs(tasks): close AS-01 unified archival records`.

### Task 2: AS-02 Hierarchy and custom fields

**Files:** `TagNodesApiTest.php`, `TypesControllerTest.php`, `MetadataTemplatesApiTest.php`, `DepartmentMetadataTemplatesApiTest.php`, `archive-next/app/tags/page.tsx`, `archive-next/app/metadata-templates/page.tsx`.

- [x] Run the four focused Laravel test files above (also covered by the final full Laravel suite: 150 tests / 509 assertions).
- [x] Verify nested tag hierarchy, ordered/required custom fields, and department template visibility are persisted and rendered.
- [x] No acceptance gap remained after the focused suites; AS-02 closed only after green verification.
- [x] Commit `docs(tasks): close AS-02 hierarchy and custom fields`.

### Task 3: AS-03 Approved terminology

**Files:** `VocabularyApiTest.php`, `VocabularyCanonicalApiTest.php`, `VocabularyRelinkApiTest.php`, `archive-next/app/vocabulary/page.tsx`.

- [x] Run the three vocabulary Laravel suites and `pnpm --filter @archive/next test -- lib/archive-api.test.ts`.
- [x] Verify canonical terms, aliases, taxonomy linkage, and department ordering preserve the shared dictionary.
- [x] Match the source configuration behavior: protected core categories plus per-user configurable categories with key, label, definition, icon, and order; validate them during manual entry and import.
- [x] Commit `feat(vocabulary): complete AS-03 approved terminology`.

### Task 4: AS-04 Permissions and audit

**Files:** `RoleMatrixApiTest.php`, `AuditLogTest.php`, `AuditChainIntegrityTest.php`, `SecuritySettingsApiTest.php`, `archive-next/components/RoleGate.tsx`.

- [x] Run the four Laravel test files.
- [x] Verify role enforcement, secure sessions, sensitive-field enforcement, and immutable/reviewable audit entries.
- [x] Confirm the audit chain detects both tampered and deleted rows.
- [x] Commit `docs(tasks): close AS-04 permissions and audit`.

### Task 5: AS-05 Record lifecycle

**Files:** `TrashApiTest.php`, `RecordHistoryApiTest.php`, `RecordSnapshotsApiTest.php`, `RecordFreezeApiTest.php`, `archive-next/app/trash/page.tsx`, `archive-next/app/favorites/page.tsx`.

- [x] Run the four Laravel lifecycle suites plus `FavoritesApiTest`.
- [x] Verify manual intake, reviewed history, recoverable deletion, snapshots, freezes, and favorites remain distinct states.
- [x] Replace device-local favorites with account-scoped server favorites and prove they are not exposed between users.
- [x] Commit `feat(records): complete AS-05 record lifecycle`.

### Task 6: AS-06 Media upload and import

**Files:** `ChunkedUploadTest.php`, `UploadsApiTest.php`, `ImportPreviewApiTest.php`, `RecordTranscriptApiTest.php`, `archive-next/app/uploads/UploadForm.tsx`.

- [x] Run the four Laravel import/upload suites plus `RecordSrtImportApiTest`.
- [x] Verify chunked large uploads, import preview, SRT/WebVTT transcript linkage, and reviewed cloud ingest configuration.
- [x] Add a Unicode-safe subtitle editor: edit, copy, download, save-to-record, and persist the presentation style without silently changing source media.
- [x] Commit `feat(import): complete AS-06 media upload and import`.

### Task 7: AS-07 Advanced search and filters

**Files:** `SearchApiTest.php`, `SemanticSearchTest.php`, `SavedSearchesApiTest.php`, `archive-next/app/search/page.tsx`.

- [x] Run the three Laravel search suites.
- [x] Verify text search plus type, taxonomy, tag, date, and descriptor-completion filtering, including saved searches.
- [x] Add date-range and completeness filters to the canonical API and search UI, with a focused failing test first.
- [x] Commit `feat(search): complete AS-07 advanced search`.

### Task 8: AS-08 Record detail and collaboration

**Files:** `RecordCommentsApiTest.php`, `RecordNotesApiTest.php`, `RecordFieldRequestApiTest.php`, `RecordEditClaimApiTest.php`, `archive-next/app/archive/[id]/page.tsx`.

- [x] Run the four Laravel collaboration suites (also covered by the final full Laravel suite: 150 tests / 509 assertions).
- [x] Verify preview/detail, safe description editing, comments, and linked follow-up assignment/claims.
- [x] Added coverage for the field-completion assignment panel and connected
  it to the existing authenticated Laravel API; verified note/comment/claim
  suites (23 tests/181 assertions), the UI test, and typecheck.
- [x] Commit `feat(records): complete AS-08 record collaboration`.

### Task 9: AS-09 Assisted AI services

**Files:** `RecordTranscriptApiTest.php`, `MediaJobsApiTest.php`, `MediaJobsReliabilityTest.php`, `archive-next/app/transcriber/page.tsx`, `archive-next/app/copilot/page.tsx`.

- [x] Ran the focused Laravel media/reliability/suggestions suites plus the new
  `RecordAiAssistApiTest` (37 tests/182 assertions) and the suggestions UI test.
- [x] Added a non-mutating assistance draft for summary, tags, controlled
  vocabulary entities, and proofreading; it always returns reviewRequired and
  no applied changes, and the record page makes that human-review boundary clear.
- [x] Contract generation, API contract verification, and Next typecheck pass.
- [x] Commit `feat(ai): complete AS-09 assisted services`.

### Task 10: AS-10 Collections and projects

**Files:** `CollectionsApiTest.php`, `CollectionEditApiTest.php`, `ProjectsApiTest.php`, `archive-next/app/collections/page.tsx`, `archive-next/app/projects/page.tsx`.

- [x] Ran the collection/project suites (15 tests/107 assertions).
- [x] Added persisted project notes and strict explicit record order, plus the
  `/project-groups` operational UI; collection membership remains scoped.
- [x] Contract generation/verification and Next typecheck pass.
- [x] Commit `feat(projects): complete AS-10 collections and projects`.

### Task 11: AS-11 Project tasks and Kanban

**Files:** `ProjectsApiTest.php`, `archive-next/app/kanban/page.tsx`, `archive-next/lib/organization-quality-workspace.test.ts`.

- [x] Added a RED then GREEN persistence test for project-task status, assignee,
  date, and optional record link; projects/workspace checks pass.
- [x] Added API-contract-backed `/project-tasks` Kanban UI with accessible
  select controls as the non-drag alternative for status changes.
- [x] Contract generation/verification and Next typecheck pass.
- [x] Commit `feat(projects): complete AS-11 project kanban`.

### Task 12: AS-12 Segments and NLE maps

**Files:** `RecordSegmentsApiTest.php`, `MontageProjectsApiTest.php`, `archive-next/lib/montage-nle-export.test.ts`, `archive-next/app/projects/page.tsx`.

- [x] Verified segments, montage projects, and the NLE export suite: 17 Laravel
  tests/97 assertions and 13 Next.js export tests pass.
- [x] In/out points, ordered clips/Rough Cut, source references, and JSON/EDL/FCPXML exports are covered; no gap required a fix.
- [x] Commit `docs(tasks): close AS-12 segments and NLE maps`.

### Task 13: AS-13 Project sharing

**Files:** `ShareApiTest.php`, `ReviewLinksApiTest.php`, `archive-next/app/shares/page.tsx`, `archive-next/app/review/[token]/ReviewLinkViewer.tsx`.

- [x] Sharing/review suites pass (12 tests/100 assertions), including expiry,
  scoped permission, password handling, rate limiting, and review links.
- [x] Added and tested immediate editor revocation; the revoked token is hidden.
- [x] Contract generation/verification and Next typecheck pass.
- [x] Commit `feat(share): complete AS-13 project sharing`.

### Task 14: AS-14 Relationship graph

**Files:** `RelationsGraphApiTest.php`, `archive-next/app/graph/page.tsx`, `archive-next/app/graph/graph.css`.

- [x] Graph suite passed (6 tests); controlled manual/inferred edges and authentication are covered. No gap required a fix.

### Task 15: AS-15 Map and timeline

**Files:** `DiscoverApiTest.php`, `RecordsApiTest.php`, `archive-next/app/map/page.tsx`, `archive-next/app/timeline/page.tsx`.

- [x] Discover/records coverage confirms canonical location and temporal facets; no gap required a fix.

### Task 16: AS-16 Reports and export

**Files:** `ComplianceReportApiTest.php`, `AccountExportApiTest.php`, `archive-next/app/reports/page.tsx`, `archive-next/app/data-center/page.tsx`.

- [x] Reporting/export suites passed (6 tests); authorization and account isolation are covered.

### Task 17: AS-17 Backup and restore

**Files:** `BackupsApiTest.php`, `BackupCommandsTest.php`, `BackupManifestTest.php`, `archive-next/app/backup/page.tsx`.

- [x] Backup API/command/manifest suites passed (26 tests); checksum, manifest, safe restore and rollback are covered.

### Task 18: AS-18 Cloud integration security

**Files:** `CloudStorageConfigTest.php`, `ProductionHardeningTest.php`, `SystemConnectionTestTest.php`, `archive-next/app/data-center/page.tsx`.

- [x] Cloud configuration/hardening/connection suites passed (36 tests, two unavailable external DB checks skipped); protected endpoints and production safeguards are covered.
