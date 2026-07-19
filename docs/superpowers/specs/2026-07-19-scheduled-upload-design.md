# V1-712 Scheduled Upload Design

**Status:** Approved design, pending implementation plan
**Date:** 2026-07-19
**Scope:** Canonical Laravel + Next.js path only

## Goal

Allow an authenticated archive operator to upload one or more files now, retain them safely in quarantine, and schedule archival finalization for a future time. The system must remain durable across Laravel, Redis, queue-worker, and host restarts; process large backlogs without duplicate records; and provide a clear Arabic-first scheduling experience inside the existing upload wizard.

## Chosen Architecture

Use a durable database schedule as the source of truth, a small dispatcher that claims due rows, and a dedicated Laravel queue for execution. Do not rely on delayed queue messages as the only schedule record: queue backends can be restarted, purged, or replaced, while the database row remains recoverable and auditable.

The flow is:

1. The browser uploads every scheduled file through the resumable upload-session path, including files below the normal 100MB chunking threshold.
2. For scheduled mode, `POST /uploads/schedules` atomically performs staging completion: it assembles the fully received session, verifies checksum and content safety, and leaves the verified artifact in a protected staged location rather than creating the final archive record. The existing `/uploads/sessions/{id}/complete` behavior remains the immediate-processing path.
3. In the same operation, Laravel writes one `scheduled_uploads` row per file, containing the intended execution time, staged artifact identity, sanitized record metadata, owner, state, retry counters, and idempotency key. If either staging or schedule persistence fails, no successful schedule response is returned and cleanup is deterministic.
4. A scheduler command runs once per minute and claims a bounded batch of due rows using an atomic state transition. PostgreSQL/MySQL use row locking with `SKIP LOCKED`; SQLite development and tests use an atomic conditional update with the same observable contract.
5. Claimed rows dispatch to a dedicated `scheduled-uploads` queue. Workers finalize the staged file, create or update exactly one archive record, and mark the schedule completed.
6. A watchdog recovers expired claims. Retention cleanup removes cancelled, terminally failed, or abandoned staged artifacts only after their configured retention window.

## Data Model

Create `scheduled_uploads` with:

- UUID `id` and unique `idempotency_key`;
- `created_by`, `upload_session_id`, disk, staged path, original filename, size, and SHA-256 checksum;
- sanitized `record_payload` JSON containing only user-editable archive metadata;
- UTC `scheduled_at`, optional `claimed_at`, `lease_expires_at`, `started_at`, `completed_at`, and `cancelled_at`;
- state: `scheduled`, `claimed`, `processing`, `completed`, `failed`, or `cancelled`;
- bounded `attempts`, safe `failure_code`, redacted `failure_message`, and optional resulting `record_id`;
- timestamps and optimistic `version` for rescheduling/cancellation conflicts.

Indexes:

- `(status, scheduled_at)` for dispatch;
- `(status, lease_expires_at)` for watchdog recovery;
- `(created_by, created_at)` for the user's list;
- unique `idempotency_key` and unique nullable `record_id`.

The upload session gains a `staged` terminal state and a staged-artifact reference. A staged session cannot receive more chunks or be completed twice.

## State and Concurrency Contract

Legal transitions are:

- `scheduled → claimed → processing → completed`;
- `scheduled → cancelled`;
- `scheduled → scheduled` for a version-checked time change;
- `claimed → scheduled` when a lease expires before processing starts;
- `processing → scheduled` for a retryable failure while attempts remain;
- `processing → failed` for a terminal failure or exhausted retry budget.

Cancellation and rescheduling are accepted only from `scheduled`. A conflict returns HTTP 409 with the current schedule representation. Worker execution uses both the schedule idempotency key and a database transaction around the final record association. If a worker repeats after creating the record, it observes the existing `record_id` and completes without creating another record.

The dispatcher claims at most the configured batch size and stops dispatching when queue depth or free-disk thresholds exceed their limits. It never holds a database transaction while pushing to the queue. A failed push releases the claim safely for a later dispatcher pass.

## Queue, Retry, and Pressure Behavior

- Dedicated queue: `scheduled-uploads`.
- Default dispatcher batch: 100 rows per minute, configurable.
- Worker timeout and lease exceed the maximum expected single finalization duration and are explicit configuration values.
- Retryable infrastructure errors use exponential backoff with jitter and a bounded default of five attempts.
- Validation, missing artifact, checksum mismatch, unsafe content, or revoked authorization are terminal failures.
- Queue depth, oldest due age, claim recovery count, attempts, finalization duration, completed rate, and terminal failures are emitted as system metrics without filenames, paths, tokens, or metadata content.
- The existing worker is the initial deployment target. The dedicated queue name and metrics allow independent workers and horizontal scaling later without changing the API.

## Authorization and Security

- Editor/admin roles may create schedules; users may list, reschedule, or cancel schedules they own, while admins may operate on all schedules.
- Authorization is checked at creation and again at execution. A disabled user or revoked permission fails safely before the final record is published.
- Server code derives disk, path, checksum, owner, and system metadata. The client cannot submit trusted storage paths or override the resulting record identity.
- Staged files remain under the existing quarantine root and go through the same size, capacity, checksum, extension, and content-sniffing controls as immediate uploads.
- API responses and logs never expose local filesystem paths. Failure messages use safe codes and redacted operator text.

## Public API

Update `docs/api/archive-contract.openapi.json` and generated bindings in the same change.

- `POST /api/v1/uploads/schedules` — create a schedule from a fully received upload session, with `scheduledAt`, `timeZone`, `record`, and `idempotencyKey`; returns 201.
- `GET /api/v1/uploads/schedules` — cursor-paginated list scoped to the current user unless admin; filters for state and time window.
- `GET /api/v1/uploads/schedules/{id}` — current state and safe progress/failure information.
- `PATCH /api/v1/uploads/schedules/{id}` — change `scheduledAt` using required `version`; returns 409 on state/version conflict.
- `DELETE /api/v1/uploads/schedules/{id}` — cancel a still-scheduled item and return the updated representation.
- `POST /api/v1/uploads/schedules/{id}/retry` — owner/admin retry of a failed infrastructure-classified schedule after verifying that its staged artifact still exists.

All timestamps are ISO 8601. The server stores UTC and echoes both UTC time and the validated IANA time-zone identifier used for display. Creation rejects a time earlier than the current server time plus a small clock-skew allowance.

## UI/UX

Extend the existing upload wizard instead of creating a separate scheduling form:

- In the review step, present two radio-card choices: **«المعالجة الآن»** and **«جدولة المعالجة»**. Immediate processing remains the default.
- Choosing scheduling reveals an accessible local date/time field, time-zone label, and concise summary such as **«سيُرفع الملف الآن وتبدأ معالجته الثلاثاء 21 يوليو، 09:30»**.
- Show a warning if the chosen time is in the past, too close to the current time, or affected by a daylight-saving transition. Send an IANA zone, never a numeric offset alone.
- The primary action changes to **«رفع وجدولة»**. Progress distinguishes **رفع الملف** from **التحقق والحفظ للموعد** so users do not mistake a completed transfer for completed archival.
- After success, show the schedule time, number of scheduled files, and a link to **«المهام المجدولة»**. Do not display a completed archive-record link before worker finalization.
- Add a `/uploads/scheduled` page with status tabs, search by safe filename/title, cursor pagination, next-run time, relative countdown, owner visibility for admins, and clear state badges.
- Row actions are contextual: reschedule/cancel only while scheduled, retry only for eligible failed items, and open record only after completion.
- Rescheduling uses a focused dialog with the current value and conflict recovery. Cancellation requires confirmation that the staged copy will be removed according to retention policy.
- Empty, loading, offline, stale, partial-error, and permission-denied states are explicit. Updates use polling with visibility-aware backoff initially; Reverb enhancement is optional and outside this task.
- Keyboard operation, focus restoration, Arabic RTL, live-region progress announcements, 375/768/1280 layouts, reduced motion, and 200% zoom are acceptance requirements.

## Failure and Recovery

- Redis/queue unavailable: schedules remain `scheduled`; dispatcher reports backlog and retries later.
- Worker crash before finalization: lease expires and watchdog returns the row to `scheduled`.
- Worker crash after record creation: idempotency and `record_id` reconciliation finish the existing schedule without duplication.
- Staged artifact missing or checksum changed: terminal `failed` with a safe failure code and operator guidance.
- Disk pressure: creation/dispatch pauses with HTTP 507 or a capacity-blocked metric; existing schedules remain durable.
- Database unavailable: API creation fails without claiming successful scheduling; workers retry according to queue policy.
- Cancellation cleanup failure: state remains cancelled, cleanup is retried separately, and the artifact is never processed.

## Testing and Acceptance

Laravel tests cover:

- creation, ownership, admin visibility, UTC/time-zone validation, and past-time rejection;
- atomic claims under concurrent dispatcher invocations;
- cancel/reschedule version conflicts and state restrictions;
- worker idempotency before and after final record creation;
- retry classification, backoff exhaustion, watchdog recovery, and cleanup retention;
- Redis/queue failure, missing artifact, checksum mismatch, revoked role, disk pressure, and safe error redaction;
- migration rollback and required indexes.

Next.js tests cover:

- immediate versus scheduled choice, validation, time-zone serialization, and DST warning;
- per-file transfer/staging progress, success summary, and no premature record link;
- list filters, contextual actions, conflict recovery, responsive RTL layout, keyboard access, and live announcements.

Contract checks cover every request, response, status, enum, pagination field, and generated binding. Live Playwright covers upload now → schedule → list → reschedule → cancel, plus upload → due dispatch → completed record. A focused load test seeds thousands of schedules, proves bounded claim batches and no duplicate record ids, and records queue-age and throughput metrics.

## Configuration and Operations

Add documented environment settings for queue name, batch size, lease duration, maximum attempts, retention periods, capacity thresholds, and watchdog cadence. Docker Compose runs the scheduler and a worker that consumes `scheduled-uploads`; health/readiness reports scheduler freshness and oldest due age. The feature must work with the default database queue and remain compatible with Redis queue deployments.

## Out of Scope

- Scheduling the browser-to-server transfer itself;
- recurring schedules;
- dependency graphs between scheduled uploads;
- Reverb push updates;
- a separately deployed scheduler service or new queue technology.

These can be added later without changing the durable schedule or API state model.
