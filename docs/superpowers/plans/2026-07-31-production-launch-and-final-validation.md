# Archive Suite Production Launch and Final Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إصدار Archive Suite من المسار القانوني Laravel + Next.js بعد أدلة قبول قابلة للتدقيق وقرار Go/No-Go موثق.

**Architecture:** يبقى `docs/api/archive-contract.openapi.json` عقد API الوحيد، مع Laravel وNext.js كمساري المنتج القانونيين. تفصل بوابات RC وGA بين الاختبارات المحلية، أدلة البيئات النظيفة، والتكاملات الحية؛ أي قدرة مفقودة تسجل `blocked-capability` ولا تتحول إلى نجاح.

**Tech Stack:** Node 26.5/pnpm 11، Next.js 16، React 19، Laravel/PHP عبر Docker Compose، PostgreSQL 18، Redis 8، Playwright، GitHub Actions، Docker.

## Global Constraints

- لا تضف ميزات جديدة إلى `archive-app/` أو `archive-server/`؛ هما مرجعان قديمان فقط.
- لا يعدل أي عقد عام إلا مع OpenAPI وLaravel وNext.js والتحقق من bindings في التغيير نفسه.
- لا تحفظ أسرارًا أو سجلات إنتاج خام أو ملفات بيانات 1GB في المستودع أو أدلة القبول العامة.
- لا تنجح RC أو GA بقدرة محجوبة، أو بقياس من جهاز لا يطابق `rc-baseline-linux-x64`.
- لا تنشر أو تنشئ tag أو تفعّل credential إلا بموافقة Release Manager الصريحة.

---

## File and Evidence Map

| موقع | المسؤولية |
| --- | --- |
| `scripts/acceptance/providers/docker.mjs` | مشروع Docker المعزول، بدء/تنظيف موثّقان، تشخيص محدود ومنزوع الأسرار |
| `scripts/acceptance/*.test.mjs` | اختبارات بوابات القبول والمزوّد والتنظيف وتصنيف الأخطاء |
| `docs/performance/baseline.v1.json` | مواصفات جهاز baseline والـ budgets |
| `docs/acceptance/datasets/v1-307a.manifest.json` | وصف البيانات الاصطناعية الثابت، لا دليل تشغيل |
| `docs/ops/v1-502-504-pilot-operations.md` | سجل pilot والقياسات ودفتر الفرز |
| `docs/ops/acceptance-clean-host-blockers.md` | ملكية أدلة Windows/Linux النظيفة |
| `artifacts` خارج المستودع أو مخزن أدلة مقيد | manifests، checksums، لقطات منزوعة الأسرار، تقارير الأداء والتوقيع |

### Task 1: Make the RC Docker provider diagnosable and green locally

**Files:**
- Modify: `scripts/acceptance/providers/docker.mjs`, `scripts/acceptance/runner.mjs`
- Test: `scripts/acceptance/providers/docker.test.mjs`, `scripts/acceptance/runner.test.mjs`

- [ ] Write a failing test that supplies a multi-line Docker startup error and asserts the evidence retains the final actionable lines, redacts secrets, and remains within the diagnostic size limit.
- [ ] Run `node --test scripts/acceptance/providers/docker.test.mjs scripts/acceptance/runner.test.mjs`; confirm the new assertion fails because the provider truncates the actionable tail.
- [ ] Change the provider error formatter to preserve both a short prefix and final failure tail, pass that sanitized text through `boundedDiagnosticDetail`, and never include Compose environment contents.
- [ ] Run the same tests; confirm all pass.
- [ ] Run `pnpm acceptance:smoke` on an isolated Docker project. Require `cleanup.proved: true`; if startup fails, attach its redacted manifest to the issue and keep Task 1 open.
- [ ] Commit with `fix(acceptance): preserve Docker startup diagnostics`.

### Task 2: Freeze the release candidate and its supply-chain evidence

**Files:**
- Modify: `package.json`, `docs/release-notes/v1.0.0-rc.1.md` only if the version or notes changed
- Verify: `.github/workflows/release.yml`, `scripts/verify-release-readiness.mjs`, `scripts/verify-release-supply-chain.test.mjs`

- [ ] Run `pnpm release:verify` from a clean worktree; require zero failed checks.
- [ ] Build canonical Docker images with `pnpm ci:docker` and record image digests, source commit, package version, SBOM/provenance reference, and SHA-256 checksums in the restricted evidence store.
- [ ] Verify the signed artifact from its download location, not the workspace: checksum, signature/provenance, version, OpenAPI version, and image digest must match the evidence manifest.
- [ ] Have Security approve the artifact manifest and Release Manager approve the immutable candidate identifier.
- [ ] Commit only release-note or verification-source changes; never commit signatures, tokens, generated bundles, or private artifact URLs.

### Task 3: Produce baseline performance evidence

**Files:**
- Verify: `docs/performance/baseline.v1.json`, `docs/acceptance/datasets/v1-307a.manifest.json`, `scripts/performance-collect.mjs`, `scripts/performance-regression.mjs`
- Evidence: restricted `performance/<candidate>/docker-run.json`, `native-run.json`, `dataset-manifest.json`

- [ ] Provision the declared `rc-baseline-linux-x64`: Ubuntu 24.04 x64, 4 vCPU, 8 GiB RAM, wired 100 Mbps/20 ms RTT, stable Chromium; record OS/browser/tool versions.
- [ ] Generate the dataset using `php artisan archive:generate-benchmark-dataset --seed=42 --records=100000 --files=10000 --files-total-size=1073741824 --json`; save the resulting runtime manifest, checksums, commit, and image digests outside Git.
- [ ] Run 20 or more samples at 375, 768, and 1280 for `/`, `/archive`, one record route, `/search`, and `/uploads`; capture LCP p75, CLS p75, and INP p75 as sanitized JSON.
- [ ] Run 20 or more authenticated samples for search, record-open, and upload-session-init in Docker and Native; exclude file-transfer time from the upload metric.
- [ ] Combine events with `pnpm performance:collect -- docker <frontend.json> <api.json> <docker-run.json>` and repeat for `native`; run `pnpm verify:performance-run -- <run.json>` for both.
- [ ] Require LCP ≤2500 ms, CLS ≤0.1, INP ≤200 ms, search p95 ≤1500 ms, record-open p95 ≤1000 ms, and upload-session-init p95 ≤2000 ms. Any failure is a release blocker with an issue and rerun after correction.

### Task 4: Complete live integration capability checks

**Files:**
- Verify: `scripts/extended-capabilities.mjs`, `docs/acceptance/v1-810-812-813-local-scaffolding.md`
- Evidence: restricted `integrations/<candidate>/`

- [ ] Security creates least-privilege, time-bounded test credentials for S3/Dropbox, ODBC, transcription GPU, and AI/vision/embedding provider; store them only in the approved secret manager.
- [ ] Run `pnpm acceptance:extended:preflight` with the secret-manager-derived environment file and a new evidence output path; require every provider to report `ready` before any live mutation.
- [ ] Execute one large upload, retry-after-interruption, and credential-redaction check for S3/Dropbox; revoke the test credential after evidence collection.
- [ ] Execute ODBC with the approved Windows DSN and synthetic data only; capture driver, DSN alias, query timing, and cleanup result without a connection string.
- [ ] Execute Arabic GPU transcription and AI/vision/embedding using the approved synthetic corpus; record model/version, device, quality metrics, index integrity, human-review result, and cleanup.
- [ ] Import sanitized evidence into the acceptance provider and confirm no scenario remains `blocked-capability` for a capability claimed by the candidate.

### Task 5: Run clean-host accessibility and platform acceptance

**Files:**
- Verify: `docs/ops/acceptance-clean-host-blockers.md`, `infra/platform/compatibility.v1.json`, `archive-next/e2e/accessibility*.spec.ts`
- Evidence: `pilot/<pilot-id>/environment.json` and per-host manifests in the restricted evidence store

- [ ] Prepare clean Windows 10/11 Native and clean Ubuntu Native hosts plus the approved Docker host; take snapshots before installation and record image dates.
- [ ] Install only the signed candidate in online and offline modes, then execute update and rollback on each required host; retain installer hash, result, and support bundle.
- [ ] Run keyboard-only and real screen-reader checks with NVDA on Windows and VoiceOver on macOS if macOS is in the supported compatibility contract; have a human reviewer record the results.
- [ ] Execute administrator, archivist, editor, and media workflow journeys; record onboarding, collaboration, multilingual RTL, media, backup/restore, and concurrent-session results.
- [ ] Attach sanitized manifests to the external provider. A WSL2 result must remain non-clean-host and cannot substitute for Native Linux.

### Task 6: Conduct pilot readiness and operational recovery drills

**Files:**
- Verify: `scripts/game-day.mjs`, `docs/ops/v1-501-game-day.md`, `docs/ops/v1-502-504-pilot-operations.md`
- Evidence: `pilot/<pilot-id>/environment.json`, `measurements.json`, `triage-ledger.md`, `evidence-manifest.json`

- [ ] Attach the completed Docker drill evidence for DB, Redis, worker, Reverb, network, and bounded disk fault; verify all records have `cleanup.proved: true`.
- [ ] Run the Native service-manager drills and public TLS chain/expiry/renewal validation in the RC environment; record RPO/RTO and alert-detection times.
- [ ] Execute pilots on 3–5 environments covering Windows/Linux, Docker/Native, and online/offline; use signed artifacts exclusively.
- [ ] Add every pilot defect as an immutable ledger line. Resolve all P0/P1 entries; each deferred P2 requires impact, mitigation, owner, and due date.
- [ ] Product and Operations review the final ledger and measurements before opening the RC decision.

### Task 7: RC decision, deployment, rollback, and GA decision

**Files:**
- Verify: `scripts/acceptance.mjs`, `scripts/acceptance/gates.mjs`, `.github/workflows/release.yml`, `docs/release-notes/v1.0.0-rc.1.md`
- Evidence: `release/<candidate>/rc-decision.json`, `ga-decision.json`, `deployment-log.json`, `rollback-log.json`

- [ ] Run `pnpm acceptance:rc`; require passed status, all selected scenarios passed, and `cleanup.proved: true`. A blocked, skipped, or failed scenario rejects RC.
- [ ] Hold the Go/No-Go review with Product, Engineering, Operations, and Security. Record candidate, evidence hashes, open-risk register, approved rollback trigger, named approvers, and timestamp.
- [ ] Deploy the immutable signed candidate using the documented production workflow. Run health, authenticated smoke, backup status, audit-log write, and monitoring-alert checks against the deployed endpoint.
- [ ] Rehearse rollback to the preceding signed candidate, verify schema/data compatibility and health, then redeploy the approved candidate only after the rehearsal passes.
- [ ] Run `pnpm acceptance:ga` from the signed artifact on clean hosts. Create the production tag and publish only after GA passes and the final Go decision is signed.

### Task 8: Post-launch monitoring and support handover

**Files:**
- Verify: `docs/versioning.md`, release notes, support runbooks under `docs/ops/`
- Evidence: `release/<candidate>/handover.json`

- [ ] Enable dashboard monitoring for API errors, queue age/failures, storage errors, backup health, login anomalies, and certificate expiry; test every alert route with a synthetic non-production event.
- [ ] Define first-24-hour and first-week ownership, escalation route, support response targets, and the exact rollback threshold.
- [ ] Publish release notes, known limitations, support contact, compatibility scope, and a verified download/checksum page.
- [ ] Run the 24-hour review: compare observed error rate, latency, queue behavior, and backup status against the RC evidence; log deviations as triage entries.
- [ ] Close the launch only when GA evidence, post-launch review, and support handover are complete.

## Release Gate Summary

| Gate | Passing condition | Reject condition |
| --- | --- | --- |
| Local | `pnpm release:verify`, typecheck, tests, build, API checks pass | any failed local verifier |
| RC | all selected RC scenarios pass with proved cleanup | failed, blocked, skipped, or missing evidence |
| Pilot | 3–5 clean environments and no open P0/P1 | missing platform, unsigned artifact, open P0/P1 |
| GA | signed artifact, clean-host evidence, RC evidence, Go decision | nonbaseline metric, blocked capability, missing approver |
| Post-launch | health/alerts/backup/support handover reviewed | alert route or rollback path unproven |

## Self-Review

- Spec coverage: Docker RC diagnosis, supply chain, performance, live providers, clean hosts/accessibility, pilot/recovery, RC/GA, rollback, and support all have explicit tasks.
- Placeholder scan: no deferred implementation markers or unspecified validation steps are present.
- Consistency: all performance values, required data shape, canonical paths, and RC/GA behavior match the repository contracts.
