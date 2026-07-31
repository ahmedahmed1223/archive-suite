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

- [ ] Run `node scripts/laravel-docker.mjs test tests/Feature/RecordsApiTest.php tests/Feature/RecordAttachmentsApiTest.php tests/Feature/RecordSnapshotsApiTest.php`.
- [ ] Verify records carry file, metadata, tags, classifications, approval/review state, and history without a second record store.
- [ ] If an acceptance field is absent, add its focused failing request/response test before production code; otherwise update AS-01 ledger evidence.
- [ ] Commit `docs(tasks): close AS-01 unified archival records`.

### Task 2: AS-02 Hierarchy and custom fields

**Files:** `TagNodesApiTest.php`, `TypesControllerTest.php`, `MetadataTemplatesApiTest.php`, `DepartmentMetadataTemplatesApiTest.php`, `archive-next/app/tags/page.tsx`, `archive-next/app/metadata-templates/page.tsx`.

- [ ] Run the four focused Laravel test files above.
- [ ] Verify nested tag hierarchy, ordered/required custom fields, and department template visibility are persisted and rendered.
- [ ] Add a failing test before any gap fix, then close AS-02 only after green results.
- [ ] Commit `docs(tasks): close AS-02 hierarchy and custom fields`.

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

- [ ] Run the four Laravel collaboration suites.
- [ ] Verify preview/detail, safe description editing, comments, and linked follow-up assignment/claims.
- [ ] Add a failing test before any collaboration gap fix, then close AS-08.
- [ ] Commit `docs(tasks): close AS-08 record collaboration`.

### Task 9: AS-09 Assisted AI services

**Files:** `RecordTranscriptApiTest.php`, `MediaJobsApiTest.php`, `MediaJobsReliabilityTest.php`, `archive-next/app/transcriber/page.tsx`, `archive-next/app/copilot/page.tsx`.

- [ ] Run the three Laravel AI/media suites.
- [ ] Verify transcription, summaries/tags/entity suggestions and language assistance remain reviewable suggestions, never automatic approval.
- [ ] Add a failing test before any human-review safeguard fix, then close AS-09.
- [ ] Commit `docs(tasks): close AS-09 assisted AI services`.

### Task 10: AS-10 Collections and projects

**Files:** `CollectionsApiTest.php`, `CollectionEditApiTest.php`, `ProjectsApiTest.php`, `archive-next/app/collections/page.tsx`, `archive-next/app/projects/page.tsx`.

- [ ] Run the three Laravel collection/project suites.
- [ ] Verify ordered collections/projects and associated notes/records are persisted and scoped.
- [ ] Add a failing test before any project grouping gap fix, then close AS-10.
- [ ] Commit `docs(tasks): close AS-10 collections and projects`.

### Task 11: AS-11 Project tasks and Kanban

**Files:** `ProjectsApiTest.php`, `archive-next/app/kanban/page.tsx`, `archive-next/lib/organization-quality-workspace.test.ts`.

- [ ] Run `node scripts/laravel-docker.mjs test tests/Feature/ProjectsApiTest.php` and `pnpm --filter @archive/next test -- lib/organization-quality-workspace.test.ts`.
- [ ] Verify status, assignee, updated time, and optional record linkage remain available in project/Kanban workflows.
- [ ] Add a failing test before any persistence or accessibility gap fix, then close AS-11.
- [ ] Commit `docs(tasks): close AS-11 project kanban`.

### Task 12: AS-12 Segments and NLE maps

**Files:** `RecordSegmentsApiTest.php`, `MontageProjectsApiTest.php`, `archive-next/lib/montage-nle-export.test.ts`, `archive-next/app/projects/page.tsx`.

- [ ] Run the two Laravel suites and `pnpm --filter @archive/next test -- lib/montage-nle-export.test.ts`.
- [ ] Verify in/out points, clips, rough-cut sequencing, and structured JSON/NLE exports are valid and preserve source references.
- [ ] Add a failing export test before any gap fix, then close AS-12.
- [ ] Commit `docs(tasks): close AS-12 segments and NLE maps`.

### Task 13: AS-13 Project sharing

**Files:** `ShareApiTest.php`, `ReviewLinksApiTest.php`, `archive-next/app/shares/page.tsx`, `archive-next/app/review/[token]/ReviewLinkViewer.tsx`.

- [ ] Run the two Laravel sharing suites.
- [ ] Verify expiry, permission scope, revocation, and token-safe review links.
- [ ] Add a failing test before any sharing safeguard fix, then close AS-13.
- [ ] Commit `docs(tasks): close AS-13 project sharing`.

### Task 14: AS-14 Relationship graph

**Files:** `RelationsGraphApiTest.php`, `archive-next/app/graph/page.tsx`, `archive-next/app/graph/graph.css`.

- [ ] Run `node scripts/laravel-docker.mjs test tests/Feature/RelationsGraphApiTest.php`.
- [ ] Verify records and controlled relation edges are returned in graph-safe form and rendered without exposing unavailable records.
- [ ] Add a failing graph isolation test before any fix, then close AS-14.
- [ ] Commit `docs(tasks): close AS-14 relationship graph`.

### Task 15: AS-15 Map and timeline

**Files:** `DiscoverApiTest.php`, `RecordsApiTest.php`, `archive-next/app/map/page.tsx`, `archive-next/app/timeline/page.tsx`.

- [ ] Run `node scripts/laravel-docker.mjs test tests/Feature/DiscoverApiTest.php tests/Feature/RecordsApiTest.php`.
- [ ] Verify location/event/date facets are available to map and timeline views without replacing the canonical record source.
- [ ] Add a failing facet test before any missing temporal/geographic filter fix, then close AS-15.
- [ ] Commit `docs(tasks): close AS-15 map and timeline`.

### Task 16: AS-16 Reports and export

**Files:** `ComplianceReportApiTest.php`, `AccountExportApiTest.php`, `archive-next/app/reports/page.tsx`, `archive-next/app/data-center/page.tsx`.

- [ ] Run the two Laravel reporting/export suites.
- [ ] Verify operational reports, metadata-quality indicators, and authorized CSV/Excel/PDF-style exports do not leak data.
- [ ] Add a failing export authorization test before any fix, then close AS-16.
- [ ] Commit `docs(tasks): close AS-16 reports and export`.

### Task 17: AS-17 Backup and restore

**Files:** `BackupsApiTest.php`, `BackupCommandsTest.php`, `BackupManifestTest.php`, `archive-next/app/backup/page.tsx`.

- [ ] Run the three Laravel backup suites.
- [ ] Verify database backup, import/restore plan, manifests, integrity checks, and rollback-safe behavior.
- [ ] Add a failing restore-integrity test before any fix, then close AS-17.
- [ ] Commit `docs(tasks): close AS-17 backup and restore`.

### Task 18: AS-18 Cloud integration security

**Files:** `CloudStorageConfigTest.php`, `ProductionHardeningTest.php`, `SystemConnectionTestTest.php`, `archive-next/app/data-center/page.tsx`.

- [ ] Run the three Laravel security/configuration suites.
- [ ] Verify protected secrets, authenticated endpoints, connection review, and absence of exposed diagnostics in production posture.
- [ ] Add a failing secret-exposure or authentication test before any fix, then close AS-18.
- [ ] Commit `docs(tasks): close AS-18 cloud integration security`.
