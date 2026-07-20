# V1 Interactive Acceptance Smoke Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use superpowers:subagent-driven-development only when the user explicitly requests delegation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** بناء الشريحة الإلزامية V1-801..805 بحيث يشغّل أمر واحد خمسة سيناريوهات Docker smoke تفاعلية ويصدر نتيجة حاسمة وmanifest وأدلة آمنة خلال أقل من 15 دقيقة.

**Architecture:** منسق Node صغير يقرأ registry ثابتًا، يختار السيناريوهات حسب الوسم أو المعرّف، ويفوض دورة البيئة إلى Docker provider. السيناريوهات التفاعلية تُنفذ عبر Playwright بجلسات دخول حية مستقلة، بينما تحفظ طبقة evidence نتائج موحدة بعد تمريرها على sanitizer وفحص تسرب إلزامي. هذه الخطة تنفذ الشريحة الأولى فقط؛ V1-806..814 تحتاج خططًا مستقلة بعد نجاحها.

**Tech Stack:** Node.js 26.5.0، pnpm 11.9.0، Docker Compose، Next.js 16، Laravel، Playwright 1.61، واختبارات `node:test`.

## Global Constraints

- استخدم `pnpm` من جذر المستودع، والمسار القانوني هو `archive-next/` + `archive-laravel/`.
- لا تستخدم `archive-app/` أو `archive-server/` لتنفيذ ميزة جديدة.
- ابدأ كل مهمة باختبار فاشل، ثم أقل تنفيذ ناجح، ثم refactor محدود وcommit مستقل.
- لا تُعد استخدام refresh cookie محفوظ؛ كل Playwright context يسجل الدخول حيًا.
- احسب ميزانية login/refresh وارفض run قبل التنفيذ إذا تجاوز 30 login/دقيقة أو 120 refresh/دقيقة لكل IP.
- الأدلة خارج شجرة المصدر، وتفشل الجولة إذا كشف الفحص token أو password أو API key أو credential URL أو مسار مستخدم.
- Docker provider ينظف فقط الموارد التي أنشأها run، ويثبت cleanup في `finally`.
- حالات السيناريو القانونية: `passed`, `failed`, `blocked-capability`, `skipped`؛ ولا تتحول capability مفقودة إلى نجاح.
- معيار الدمج: `node scripts/acceptance.mjs run --tag smoke` ينتهي خلال أقل من 15 دقيقة على عقد موارد التطوير.

---

## File Map

- `scripts/acceptance/contracts.mjs`: تحقق أشكال scenario/result/manifest والحالات والوسوم.
- `scripts/acceptance/registry.mjs`: تعريف السيناريوهات الخمسة واحتياجات الجلسات والقدرات.
- `scripts/acceptance/evidence.mjs`: إنشاء مجلد run، التنقية، فحص التسرب، وكتابة JSON بصلاحيات آمنة.
- `scripts/acceptance/providers/docker.mjs`: دورة Docker المعزولة والمنافذ وcleanup.
- `scripts/acceptance/runner.mjs`: الاختيار والميزانية والتنفيذ وإعادة flake و`--last-failed`.
- `scripts/acceptance.mjs`: CLI وتحويل exit status مع إبقاء وحدات التنفيذ داخل `scripts/acceptance/`.
- `scripts/acceptance/*.test.mjs`: اختبارات Node لكل حدود المنسق.
- `archive-next/e2e/acceptance-smoke.spec.ts`: الرحلات التفاعلية الثلاث المرتبطة بالواجهة.
- `archive-next/e2e/fixtures/auth.ts`: إعادة استخدام `roleSession` الحالية دون تغيير عقدها إلا عند حاجة اختبارية مثبتة.
- `archive-next/playwright.config.ts`: توجيه artifacts وJSON reporter عند استدعاء بوابة القبول.
- `scripts/verify-next-laravel-live.mjs`: تمرير output directory وspecs للـrunner عند التشغيل المضمن.
- `package.json`: أوامر `acceptance:smoke` و`acceptance:test`.

---

### Task 1: Scenario contracts and versioned registry

**Files:**
- Create: `scripts/acceptance/contracts.mjs`
- Create: `scripts/acceptance/registry.mjs`
- Test: `scripts/acceptance/contracts.test.mjs`

**Interfaces:**
- Produces: `SCENARIO_STATUSES`, `SCENARIO_TAGS`, `validateScenario(input)`, `validateResult(input)`, `ACCEPTANCE_SCENARIOS`, `selectScenarios({ tag, ids })`.
- Consumes: no earlier task.

- [ ] **Step 1: Write the failing contract and registry tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { validateScenario, validateResult } from "./contracts.mjs";
import { ACCEPTANCE_SCENARIOS, selectScenarios } from "./registry.mjs";

test("registry exposes the five mandatory smoke scenarios", () => {
  assert.deepEqual(ACCEPTANCE_SCENARIOS.map(({ id }) => id), [
    "V1-IA-PLAT-001", "V1-IA-ARCH-001", "V1-IA-ADMIN-001",
    "V1-IA-ADMIN-002", "V1-IA-MULTI-001",
  ]);
  assert.ok(ACCEPTANCE_SCENARIOS.every((item) => validateScenario(item).id === item.id));
  assert.equal(selectScenarios({ tag: "smoke" }).length, 5);
});

test("contracts reject invented states and unknown tags", () => {
  assert.throws(() => validateResult({ scenarioId: "V1-IA-PLAT-001", status: "ok" }), /status/);
  assert.throws(() => validateScenario({ id: "V1-IA-X-1", title: "x", tags: ["fast"] }), /tag/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test scripts/acceptance/contracts.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `contracts.mjs`.

- [ ] **Step 3: Implement strict contracts and the five registry rows**

```js
export const SCENARIO_STATUSES = Object.freeze(["passed", "failed", "blocked-capability", "skipped"]);
export const SCENARIO_TAGS = Object.freeze(["smoke", "daily", "nightly", "rc", "ga", "external"]);

export function validateScenario(input) {
  if (!/^V1-IA-[A-Z]+-\d{3}$/.test(input?.id ?? "")) throw new Error("scenario id is invalid");
  if (!input.title?.trim()) throw new Error("scenario title is required");
  if (!Array.isArray(input.tags) || input.tags.some((tag) => !SCENARIO_TAGS.includes(tag))) throw new Error("scenario tag is invalid");
  if (!Array.isArray(input.capabilities)) throw new Error("scenario capabilities are required");
  if (!Number.isInteger(input.loginSessions) || input.loginSessions < 0) throw new Error("loginSessions is invalid");
  return Object.freeze({ ...input, tags: Object.freeze([...input.tags]), capabilities: Object.freeze([...input.capabilities]) });
}

export function validateResult(input) {
  if (!SCENARIO_STATUSES.includes(input?.status)) throw new Error("result status is invalid");
  if (!/^V1-IA-[A-Z]+-\d{3}$/.test(input?.scenarioId ?? "")) throw new Error("result scenarioId is invalid");
  return input;
}
```

In `registry.mjs`, define each row with `tags: ["smoke", "daily", "rc", "ga"]`, `capabilities: ["docker"]`, and login sessions `0, 1, 1, 1, 2` respectively. `selectScenarios` must reject unknown IDs instead of silently dropping them.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test scripts/acceptance/contracts.test.mjs`
Expected: 2 tests passed, 0 failed.

- [ ] **Step 5: Commit the contract slice**

```bash
git add scripts/acceptance/contracts.mjs scripts/acceptance/registry.mjs scripts/acceptance/contracts.test.mjs
git commit -m "feat(acceptance): define scenario registry contract"
```

### Task 2: Secure evidence store and leak gate

**Files:**
- Create: `scripts/acceptance/evidence.mjs`
- Test: `scripts/acceptance/evidence.test.mjs`
- Reuse: `scripts/observability.mjs`

**Interfaces:**
- Consumes: `validateResult` from Task 1; `sanitize`, `redactText`, `secureBundleFile` from `scripts/observability.mjs`.
- Produces: `createEvidenceStore({ root, runId, now, secure })` returning `{ directory, writeArtifact, finalize }`; `assertNoSensitiveEvidence(value)`.

- [ ] **Step 1: Write failing tests for sanitization, exclusive files, and leak failure**

```js
test("evidence is redacted and manifest is written outside the repository", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-acceptance-"));
  const store = createEvidenceStore({ root, runId: "run-001", now: new Date("2026-07-19T00:00:00Z"), secure: () => {} });
  store.writeArtifact("probe.json", { token: "secret-value", url: "postgres://u:p@db/archive" });
  const manifest = store.finalize({ status: "passed", results: [] });
  assert.equal(manifest.status, "passed");
  assert.doesNotMatch(readFileSync(join(root, "run-001", "probe.json"), "utf8"), /secret-value|u:p/);
});

test("leak scanner rejects a credential missed by sanitization", () => {
  assert.throws(() => assertNoSensitiveEvidence("Authorization: Bearer abc.def.ghi"), /sensitive evidence/i);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test scripts/acceptance/evidence.test.mjs`
Expected: FAIL because `evidence.mjs` does not exist.

- [ ] **Step 3: Implement the evidence store**

Use `writeFileSync(path, JSON.stringify(sanitize(value), null, 2), { encoding: "utf8", mode: 0o600, flag: "wx" })`. After serialization, call `assertNoSensitiveEvidence`; the scanner must reject bearer/basic credentials, credential URLs, secret assignments, and absolute Windows/POSIX user paths. `finalize` writes exactly one `manifest.json` containing `schemaVersion: 1`, `runId`, `generatedAt`, `status`, and validated results, then applies `secureBundleFile` to every file.

- [ ] **Step 4: Run evidence and existing sanitizer tests**

Run: `node --test scripts/acceptance/evidence.test.mjs scripts/observability.test.mjs scripts/game-day.test.mjs`
Expected: all tests pass and no artifact is created under the repository.

- [ ] **Step 5: Commit evidence handling**

```bash
git add scripts/acceptance/evidence.mjs scripts/acceptance/evidence.test.mjs
git commit -m "feat(acceptance): secure run evidence"
```

### Task 3: Isolated Docker provider

**Files:**
- Create: `scripts/acceptance/providers/docker.mjs`
- Test: `scripts/acceptance/providers/docker.test.mjs`
- Reuse: `infra/docker-compose.laravel-next.yml`, `scripts/game-day.mjs`

**Interfaces:**
- Produces: `createDockerProvider({ root, runId, run, getFreePort })` with async methods `prepare`, `install`, `start`, `exec`, `collect`, `reset`, `destroy` and property `capabilities`.
- Consumes: run ID and evidence callbacks from Tasks 1–2.

- [ ] **Step 1: Write a failing provider planning test**

```js
test("docker provider scopes every command and destroys only its project", async () => {
  const calls = [];
  const provider = createDockerProvider({ root: "D:/repo", runId: "run-001", run: async (cmd, args) => { calls.push([cmd, args]); return { status: 0, stdout: "", stderr: "" }; }, getFreePort: async () => 43123 });
  await provider.prepare();
  await provider.destroy();
  assert.ok(calls.every(([cmd]) => cmd === "docker"));
  assert.ok(calls.flatMap(([, args]) => args).includes("archive-acceptance-run-001"));
  assert.ok(calls.some(([, args]) => args.includes("down") && args.includes("--remove-orphans")));
});
```

- [ ] **Step 2: Run the provider test and verify RED**

Run: `node --test scripts/acceptance/providers/docker.test.mjs`
Expected: FAIL because provider module is missing.

- [ ] **Step 3: Implement the provider with exact ownership rules**

The project name must match `/^archive-acceptance-[a-z0-9-]+$/`. Every compose invocation uses `docker compose --project-name <name> --env-file infra/.env.example --file infra/docker-compose.laravel-next.yml`. `destroy` uses `down --volumes --remove-orphans`, then `docker ps --all --filter label=com.docker.compose.project=<name> --format {{.ID}}`; non-empty output makes cleanup fail. Do not enumerate or remove resources outside that label.

- [ ] **Step 4: Run provider and game-day isolation tests**

Run: `node --test scripts/acceptance/providers/docker.test.mjs scripts/game-day.test.mjs`
Expected: all tests pass.

- [ ] **Step 5: Commit the Docker provider**

```bash
git add scripts/acceptance/providers/docker.mjs scripts/acceptance/providers/docker.test.mjs
git commit -m "feat(acceptance): add isolated docker provider"
```

### Task 4: Runner, throttle budget, retries, and last-failed

**Files:**
- Create: `scripts/acceptance/runner.mjs`
- Create: `scripts/acceptance.mjs`
- Test: `scripts/acceptance/runner.test.mjs`

**Interfaces:**
- Consumes: registry, Docker provider, and evidence store.
- Produces: `calculateAuthBudget(scenarios)`, `runAcceptance({ tag, ids, lastFailed, keepEnvironment, provider, evidenceStore, executeScenario })`, CLI `run --tag <tag>`, `run --id <id>`, `run --last-failed`.

- [ ] **Step 1: Write failing budget and cleanup tests**

```js
test("runner rejects a login budget above the server contract before prepare", async () => {
  let prepared = false;
  await assert.rejects(() => runAcceptance({ scenarios: [{ id: "V1-IA-MULTI-001", loginSessions: 31, tags: ["smoke"], capabilities: ["docker"] }], provider: { prepare: async () => { prepared = true; } } }), /30 logins/);
  assert.equal(prepared, false);
});

test("runner destroys its environment after a product failure", async () => {
  let destroyed = false;
  const result = await runAcceptance({ scenarios: [scenario], provider: providerFake({ destroy: async () => { destroyed = true; } }), executeScenario: async () => ({ scenarioId: scenario.id, status: "failed", classification: "product", attempts: 1 }) });
  assert.equal(result.status, "failed");
  assert.equal(destroyed, true);
});
```

- [ ] **Step 2: Run runner tests and verify RED**

Run: `node --test scripts/acceptance/runner.test.mjs`
Expected: FAIL because runner module is missing.

- [ ] **Step 3: Implement orchestration and deterministic exit codes**

`calculateAuthBudget` sums `loginSessions` and assumes one refresh per session; reject over 30/120. Execute each selected scenario sequentially for the first slice. Retry once only when result classification is `flake`. Always call `provider.destroy()` in `finally` unless `keepEnvironment === true`; even then write `cleanup.keptForDiagnostics: true`. Exit `0` only when every selected scenario is `passed`; exit `1` for `failed`; exit `2` when all selected scenarios are `blocked-capability` or CLI input is invalid.

- [ ] **Step 4: Run all acceptance unit tests**

Run: `node --test scripts/acceptance/**/*.test.mjs scripts/acceptance/*.test.mjs`
Expected: all tests pass.

- [ ] **Step 5: Commit runner and CLI**

```bash
git add scripts/acceptance.mjs scripts/acceptance/runner.mjs scripts/acceptance/runner.test.mjs
git commit -m "feat(acceptance): orchestrate smoke runs"
```

### Task 5: Interactive smoke journeys with live role sessions

**Files:**
- Create: `archive-next/e2e/acceptance-smoke.spec.ts`
- Modify: `archive-next/playwright.config.ts`
- Modify: `scripts/verify-next-laravel-live.mjs`
- Test: `archive-next/e2e/acceptance-smoke.spec.ts`

**Interfaces:**
- Consumes: `test`, `expect`, `roleSession` and role data from `archive-next/e2e/fixtures/auth.ts`.
- Produces: Playwright annotations keyed by the five scenario IDs and JSON result file at `ARCHIVE_ACCEPTANCE_RESULT_PATH`.

- [ ] **Step 1: Add the three UI journeys and prove they fail before runner wiring**

```ts
test('V1-IA-ARCH-001 editor signs in, searches, and opens the owned record', async ({ roleSession }) => {
  const { page, data } = await roleSession('editor');
  await page.goto('/search');
  await page.getByRole('combobox', { name: 'اقتراحات البحث' }).fill(data.record.title);
  await page.getByRole('button', { name: 'بحث', exact: true }).click();
  await page.getByRole('link', { name: 'فتح التفاصيل' }).first().click();
  await expect(page.getByRole('heading', { name: data.record.title })).toBeVisible();
});

test('V1-IA-ADMIN-001 admin reads system health', async ({ roleSession }) => {
  const { page } = await roleSession('admin');
  await page.goto('/status');
  await expect(page.getByRole('heading', { name: /الحالة|صحة النظام/ })).toBeVisible();
  await expect(page.getByText(/سليم|يعمل|متصل/).first()).toBeVisible();
});

test('V1-IA-MULTI-001 editor and viewer keep isolated live sessions', async ({ roleSession }) => {
  const editor = await roleSession('editor');
  const viewer = await roleSession('viewer');
  await Promise.all([editor.page.goto('/archive'), viewer.page.goto('/archive')]);
  await expect(editor.page.getByText(editor.account.name).first()).toBeVisible();
  await expect(viewer.page.getByText(viewer.account.name).first()).toBeVisible();
});
```

- [ ] **Step 2: Run the live spec and verify the new runner path is RED**

Run (PowerShell):

```powershell
$env:ARCHIVE_E2E_SPECS='e2e/acceptance-smoke.spec.ts'
pnpm verify:laravel-next:live
Remove-Item Env:ARCHIVE_E2E_SPECS
```

Expected: the Playwright journeys may pass, but acceptance result ingestion is absent and the runner cannot mark their scenario IDs passed.

- [ ] **Step 3: Wire live verification output without reusing refresh state**

Modify `verify-next-laravel-live.mjs` to pass `PLAYWRIGHT_OUTPUT_DIR` from the acceptance evidence directory and `ARCHIVE_ACCEPTANCE_RESULT_PATH` to Playwright. In `playwright.config.ts`, set `outputDir` from `PLAYWRIGHT_OUTPUT_DIR` when present and append `['json', { outputFile: process.env.ARCHIVE_ACCEPTANCE_RESULT_PATH }]` to the reporters only when that variable is set. Preserve the current fresh-login-per-context implementation in `fixtures/auth.ts`. Count contexts from registry before launch; never solve 429 by increasing server limits.

- [ ] **Step 4: Run the focused live journeys**

Run (PowerShell):

```powershell
$env:ARCHIVE_E2E_SPECS='e2e/acceptance-smoke.spec.ts'
pnpm verify:laravel-next:live
Remove-Item Env:ARCHIVE_E2E_SPECS
```

Expected: 3 Playwright tests pass with independent editor/viewer/admin sessions and no 401/429 response.

- [ ] **Step 5: Commit interactive smoke journeys**

```bash
git add archive-next/e2e/acceptance-smoke.spec.ts archive-next/playwright.config.ts scripts/verify-next-laravel-live.mjs
git commit -m "test(acceptance): cover interactive smoke journeys"
```

### Task 6: Platform boot and backup/verify smoke executors

**Files:**
- Create: `scripts/acceptance/scenarios/platform-smoke.mjs`
- Create: `scripts/acceptance/scenarios/admin-backup-smoke.mjs`
- Test: `scripts/acceptance/scenarios/smoke.test.mjs`

**Interfaces:**
- Consumes: Docker provider `exec` and `collect`.
- Produces: `runPlatformBoot(context)` for `V1-IA-PLAT-001`; `runAdminBackup(context)` for `V1-IA-ADMIN-002`.

- [ ] **Step 1: Write failing executor tests with command fakes**

```js
test("platform smoke requires deep health and reverb/worker readiness", async () => {
  const result = await runPlatformBoot(contextWith({ health: { ok: true }, services: { "laravel-worker": "running", "laravel-reverb": "running" } }));
  assert.equal(result.status, "passed");
});

test("backup smoke runs backup then verifies the exact returned name", async () => {
  const calls = [];
  const result = await runAdminBackup(contextWithCommands(calls, [{ status: 0, stdout: '{"name":"acceptance.tar.gz"}' }, { status: 0, stdout: '{"verified":true}' }]));
  assert.equal(result.status, "passed");
  assert.match(calls[1].join(" "), /archive:backup-verify acceptance\.tar\.gz/);
});
```

- [ ] **Step 2: Run executor tests and verify RED**

Run: `node --test scripts/acceptance/scenarios/smoke.test.mjs`
Expected: FAIL because scenario executors are missing.

- [ ] **Step 3: Implement safe operational checks**

Platform smoke calls `/api/v1/health/deep` through the provider endpoint and collects Compose service state. Backup smoke executes `php artisan archive:backup-run`, parses its single JSON line, then executes `php artisan archive:backup-verify --name=<exact basename>` inside the Laravel service. Reject path separators in the returned backup name before verification.

- [ ] **Step 4: Run unit tests and a dry selection**

Run: `node --test scripts/acceptance/scenarios/smoke.test.mjs`
Expected: tests pass.

Run: `node scripts/acceptance.mjs run --tag smoke --dry-run`
Expected: dry-run lists exactly five IDs and performs no Docker mutation.

- [ ] **Step 5: Commit operational smoke scenarios**

```bash
git add scripts/acceptance/scenarios/platform-smoke.mjs scripts/acceptance/scenarios/admin-backup-smoke.mjs scripts/acceptance/scenarios/smoke.test.mjs
git commit -m "test(acceptance): verify boot and backup smoke"
```

### Task 7: One-command gate, documentation, and completion proof

**Files:**
- Modify: `package.json`
- Modify: `scripts/verify-repo-hygiene.mjs`
- Modify: `README.md`
- Modify: `TASKS.md`
- Modify: `ChangeLog.md`
- Test: `scripts/acceptance/cli.test.mjs`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: `pnpm acceptance:test`, `pnpm acceptance:smoke`, operator documentation, and V1-801..805 closure evidence.

- [ ] **Step 1: Write the failing CLI contract test**

```js
test("package exposes the legal acceptance commands", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url)));
  assert.equal(pkg.scripts["acceptance:test"], "node --test scripts/acceptance/**/*.test.mjs scripts/acceptance/*.test.mjs");
  assert.equal(pkg.scripts["acceptance:smoke"], "node scripts/acceptance.mjs run --tag smoke");
});
```

- [ ] **Step 2: Run the CLI test and verify RED**

Run: `node --test scripts/acceptance/cli.test.mjs`
Expected: FAIL because package scripts are absent.

- [ ] **Step 3: Add commands and operational documentation**

Add the two exact scripts asserted above. Document prerequisites, default evidence root under the OS temp directory, `--last-failed`, `--keep-environment`, exit codes, throttle budget, and cleanup semantics in `README.md`. Extend repo hygiene to reject acceptance evidence under the repository. Do not check V1-801..805 until the real smoke command is green.

- [ ] **Step 4: Run the complete verification sequence**

Run:

```bash
pnpm acceptance:test
pnpm typecheck
pnpm test:next
pnpm build:next
pnpm acceptance:smoke
pnpm verify:repo-hygiene
```

Expected: every command exits 0; smoke manifest contains five `passed` results, `cleanup.proved: true`, no sensitive evidence, and duration below 900 seconds.

- [ ] **Step 5: Record completion and commit**

Remove V1-801..805 from `TASKS.md` only after Step 4. Add commit hash, duration, manifest checksum, and scenario IDs to `ChangeLog.md`, without committing environment-specific artifact paths.

```bash
git add package.json scripts/verify-repo-hygiene.mjs scripts/acceptance/cli.test.mjs README.md TASKS.md ChangeLog.md
git commit -m "test(acceptance): gate the docker smoke slice"
```

---

## Follow-on Plan Boundaries

After this plan is green, create separate implementation plans in this order:

1. V1-806..807: provider contract, Hyper-V/Windows/Linux/WSL2/external evidence, then lifecycle scenarios.
2. V1-808: admin operations, maintenance, backup/restore, and game-day.
3. V1-809 + V1-811: archivist journey and multi-user concurrency because they share role fixtures and record data.
4. V1-810: montage/media workflows with worker and FFmpeg fault recovery.
5. V1-812: deterministic benchmark generator, load/soak, and data-integrity assertions.
6. V1-813..814: scheduling, RC/GA policy gate, comparison reports, and sign-off bundle.
