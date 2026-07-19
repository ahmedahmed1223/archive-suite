# V1-712 Durable Scheduled Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** تنفيذ رفع مجدول دائم وعالي التحمل يرفع الملف الآن، يعالجه لاحقًا عبر dispatcher وطابور مخصص، ويقدم تجربة عربية واضحة للإدارة والإلغاء وإعادة الجدولة.

**Architecture:** جدول `scheduled_uploads` هو مصدر الحقيقة، ويحوّل upload session مكتملة الأجزاء إلى artifact آمن بحالة staged. أمر dispatcher يطالب بدفعات مستحقة بعقد lease ذري ثم يرسل jobs idempotent إلى `scheduled-uploads`؛ watchdog وcleanup يعالجان الانقطاع والاحتفاظ، بينما تستهلك واجهة Next عقد OpenAPI نفسه.

**Tech Stack:** Node.js 26.5.0، pnpm 11.9.0، Next.js 16/React 19، Laravel 13، PostgreSQL/SQLite، Redis أو database queue، Vitest، PHPUnit، Playwright، Docker Compose.

## Global Constraints

- اقرأ `AGENTS.md` و`archive-laravel/AGENTS.md` و`archive-next/AGENTS.md` و`scripts/AGENTS.md` قبل التنفيذ.
- المواصفة الحاكمة: `docs/superpowers/specs/2026-07-19-scheduled-upload-design.md`.
- OpenAPI في `docs/api/archive-contract.openapi.json` هو المصدر العام للحقيقة؛ حدّث Laravel وعميل Next والتوليد في التغيير نفسه.
- ابدأ كل سلوك باختبار RED، شاهد سبب الفشل، نفّذ أقل GREEN، ثم refactor محدود وcommit مستقل.
- لا تعرض filesystem path أو metadata أو token في API أو logs أو metrics.
- خزّن الوقت UTC واحتفظ بمعرف IANA time zone؛ لا تعتمد offset رقميًا وحده.
- المعالجة الفورية الحالية تبقى متوافقة دون تغيير، وكل scheduled file يستخدم upload sessions حتى لو كان أصغر من 100MB.
- queue القانونية `scheduled-uploads`، dispatcher batch الافتراضي 100، والمحاولات الافتراضية 5.
- لا تغلق V1-712 قبل بوابات Laravel/OpenAPI/Next/build/live Docker والضغط المحددة في Task 9.

---

## File Map

- `archive-laravel/database/migrations/2026_07_19_000002_create_scheduled_uploads_table.php`: الجدول والفهارس وحالة staged في upload sessions.
- `archive-laravel/app/Models/ScheduledUpload.php`: casts، الحالات، والملكية.
- `archive-laravel/database/factories/ScheduledUploadFactory.php`: fixtures آمنة لاختبارات الحالة والضغط.
- `archive-laravel/app/Exceptions/ScheduledUploadConflict.php`: تعارض الحالة/version المترجم إلى HTTP 409.
- `archive-laravel/config/scheduled-uploads.php`: queue/batch/lease/retry/retention/capacity.
- `archive-laravel/app/Services/Uploads/UploadStager.php`: تجميع وفحص session دون نشر سجل.
- `archive-laravel/app/Data/StagedUpload.php`: DTO داخلي immutable للـartifact الموثق.
- `archive-laravel/app/Services/Uploads/ScheduledUploadState.php`: انتقالات optimistic/atomic القانونية.
- `archive-laravel/app/Http/Requests/CreateScheduledUploadRequest.php`: تحقق create/time zone/metadata.
- `archive-laravel/app/Http/Controllers/Api/V1/ScheduledUploadsController.php`: create/list/show/reschedule/cancel/retry.
- `archive-laravel/app/Jobs/FinalizeScheduledUpload.php`: finalization idempotent والتصنيف الآمن للفشل.
- `archive-laravel/app/Console/Commands/DispatchScheduledUploads.php`: claim bounded للمهام المستحقة.
- `archive-laravel/app/Console/Commands/RecoverScheduledUploads.php`: leases المنتهية.
- `archive-laravel/app/Console/Commands/CleanupScheduledUploads.php`: retention للـartifacts الطرفية.
- `archive-laravel/routes/api.php`, `archive-laravel/routes/console.php`: API وجدولة الأوامر.
- `archive-laravel/tests/Feature/ScheduledUploadApiTest.php`: API/ownership/conflicts/staging.
- `archive-laravel/tests/Feature/ScheduledUploadDispatchTest.php`: claims/backpressure/recovery.
- `archive-laravel/tests/Feature/ScheduledUploadJobTest.php`: idempotency/retries/failures.
- `docs/api/archive-contract.openapi.json`: المسارات والschemas العامة.
- `archive-next/lib/archive-api.ts`, `archive-next/lib/generated/archive-api.ts`: bindings.
- `archive-next/lib/scheduled-upload.ts`, `archive-next/lib/scheduled-upload.test.ts`: time/UI state helpers.
- `archive-next/app/uploads/UploadForm.tsx`: اختيار الآن/الجدولة ومرحلة staging.
- `archive-next/app/uploads/scheduled/page.tsx`, `ScheduledUploadsClient.tsx`, `ScheduledUploadsClient.test.tsx`: صفحة الإدارة.
- `archive-next/app/styles/06-widgets.css`, `archive-next/lib/navigation.ts`: العرض والتنقل.
- `infra/docker-compose.laravel-next.yml`, `infra/.env.example`: scheduler/queue config.
- `archive-laravel/tests/Feature/ScheduledUploadLoadTest.php`, `archive-next/e2e/scheduled-uploads.authed.spec.ts`: ضغط وقبول حي.

---

### Task 1: Persistent schedule and legal state contract

**Files:**
- Create: `archive-laravel/database/migrations/2026_07_19_000002_create_scheduled_uploads_table.php`
- Create: `archive-laravel/app/Models/ScheduledUpload.php`
- Create: `archive-laravel/database/factories/ScheduledUploadFactory.php`
- Create: `archive-laravel/app/Exceptions/ScheduledUploadConflict.php`
- Create: `archive-laravel/config/scheduled-uploads.php`
- Create: `archive-laravel/app/Services/Uploads/ScheduledUploadState.php`
- Test: `archive-laravel/tests/Unit/ScheduledUploadStateTest.php`

**Interfaces:**
- Produces: `ScheduledUpload::STATUSES`; `ScheduledUploadState::transition(string $id, string $from, string $to, int $version, array $changes = []): ScheduledUpload`.
- Consumes: existing `upload_sessions` table and `User` model.

- [ ] **Step 1: Write failing state tests**

```php
public function test_only_legal_transitions_increment_version(): void
{
    $schedule = ScheduledUpload::factory()->create(['status' => 'scheduled', 'version' => 1]);
    $updated = app(ScheduledUploadState::class)->transition($schedule->id, 'scheduled', 'claimed', 1);
    $this->assertSame('claimed', $updated->status);
    $this->assertSame(2, $updated->version);
}

public function test_stale_or_illegal_transition_conflicts(): void
{
    $schedule = ScheduledUpload::factory()->create(['status' => 'processing', 'version' => 3]);
    $this->expectException(ScheduledUploadConflict::class);
    app(ScheduledUploadState::class)->transition($schedule->id, 'scheduled', 'cancelled', 2);
}
```

- [ ] **Step 2: Verify RED**

Run: `node scripts/laravel-docker.mjs test tests/Unit/ScheduledUploadStateTest.php`
Expected: FAIL because model/service/migration do not exist.

- [ ] **Step 3: Add schema, model, config, and atomic transition**

Use a UUID primary key; unique `idempotency_key`; nullable unique `record_id`; JSON `record_payload`; indexed `(status, scheduled_at)`, `(status, lease_expires_at)`, `(created_by, created_at)`; all timestamps from the spec. Add `staged_path`, `disk`, `file_name`, `total_size`, `checksum_sha256`, `time_zone`, `attempts`, `failure_code`, `failure_message`, and `version`.

```php
public function transition(string $id, string $from, string $to, int $version, array $changes = []): ScheduledUpload
{
    if (! in_array($to, self::LEGAL[$from] ?? [], true)) {
        throw new ScheduledUploadConflict('Illegal scheduled upload transition.');
    }
    $changed = ScheduledUpload::query()->whereKey($id)->where('status', $from)->where('version', $version)
        ->update([...$changes, 'status' => $to, 'version' => $version + 1, 'updated_at' => now()]);
    if ($changed !== 1) throw new ScheduledUploadConflict('Scheduled upload changed concurrently.');
    return ScheduledUpload::query()->findOrFail($id);
}
```

Config defaults: queue `scheduled-uploads`, batch 100, lease 1800 seconds, tries 5, cancelled retention 24 hours, failed retention 168 hours, dispatch queue-depth ceiling 5000.

- [ ] **Step 4: Verify GREEN and rollback**

Run: `node scripts/laravel-docker.mjs test tests/Unit/ScheduledUploadStateTest.php`
Expected: PASS.

Run: `node scripts/laravel-docker.mjs artisan migrate:fresh --force`
Expected: migrations complete with no duplicate/index error.

- [ ] **Step 5: Commit**

```bash
git add archive-laravel/database/migrations/2026_07_19_000002_create_scheduled_uploads_table.php archive-laravel/app/Models/ScheduledUpload.php archive-laravel/database/factories/ScheduledUploadFactory.php archive-laravel/app/Exceptions/ScheduledUploadConflict.php archive-laravel/config/scheduled-uploads.php archive-laravel/app/Services/Uploads/ScheduledUploadState.php archive-laravel/tests/Unit/ScheduledUploadStateTest.php
git commit -m "feat(uploads): define durable schedule state"
```

### Task 2: Safe staging and schedule creation API

**Files:**
- Create: `archive-laravel/app/Services/Uploads/UploadStager.php`
- Create: `archive-laravel/app/Data/StagedUpload.php`
- Create: `archive-laravel/app/Http/Requests/CreateScheduledUploadRequest.php`
- Create: `archive-laravel/app/Http/Controllers/Api/V1/ScheduledUploadsController.php`
- Modify: `archive-laravel/app/Http/Controllers/Api/V1/UploadSessionsController.php`
- Modify: `archive-laravel/routes/api.php`
- Test: `archive-laravel/tests/Feature/ScheduledUploadApiTest.php`

**Interfaces:**
- Produces: `UploadStager::stage(string $sessionId): StagedUpload`; `POST /api/v1/uploads/schedules`.
- Consumes: `UploadCapacityGuard`, content validation extracted in V1-711, `ScheduledUploadState`.

- [ ] **Step 1: Write failing creation tests**

Cover: authenticated editor success, viewer 403, past time 422, invalid IANA zone 422, incomplete session 409, duplicate idempotency key returns the existing 200 representation, staged session rejects later chunks/complete, and response contains no disk/path.

```php
$response = $this->postJson('/api/v1/uploads/schedules', [
    'uploadSessionId' => $session['id'],
    'scheduledAt' => now()->addHour()->toIso8601String(),
    'timeZone' => 'Europe/Istanbul',
    'idempotencyKey' => 'schedule-fixture-001',
    'record' => ['title' => 'مقابلة مجدولة', 'type' => 'video', 'tags' => ['مقابلة']],
], $this->editorHeaders())->assertCreated();
$response->assertJsonPath('schedule.status', 'scheduled')->assertJsonMissingPath('schedule.stagedPath');
```

- [ ] **Step 2: Verify RED**

Run: `node scripts/laravel-docker.mjs test tests/Feature/ScheduledUploadApiTest.php`
Expected: route returns 404.

- [ ] **Step 3: Implement staging transaction and request validation**

`UploadStager` reuses chunk assembly/checksum/content sniffing, writes a verified quarantine artifact, and returns an immutable DTO with disk/path/name/size/checksum. Controller begins a DB transaction, locks the session, requires `pending` plus every chunk, stages it, inserts schedule, and changes session to `staged`. On DB failure it deletes only the new staged artifact. Validate `scheduledAt >= now()->subSeconds(30)`, IANA zone via `DateTimeZone::listIdentifiers()`, idempotency length 16–128, and whitelist record fields `title/type/subtype/tags/metadata`.

```php
$schedule = DB::transaction(function () use ($request, $stager): ScheduledUpload {
    $session = DB::table('upload_sessions')->where('id', $request->validated('uploadSessionId'))->lockForUpdate()->firstOrFail();
    $staged = $stager->stage($session);
    $schedule = ScheduledUpload::query()->create([
        'id' => (string) Str::uuid(), 'idempotency_key' => $request->validated('idempotencyKey'),
        'created_by' => $request->attributes->get('archive_user')->id, 'upload_session_id' => $session->id,
        'disk' => $staged->disk, 'staged_path' => $staged->path, 'file_name' => $staged->fileName,
        'total_size' => $staged->size, 'checksum_sha256' => $staged->checksum,
        'record_payload' => $request->validated('record'), 'scheduled_at' => $request->date('scheduledAt')->utc(),
        'time_zone' => $request->validated('timeZone'), 'status' => 'scheduled', 'attempts' => 0, 'version' => 1,
    ]);
    DB::table('upload_sessions')->where('id', $session->id)->update(['status' => 'staged']);
    return $schedule;
});
```

- [ ] **Step 4: Verify GREEN and V1-711 compatibility**

Run: `node scripts/laravel-docker.mjs test tests/Feature/ScheduledUploadApiTest.php tests/Feature/ChunkedUploadTest.php`
Expected: both suites pass; immediate completion still returns 201 record.

- [ ] **Step 5: Commit**

```bash
git add archive-laravel/app/Data/StagedUpload.php archive-laravel/app/Services/Uploads/UploadStager.php archive-laravel/app/Http/Requests/CreateScheduledUploadRequest.php archive-laravel/app/Http/Controllers/Api/V1/ScheduledUploadsController.php archive-laravel/app/Http/Controllers/Api/V1/UploadSessionsController.php archive-laravel/routes/api.php archive-laravel/tests/Feature/ScheduledUploadApiTest.php
git commit -m "feat(uploads): stage scheduled files safely"
```

### Task 3: List, reschedule, cancel, and retry API

**Files:**
- Modify: `archive-laravel/app/Http/Controllers/Api/V1/ScheduledUploadsController.php`
- Create: `archive-laravel/app/Http/Resources/ScheduledUploadResource.php`
- Create: `archive-laravel/app/Http/Requests/RescheduleUploadRequest.php`
- Modify: `archive-laravel/routes/api.php`
- Test: `archive-laravel/tests/Feature/ScheduledUploadApiTest.php`

**Interfaces:**
- Produces: list/show/PATCH/DELETE/retry endpoints from the spec; cursor envelope `{schedules,nextCursor}`.
- Consumes: `ScheduledUploadState::transition` and owner/admin authorization.

- [ ] **Step 1: Add failing role, cursor, conflict, cancel, and retry tests**

Assert editor sees only owned rows, admin sees all, viewer is forbidden, version mismatch is 409 with `current`, cancelling claimed is 409, cancel is idempotent for already-cancelled row, retry accepts only infrastructure failure codes with an existing staged artifact.

- [ ] **Step 2: Verify RED**

Run: `node scripts/laravel-docker.mjs test tests/Feature/ScheduledUploadApiTest.php`
Expected: FAIL on missing methods/routes.

- [ ] **Step 3: Implement API with safe resource projection**

Resource fields are exactly: `id,fileName,title,status,scheduledAt,timeZone,attempts,failureCode,failureMessage,recordId,version,createdAt,updatedAt,canReschedule,canCancel,canRetry`. Never serialize disk or staged path. Cancellation changes state first and leaves physical deletion to cleanup; reschedule changes `scheduled_at/time_zone`; retry clears safe failure fields and returns to scheduled with incremented version.

```php
public function toArray(Request $request): array
{
    return [
        'id' => $this->id, 'fileName' => $this->file_name, 'title' => data_get($this->record_payload, 'title'),
        'status' => $this->status, 'scheduledAt' => $this->scheduled_at?->toIso8601String(), 'timeZone' => $this->time_zone,
        'attempts' => $this->attempts, 'failureCode' => $this->failure_code, 'failureMessage' => $this->failure_message,
        'recordId' => $this->record_id, 'version' => $this->version,
        'createdAt' => $this->created_at?->toIso8601String(), 'updatedAt' => $this->updated_at?->toIso8601String(),
        'canReschedule' => $this->status === 'scheduled', 'canCancel' => $this->status === 'scheduled',
        'canRetry' => $this->status === 'failed' && str_starts_with((string) $this->failure_code, 'infrastructure_'),
    ];
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node scripts/laravel-docker.mjs test tests/Feature/ScheduledUploadApiTest.php`
Expected: all API tests pass.

- [ ] **Step 5: Commit**

```bash
git add archive-laravel/app/Http/Controllers/Api/V1/ScheduledUploadsController.php archive-laravel/app/Http/Resources/ScheduledUploadResource.php archive-laravel/app/Http/Requests/RescheduleUploadRequest.php archive-laravel/routes/api.php archive-laravel/tests/Feature/ScheduledUploadApiTest.php
git commit -m "feat(uploads): manage scheduled upload lifecycle"
```

### Task 4: Dispatcher, idempotent worker, watchdog, and retention

**Files:**
- Create: `archive-laravel/app/Jobs/FinalizeScheduledUpload.php`
- Create: `archive-laravel/app/Console/Commands/DispatchScheduledUploads.php`
- Create: `archive-laravel/app/Console/Commands/RecoverScheduledUploads.php`
- Create: `archive-laravel/app/Console/Commands/CleanupScheduledUploads.php`
- Modify: `archive-laravel/routes/console.php`
- Test: `archive-laravel/tests/Feature/ScheduledUploadDispatchTest.php`
- Test: `archive-laravel/tests/Feature/ScheduledUploadJobTest.php`

**Interfaces:**
- Produces commands `uploads:dispatch-scheduled`, `uploads:recover-scheduled`, `uploads:cleanup-scheduled`; job `FinalizeScheduledUpload(string $scheduleId)`.
- Consumes: `UploadFinalizer`, `ScheduledUploadState`, metrics persistence, `scheduled-uploads` queue.

- [ ] **Step 1: Write failing claim and job idempotency tests**

Assert two dispatcher invocations dispatch each due id once, future rows remain untouched, batch is 100, depth ceiling dispatches none, failed push releases claim, expired lease returns to scheduled, duplicate job after record association does not create a second `storage_rows` record, and terminal checksum/missing-artifact errors do not retry.

- [ ] **Step 2: Verify RED**

Run: `node scripts/laravel-docker.mjs test tests/Feature/ScheduledUploadDispatchTest.php tests/Feature/ScheduledUploadJobTest.php`
Expected: FAIL because commands/job are missing.

- [ ] **Step 3: Implement bounded claim and job**

Dispatcher selects `(status=scheduled, scheduled_at<=now)` ordered by time/id and claims via conditional updates. PostgreSQL/MySQL path uses `lockForUpdate()->skipLocked()` inside a short transaction; SQLite loops candidates through `WHERE status/version`. After commit, dispatch each job with `->onQueue(config('scheduled-uploads.queue'))`; on push failure transition claimed back to scheduled.

Job implements `ShouldQueue, ShouldBeUnique`, uses `WithoutOverlapping($scheduleId)`, sets `tries=5`, derives jittered backoff from schedule id, rechecks user role and checksum, then calls finalizer. Transactionally associate `record_id` before marking completed. `failed()` stores a redacted 500-character message and safe code only.

```php
final class FinalizeScheduledUpload implements ShouldQueue, ShouldBeUnique
{
    use Queueable;
    public int $tries = 5;
    public function __construct(public readonly string $scheduleId) { $this->onQueue('scheduled-uploads'); }
    public function uniqueId(): string { return $this->scheduleId; }
    public function middleware(): array { return [(new WithoutOverlapping($this->scheduleId))->releaseAfter(30)]; }
    public function backoff(): array { return [30, 120, 300, 600]; }
}
```

- [ ] **Step 4: Schedule operations**

In `routes/console.php`:

```php
Schedule::command('uploads:dispatch-scheduled')->everyMinute()->withoutOverlapping();
Schedule::command('uploads:recover-scheduled')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('uploads:cleanup-scheduled')->hourly()->withoutOverlapping();
```

- [ ] **Step 5: Verify GREEN**

Run: `node scripts/laravel-docker.mjs test tests/Feature/ScheduledUploadDispatchTest.php tests/Feature/ScheduledUploadJobTest.php`
Expected: all concurrency, idempotency, retry, recovery, and cleanup tests pass.

- [ ] **Step 6: Commit**

```bash
git add archive-laravel/app/Jobs/FinalizeScheduledUpload.php archive-laravel/app/Console/Commands/DispatchScheduledUploads.php archive-laravel/app/Console/Commands/RecoverScheduledUploads.php archive-laravel/app/Console/Commands/CleanupScheduledUploads.php archive-laravel/routes/console.php archive-laravel/tests/Feature/ScheduledUploadDispatchTest.php archive-laravel/tests/Feature/ScheduledUploadJobTest.php
git commit -m "feat(uploads): dispatch scheduled work reliably"
```

### Task 5: OpenAPI and Next.js client contract

**Files:**
- Modify: `docs/api/archive-contract.openapi.json`
- Modify: `archive-next/lib/archive-api.ts`
- Regenerate: `archive-next/lib/generated/archive-api.ts`
- Test: `scripts/verify-api-contracts.mjs`

**Interfaces:**
- Produces: `ScheduledUpload`, `ScheduledUploadStatus`, `CreateScheduledUploadRequest`, `RescheduleUploadRequest`; client methods `scheduledUploads`, `scheduledUpload`, `createScheduledUpload`, `rescheduleScheduledUpload`, `cancelScheduledUpload`, `retryScheduledUpload`.
- Consumes: exact endpoints and resource fields from Tasks 2–3.

- [ ] **Step 1: Add OpenAPI paths/schemas and verify generated drift is RED**

Run: `pnpm verify:api-generated`
Expected: FAIL because generated bindings do not match the changed contract.

- [ ] **Step 2: Generate bindings and implement typed wrappers**

Run: `pnpm api:generate`
Expected: generated file changes.

Use cursor query construction and `post/patch/del/get` helpers already present. `createScheduledUpload` accepts no disk/path/system fields.

```ts
export interface CreateScheduledUploadPayload {
  uploadSessionId: string;
  scheduledAt: string;
  timeZone: string;
  idempotencyKey: string;
  record: Pick<ArchiveRecord, 'title' | 'type' | 'subtype' | 'tags' | 'metadata'>;
}
```

- [ ] **Step 3: Verify contract GREEN**

Run: `pnpm verify:api-contracts`
Expected: PASS.

Run: `pnpm verify:api-generated`
Expected: PASS.

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/api/archive-contract.openapi.json archive-next/lib/archive-api.ts archive-next/lib/generated/archive-api.ts
git commit -m "feat(api): contract scheduled upload lifecycle"
```

### Task 6: Scheduling helpers and upload-wizard UX

**Files:**
- Create: `archive-next/lib/scheduled-upload.ts`
- Test: `archive-next/lib/scheduled-upload.test.ts`
- Modify: `archive-next/app/uploads/UploadForm.tsx`
- Modify: `archive-next/lib/chunked-upload.ts`
- Modify: `archive-next/lib/chunked-upload.test.ts`

**Interfaces:**
- Produces: `validateScheduleTime(localValue, zone, now)`, `scheduleSummary(localValue, zone, locale)`, `scheduledUploadProgress(stage)`; wizard mode `now|scheduled`.
- Consumes: Task 5 client methods; upload sessions from V1-711.

- [ ] **Step 1: Write failing pure helper tests**

```ts
expect(validateScheduleTime('2026-07-21T09:30', 'Europe/Istanbul', fixedNow)).toEqual({ valid: true, utc: '2026-07-21T06:30:00.000Z' });
expect(validateScheduleTime('2026-07-19T08:00', 'Europe/Istanbul', fixedNow).code).toBe('past');
expect(validateScheduleTime('2026-03-29T02:30', 'Europe/Berlin', fixedNow).code).toBe('dst-gap');
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @archive/next exec vitest run lib/scheduled-upload.test.ts`
Expected: FAIL because helper is missing.

- [ ] **Step 3: Implement helpers and wizard behavior**

Add two accessible radio cards in review: `المعالجة الآن` default and `جدولة المعالجة`. Scheduled mode requires local datetime, displays detected IANA zone and Arabic summary, changes primary action to `رفع وجدولة`, routes every file through upload sessions, and calls create schedule instead of immediate complete/bulk record. Progress labels are `رفع الملف`, `التحقق والحفظ للموعد`, `تمت الجدولة`. Success links to `/uploads/scheduled` and never links a record before completion.

```tsx
<fieldset className="schedule-choice">
  <legend>وقت المعالجة</legend>
  {(['now', 'scheduled'] as const).map((value) => (
    <label key={value} className="schedule-choice-card">
      <input type="radio" name="processingMode" value={value} checked={processingMode === value} onChange={() => setProcessingMode(value)} />
      <strong>{value === 'now' ? 'المعالجة الآن' : 'جدولة المعالجة'}</strong>
    </label>
  ))}
</fieldset>
```

- [ ] **Step 4: Verify GREEN and immediate compatibility**

Run: `pnpm --filter @archive/next exec vitest run lib/scheduled-upload.test.ts lib/chunked-upload.test.ts`
Expected: PASS, including existing immediate upload tests.

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add archive-next/lib/scheduled-upload.ts archive-next/lib/scheduled-upload.test.ts archive-next/app/uploads/UploadForm.tsx archive-next/lib/chunked-upload.ts archive-next/lib/chunked-upload.test.ts
git commit -m "feat(uploads): schedule processing from the wizard"
```

### Task 7: Scheduled uploads management page

**Files:**
- Create: `archive-next/app/uploads/scheduled/page.tsx`
- Create: `archive-next/app/uploads/scheduled/ScheduledUploadsClient.tsx`
- Create: `archive-next/app/uploads/scheduled/ScheduledUploadsClient.test.tsx`
- Modify: `archive-next/app/styles/06-widgets.css`
- Modify: `archive-next/lib/navigation.ts`
- Modify: `archive-next/e2e/fixtures/route-inventory.ts`

**Interfaces:**
- Produces route `/uploads/scheduled`; filters/status tabs/search/cursor/actions.
- Consumes: Task 5 client and Task 6 date helpers.

- [ ] **Step 1: Write failing component tests**

Cover Arabic empty/loading/error/offline states, completed record link only, reschedule/cancel contextual actions, retry eligibility, version-conflict refresh, focus restoration, admin owner column, and live status announcement.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @archive/next exec vitest run app/uploads/scheduled/ScheduledUploadsClient.test.tsx`
Expected: FAIL because page/client do not exist.

- [ ] **Step 3: Build responsive Arabic management UI**

Use status tabs `الكل/مجدولة/قيد المعالجة/مكتملة/فشلت/ملغاة`, a debounced safe title/filename search, cursor pagination, time plus relative countdown, and badges. Poll every 10 seconds only while visible and exponentially back off to 60 seconds after errors. Reschedule dialog uses the current value/version and refreshes on 409; cancel dialog explains retention. At 375px render cards, at 768/1280 use the existing responsive table pattern; preserve reduced motion and 200% zoom.

```tsx
<main className="page-shell" dir="rtl">
  <header className="page-header"><h1>المهام المجدولة</h1></header>
  <ScheduledStatusTabs value={status} onChange={setStatus} />
  <ScheduledUploadList schedules={schedules} onReschedule={openReschedule} onCancel={openCancel} onRetry={retry} />
  <p className="sr-only" aria-live="polite">{announcement}</p>
</main>
```

- [ ] **Step 4: Verify GREEN, accessibility inventory, and typecheck**

Run: `pnpm --filter @archive/next exec vitest run app/uploads/scheduled/ScheduledUploadsClient.test.tsx e2e/fixtures/route-inventory.test.ts`
Expected: PASS.

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add archive-next/app/uploads/scheduled archive-next/app/styles/06-widgets.css archive-next/lib/navigation.ts archive-next/e2e/fixtures/route-inventory.ts
git commit -m "feat(uploads): manage scheduled work in arabic"
```

### Task 8: Docker operations, metrics, and pressure controls

**Files:**
- Modify: `infra/docker-compose.laravel-next.yml`
- Modify: `infra/.env.example`
- Modify: `archive-laravel/routes/api.php`
- Test: `archive-laravel/tests/Feature/ScheduledUploadDispatchTest.php`
- Test: `scripts/verify-infra-config.mjs`

**Interfaces:**
- Produces: scheduler container; worker consumes `scheduled-uploads,default`; existing public `/api/v1/health` adds fields `scheduledUploads.schedulerFresh`, `oldestDueSeconds`, `queueDepth` without exposing schedule content.
- Consumes: commands/metrics from Task 4.

- [ ] **Step 1: Write failing infra and health assertions**

Assert Compose contains a scheduler running `php artisan schedule:work`, worker queue order includes `scheduled-uploads`, all config values exist in `infra/.env.example`, and deep health becomes degraded when dispatcher freshness exceeds two minutes or oldest due age exceeds the configured threshold.

- [ ] **Step 2: Verify RED**

Run: `pnpm verify:infra`
Expected: FAIL on missing scheduler/queue configuration.

- [ ] **Step 3: Implement Compose and health behavior**

Add `laravel-scheduler` using the canonical Laravel image, shared storage volume, the same DB/Redis credentials, `restart: unless-stopped`, and health based on scheduler heartbeat. Change worker command to `--queue=scheduled-uploads,default`. Add explicit env defaults documented from Task 1; do not add secrets.

```yaml
laravel-scheduler:
  build:
    context: ../archive-laravel
    dockerfile: Dockerfile.worker
  command: ["php", "artisan", "schedule:work"]
  restart: unless-stopped
  volumes:
    - laravel_next_storage:/app/storage/app
  depends_on:
    laravel-fpm:
      condition: service_healthy
    redis:
      condition: service_healthy
```

- [ ] **Step 4: Verify GREEN**

Run: `pnpm docker:config:laravel-next`
Expected: valid Compose config.

Run: `pnpm verify:infra`
Expected: PASS.

Run: `node scripts/laravel-docker.mjs test tests/Feature/ScheduledUploadDispatchTest.php`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add infra/docker-compose.laravel-next.yml infra/.env.example archive-laravel/routes/api.php archive-laravel/app/Http/Controllers/Api/V1 archive-laravel/tests/Feature/ScheduledUploadDispatchTest.php scripts/verify-infra-config.mjs
git commit -m "ops(uploads): run durable schedule workers"
```

### Task 9: Load, live acceptance, documentation, and task closure

**Files:**
- Create: `archive-laravel/tests/Feature/ScheduledUploadLoadTest.php`
- Create: `archive-next/e2e/scheduled-uploads.authed.spec.ts`
- Modify: `README.md`
- Modify: `TASKS.md`
- Modify: `ChangeLog.md`

**Interfaces:**
- Consumes all prior tasks.
- Produces V1-712 closure evidence.

- [ ] **Step 1: Add failing load and live scenarios**

Load test seeds 5,000 due schedules with fake storage, invokes ten concurrent claim batches, asserts no id claimed twice, batch never exceeds 100, and every completed row has a unique record id. Live spec covers schedule → list → reschedule → cancel and schedule due-now → worker → completed record, using fresh editor/admin sessions.

- [ ] **Step 2: Run focused suites**

Run: `node scripts/laravel-docker.mjs test tests/Feature/ScheduledUploadApiTest.php tests/Feature/ScheduledUploadDispatchTest.php tests/Feature/ScheduledUploadJobTest.php tests/Feature/ScheduledUploadLoadTest.php`
Expected: all pass with no duplicate claim/record.

Run: `pnpm test:next`
Expected: PASS.

- [ ] **Step 3: Run canonical contract/build/security gates**

Run each separately:

```bash
pnpm verify:api-contracts
pnpm verify:api-generated
pnpm typecheck
pnpm build:next
pnpm security:baseline
pnpm verify:repo-hygiene
```

Expected: every command exits 0.

- [ ] **Step 4: Run live Docker acceptance**

Run: `pnpm verify:laravel-next:live`
Expected: existing integration plus scheduled-upload Playwright scenario passes; scheduler and worker health are green; cleanup leaves no test schedule/artifact.

- [ ] **Step 5: Document and close**

Document operator configuration, queue scaling, failure codes, watchdog, retention, and metrics in `README.md` by linking the existing operational sections instead of replacing documentation. Change V1-712 to checked only after Step 4; record commit hashes, counts, load size, and exact gates in `ChangeLog.md`.

- [ ] **Step 6: Commit closure**

```bash
git add archive-laravel/tests/Feature/ScheduledUploadLoadTest.php archive-next/e2e/scheduled-uploads.authed.spec.ts README.md TASKS.md ChangeLog.md
git commit -m "test(uploads): close scheduled upload acceptance"
```

---

## Handoff Order

Execute Tasks 1–9 sequentially because each consumes the contracts produced before it. Do not parallelize Tasks 1–5 or edit OpenAPI from more than one worker. Task 7 may begin only after Task 5 is committed. Task 8 may be reviewed independently after Task 4 but must merge after the API health contract is stable. Preserve the unrelated untracked `scripts/acceptance/evidence.test.mjs` unless a separately approved V1-802 task claims it.
