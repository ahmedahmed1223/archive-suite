# Native Docker/Host Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both Native packages boot, uninstall safely, and earn repeatable Windows-host and Linux-Docker/systemd acceptance evidence before changing either platform status to `supported`.

**Architecture:** Keep the shared Native lifecycle engine and add the missing Linux configuration effect plus a manifest-owned uninstall path selected from the installed manifest. A deterministic acceptance runner consumes an existing verified bundle when available, isolates every mutable resource by run id, performs install/health/uninstall, sanitizes evidence, and proves cleanup. Platform status changes remain gated on successful evidence for both platforms.

**Tech Stack:** Node.js 26 ESM, `node:test`, PowerShell/Windows SCM, Debian systemd containers, Docker, PostgreSQL 18/pgvector, Redis 8.8, Laravel, Next.js, Caddy, PHP-FPM.

## Global Constraints

- Canonical application code remains `archive-next/` + `archive-laravel/`; do not add features to legacy packages.
- Docker remains a supported product path and is not replaced by Native acceptance.
- Native PostgreSQL and Redis are external endpoints; this plan does not install or delete either data service.
- Windows host effects use an explicit test root under `D:\archiveaq\Arch_App\artifacts\native-acceptance\` and only the six manifest-owned `archive-*` services.
- Linux acceptance uses Debian with real PID 1 `systemd`, `--privileged`, `--cgroupns=host`, and a cgroup bind; it must record that environment in evidence.
- Every Docker resource has a unique run label/name and is removed in `finally`; cleanup must prove absence.
- Existing bundles at `D:\archiveaq\windows-native-bundle-test` and `D:\archiveaq\linux-native-bundle-test` may be reused only after every `SHA256SUMS` entry passes.
- Evidence contains no credentials, connection strings, tokens, environment dumps, archive content, or user files.
- `update` and `rollback` remain unsupported for Native in this delivery and must be documented consistently.
- Do not modify unrelated bilingual-documentation work already present in the working tree.

---

### Task 0: Restore a truthful, loadable platform contract baseline

**Files:**
- Modify: `infra/platform/compatibility.v1.json`
- Modify: `infra/platform/compatibility.v1.schema.json`
- Modify: `scripts/platform-contract.mjs`
- Modify: `scripts/platform-contract.test.mjs`

**Interfaces:**
- Produces: a contract lifecycle accepting `supported`, `conditional`, and `planned`; Docker retains the documentation commit's `supported` state while both Native platforms remain `planned` until Tasks 6 and 7 produce evidence.

- [ ] **Step 1: Change the expected contract lifecycle in the test**

Assert the current truthful platform sequence is `["supported", "supported", "planned", "planned"]` and that the schema status enums contain all three lifecycle values.

- [ ] **Step 2: Run the focused test and verify red**

Run: `node --test scripts/platform-contract.test.mjs scripts/control-center/access-mode.test.mjs`

Expected: FAIL because the validator rejects `supported` and the Native contract still claims support without evidence.

- [ ] **Step 3: Implement the minimal contract correction**

Allow all three lifecycle states in `platform-contract.mjs` and the JSON schema, restore only `windows-native.status` and `linux-native.status` to `planned`, and update `supportPolicy` so it does not claim every entry is supported.

- [ ] **Step 4: Run the focused baseline tests**

Run: `node --test scripts/platform-contract.test.mjs scripts/control-center/access-mode.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit Task 0**

```bash
git add infra/platform/compatibility.v1.json infra/platform/compatibility.v1.schema.json scripts/platform-contract.mjs scripts/platform-contract.test.mjs
git commit -m "fix(platform): keep native support evidence-gated"
```

---

### Task 1: Linux application configuration effect

**Files:**
- Create: `scripts/control-center/linux-app-config.mjs`
- Create: `scripts/control-center/linux-app-config.test.mjs`
- Modify: `scripts/control-center/linux-host-effects.mjs`
- Modify: `scripts/control-center/linux-host-effects.test.mjs`

**Interfaces:**
- Consumes: `renderLaravelEnv(options): string` from `windows-app-config.mjs` for the platform-neutral Laravel environment format.
- Produces: `renderLinuxCaddyfile({ installRoot, access, domain }): string`, `renderPhpFpmConfig({ installRoot }): string`, and `createLinuxHostEffects(...).writeAppConfig(options): { status: number }`.

- [ ] **Step 1: Write failing renderer tests**

```js
test("Linux app config uses POSIX paths and a foreground PHP-FPM listener", () => {
  assert.match(renderLinuxCaddyfile({ installRoot: "/opt/archive-suite", access: "local" }), /root \* \/opt\/archive-suite\/app\/laravel\/public/);
  assert.match(renderPhpFpmConfig({ installRoot: "/opt/archive-suite" }), /listen = 127\.0\.0\.1:9000/);
  assert.match(renderPhpFpmConfig({ installRoot: "/opt/archive-suite" }), /user = archive/);
});

test("Linux public Caddy config requires a domain", () => {
  assert.throws(() => renderLinuxCaddyfile({ installRoot: "/opt/archive-suite", access: "public" }), /ARCHIVE_NATIVE_DOMAIN/);
});
```

- [ ] **Step 2: Run the renderer tests and verify red**

Run: `node --test scripts/control-center/linux-app-config.test.mjs`

Expected: FAIL because `linux-app-config.mjs` does not exist.

- [ ] **Step 3: Implement the Linux renderers**

```js
import { renderLaravelEnv } from "./windows-app-config.mjs";

export function renderLinuxCaddyfile({ installRoot, access, domain } = {}) {
  if (access === "public" && !domain?.trim()) throw new Error("Public access requires ARCHIVE_NATIVE_DOMAIN.");
  const address = access === "public" ? domain : ":8443";
  const prefix = access === "public" ? [] : ["{", "\tauto_https off", "}", ""];
  return [...prefix, `${address} {`, "\tencode zstd gzip", "\t@api path /api/* /storage/*", "\thandle @api {", `\t\troot * ${installRoot}/app/laravel/public`, "\t\tphp_fastcgi 127.0.0.1:9000", "\t\tfile_server", "\t}", "\thandle {", "\t\treverse_proxy 127.0.0.1:3000", "\t}", "}"].join("\n") + "\n";
}

export function renderPhpFpmConfig({ installRoot } = {}) {
  return ["[global]", "daemonize = no", `error_log = ${installRoot}/logs/php-fpm.log`, "", "[archive]", "user = archive", "group = archive", "listen = 127.0.0.1:9000", "pm = dynamic", "pm.max_children = 8", "pm.start_servers = 2", "pm.min_spare_servers = 1", "pm.max_spare_servers = 3", `chdir = ${installRoot}/app/laravel`, "clear_env = no"].join("\n") + "\n";
}

export { renderLaravelEnv };
```

- [ ] **Step 4: Add a failing host-effect test for all three files**

```js
test("writeAppConfig writes Caddy, PHP-FPM, and Laravel configuration inside the install root", () => {
  const rec = recorder();
  const effects = createLinuxHostEffects({ installRoot: "/opt/archive-suite", run: rec.run, writeFile: rec.writeFile });
  const result = effects.writeAppConfig({ access: "local", appKey: "base64:test", appUrl: "http://localhost:8443", dataPlan: externalPlan, dbUsername: "archive", dbPassword: "secret" });
  assert.equal(result.status, 0);
  assert.deepEqual(rec.files.map(({ path }) => path), [
    "/opt/archive-suite/config/Caddyfile",
    "/opt/archive-suite/config/php-fpm.conf",
    "/opt/archive-suite/app/laravel/.env",
  ]);
});
```

- [ ] **Step 5: Wire `writeAppConfig` and run focused tests**

Run: `node --test scripts/control-center/linux-app-config.test.mjs scripts/control-center/linux-host-effects.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add scripts/control-center/linux-app-config.mjs scripts/control-center/linux-app-config.test.mjs scripts/control-center/linux-host-effects.mjs scripts/control-center/linux-host-effects.test.mjs
git commit -m "fix(linux-native): render runtime application config"
```

---

### Task 2: Resumable Linux `app-configured` install step

**Files:**
- Modify: `scripts/control-center/linux-runtime-adapter.mjs`
- Modify: `scripts/control-center/linux-runtime-adapter.test.mjs`
- Modify: `scripts/control-center/native-setup.mjs`
- Modify: `scripts/control-center/native-setup.test.mjs`

**Interfaces:**
- Consumes: `createLinuxHostEffects(...).writeAppConfig(options)` from Task 1.
- Produces: `LINUX_INSTALL_STEPS` containing `app-configured` and Linux `buildNativeRuntime({ appConfig })` wiring matching Windows.

- [ ] **Step 1: Write the failing adapter-order test**

```js
assert.deepEqual(LINUX_INSTALL_STEPS, [
  "data-services-ready",
  "ownership-applied",
  "logrotate-applied",
  "app-configured",
  "firewall-applied",
  "services-installed",
  "services-started",
]);
```

- [ ] **Step 2: Verify red**

Run: `node --test scripts/control-center/linux-runtime-adapter.test.mjs`

Expected: FAIL because `app-configured` is absent.

- [ ] **Step 3: Insert the resumable step**

Add `writeAppConfig` to `createLinuxNativeRuntimeAdapter` and insert:

```js
{ step: "app-configured", run: () => (writeAppConfig ? writeAppConfig() : { status: 0 }) },
```

after logrotate and before firewall/service registration.

- [ ] **Step 4: Write the failing end-to-end wiring test**

Extend the Linux `buildNativeRuntime` test to provide `appConfig`, run `adapter.install`, assert the exact `LINUX_INSTALL_STEPS`, and assert that `Caddyfile`, `php-fpm.conf`, and `.env` were written.

- [ ] **Step 5: Wire `native-setup.mjs` and verify green**

Pass a closure to `writeAppConfig` with `configuration.access`, `domain`, `dataPlan`, `appKey`, `appUrl`, `dbUsername`, and `dbPassword`, exactly as the Windows branch does.

Run: `node --test scripts/control-center/linux-runtime-adapter.test.mjs scripts/control-center/native-setup.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add scripts/control-center/linux-runtime-adapter.mjs scripts/control-center/linux-runtime-adapter.test.mjs scripts/control-center/native-setup.mjs scripts/control-center/native-setup.test.mjs
git commit -m "fix(linux-native): configure app before starting services"
```

---

### Task 3: Manifest-owned application paths

**Files:**
- Modify: `scripts/control-center/installation-manifest.mjs`
- Modify: `scripts/control-center/installation-manifest.test.mjs`
- Modify: `scripts/control-center/native-setup.mjs`
- Modify: `scripts/control-center/native-setup.test.mjs`

**Interfaces:**
- Produces: optional normalized `ownedPaths: string[]` on installation manifests; Docker inputs normalize to `[]`, while Native input records exactly its resolved install root.
- Safety invariant: reject `/`, `\\`, drive roots such as `C:\\`, URLs, credential-bearing values, duplicates, and empty paths.

- [ ] **Step 1: Write failing manifest safety tests**

```js
test("ownedPaths rejects filesystem roots and credential-bearing values", () => {
  for (const ownedPaths of [["/"], ["C:\\"], ["https://example.test/app"], ["user:secret@host"]]) {
    assert.throws(() => createInstallationManifest({ path: "m.json", input: { ...validInput(), ownedPaths }, fs }), /ownedPaths/);
  }
});

test("native manifest owns its resolved application root but not external data services", () => {
  const input = nativeManifestInput(linuxConfig, { version: "1.0.0", installRoot: "/opt/archive-suite" });
  assert.deepEqual(input.ownedPaths, ["/opt/archive-suite"]);
  assert.deepEqual(input.dataPaths, { storage: "/srv/archive" });
});
```

- [ ] **Step 2: Verify red**

Run: `node --test scripts/control-center/installation-manifest.test.mjs scripts/control-center/native-setup.test.mjs`

Expected: FAIL because `ownedPaths` is not accepted or emitted.

- [ ] **Step 3: Implement normalization and round-trip validation**

Add `normalizeOwnedPaths`, include `ownedPaths` in `normalizeInput`, `releaseReference`, and `validateManifest`, and default missing legacy input to `[]` so existing Docker callers remain compatible.

- [ ] **Step 4: Pass the resolved root into Native manifest input**

Change the signature to:

```js
nativeManifestInput(configuration, { version, installRoot })
```

and call it from `nativeSetupInstallOrRepair` with the same resolved root passed to `buildNativeRuntime`.

- [ ] **Step 5: Run manifest and Native setup tests**

Run: `node --test scripts/control-center/installation-manifest.test.mjs scripts/control-center/native-setup.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add scripts/control-center/installation-manifest.mjs scripts/control-center/installation-manifest.test.mjs scripts/control-center/native-setup.mjs scripts/control-center/native-setup.test.mjs
git commit -m "feat(native): record manifest-owned install paths"
```

---

### Task 4: Mode-aware Native uninstall

**Files:**
- Modify: `scripts/control-center/uninstall.mjs`
- Modify: `scripts/control-center/uninstall.test.mjs`
- Modify: `scripts/control-center/native-setup.mjs`
- Modify: `scripts/control-center/native-setup.test.mjs`
- Modify: `scripts/control-center.mjs`
- Modify: `scripts/control-center.test.mjs`

**Interfaces:**
- Produces: `buildNativeServiceRemover({ platform, installRoot, run, writeFile })` and a single uninstall operation supporting `docker` and `native`.
- `createUninstall` gains `removeOwnedPaths(ownedPaths)`; it removes owned application paths after services and before optional user-data deletion, and keeps the manifest if either removal fails.

- [ ] **Step 1: Write failing uninstall ordering and failure tests**

```js
assert.deepEqual(calls, [
  ["removeServices", false],
  ["removeOwnedPaths", ["/opt/archive-suite"]],
  ["removeManifest"],
]);

assert.equal(await failedOwnedPathRemoval.code, "UNINSTALL_OWNED_PATHS_FAILED");
assert.ok(!calls.some(([name]) => name === "removeManifest"));
```

Also assert that Native default uninstall never calls `deleteDataPaths` and therefore never touches PostgreSQL, Redis, or the retained storage path.

- [ ] **Step 2: Verify red**

Run: `node --test scripts/control-center/uninstall.test.mjs`

Expected: FAIL because `removeOwnedPaths` is absent.

- [ ] **Step 3: Implement owned-path removal in `createUninstall`**

Invoke `removeOwnedPaths(manifest.ownedPaths)` only after successful service removal. On error return `UNINSTALL_OWNED_PATHS_FAILED`, keep user data and the manifest, and do not expose filesystem exception text.

- [ ] **Step 4: Write failing platform remover tests**

For Windows, assert WinSW `stop`/`uninstall` and firewall deletion target only manifest service ids. For Linux, assert `systemctl stop`, `disable`, removal of the exact six unit files, and `daemon-reload`.

- [ ] **Step 5: Export `buildNativeServiceRemover`**

Use `nativePlatformFamily` to create the correct host effects and `createWindowsServiceRemover`/`createLinuxServiceRemover`; reject any non-Native platform before running a command.

- [ ] **Step 6: Write a failing CLI dispatch test**

Create a Native manifest in an isolated temp directory, run `uninstall --yes --json` with injected/no-op host effects, and assert the result is no longer `MODE_UNSUPPORTED` and that Docker Compose is never invoked.

- [ ] **Step 7: Route uninstall from the installed manifest**

In `control-center.mjs`, use one `createUninstall` supporting `docker` and `native`; dispatch `removeServices` by `manifest.mode`. For Native, resolve the platform and install root only from validated manifest fields, then remove exactly `manifest.services` and `manifest.ownedPaths`.

- [ ] **Step 8: Run focused and full Control Center tests**

Run: `node --test scripts/control-center/uninstall.test.mjs scripts/control-center/native-setup.test.mjs scripts/control-center.test.mjs`

Run: `node --test scripts/control-center/*.test.mjs scripts/control-center/**/*.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 9: Commit Task 4**

```bash
git add scripts/control-center.mjs scripts/control-center.test.mjs scripts/control-center/uninstall.mjs scripts/control-center/uninstall.test.mjs scripts/control-center/native-setup.mjs scripts/control-center/native-setup.test.mjs
git commit -m "feat(native): uninstall manifest-owned services and files"
```

---

### Task 5: Deterministic acceptance runner and evidence contract

**Files:**
- Create: `scripts/native-acceptance.mjs`
- Create: `scripts/native-acceptance.test.mjs`
- Create: `scripts/native-acceptance/evidence.mjs`
- Create: `scripts/native-acceptance/evidence.test.mjs`
- Modify: `package.json`

**Interfaces:**
- CLI: `node scripts/native-acceptance.mjs windows --bundle <path> --confirm-host-effects` and `node scripts/native-acceptance.mjs linux --bundle <path>`.
- Evidence writer: `writeAcceptanceEvidence({ platform, runId, bundleDigest, environment, scenarios, cleanup }, { outputDir }): string`.
- Runner exit code: `0` only when checksum, install, six-service health, HTTP health, uninstall, and cleanup proof all pass.

- [ ] **Step 1: Write failing checksum/evidence tests**

Cover a valid closed `SHA256SUMS`, a mismatch, a missing file, a file not listed by the manifest, credential redaction, deterministic JSON ordering, and refusal to write evidence when cleanup is unproven.

- [ ] **Step 2: Verify red**

Run: `node --test scripts/native-acceptance.test.mjs scripts/native-acceptance/evidence.test.mjs`

Expected: FAIL because the runner modules do not exist.

- [ ] **Step 3: Implement the pure evidence and checksum layer**

Evidence fields are limited to `schemaVersion`, `platform`, `runId`, `commit`, `version`, `bundleDigest`, `environment`, `scenarios`, `cleanup`, and `createdAt`. Recursively reject keys matching `/password|secret|token|credential|authorization|cookie|dsn|connection|key/i` and values containing credential URLs.

- [ ] **Step 4: Implement the guarded Windows runner**

Require Windows, elevation, and `--confirm-host-effects`; copy the verified bundle to the run root, start uniquely named Docker PostgreSQL/Redis dependencies, generate an isolated setup config/manifest, invoke install, check all six services and `http://127.0.0.1:8443`, invoke uninstall in `finally`, and prove services, run root, manifest, and Docker resources are absent.

- [ ] **Step 5: Implement the Linux Docker/systemd runner**

Create a unique Docker network plus PostgreSQL/Redis containers, start a Debian systemd container with the required cgroup flags, copy the verified bundle into its filesystem, provision the service user, invoke install, check `systemctl is-system-running`, six service states and HTTP health, invoke uninstall, and prove units/files/containers/network are absent in `finally`.

- [ ] **Step 6: Add scripts without disturbing existing keys**

```json
"acceptance:native:windows": "node scripts/native-acceptance.mjs windows",
"acceptance:native:linux": "node scripts/native-acceptance.mjs linux"
```

- [ ] **Step 7: Run unit tests and dry-run guards**

Run: `node --test scripts/native-acceptance.test.mjs scripts/native-acceptance/evidence.test.mjs`

Run: `node scripts/native-acceptance.mjs windows --bundle D:\archiveaq\windows-native-bundle-test`

Expected: the second command exits nonzero with `HOST_EFFECTS_CONFIRMATION_REQUIRED` and makes no changes.

- [ ] **Step 8: Commit Task 5**

```bash
git add package.json scripts/native-acceptance.mjs scripts/native-acceptance.test.mjs scripts/native-acceptance/evidence.mjs scripts/native-acceptance/evidence.test.mjs
git commit -m "feat(native): add guarded host acceptance runner"
```

---

### Task 6: Live Linux Docker/systemd acceptance

**Files:**
- Create: `docs/evidence/v1-211d-native/final-manifest.json`
- Create: `docs/evidence/v1-211d-native/README.md`

**Interfaces:**
- Consumes: verified `D:\archiveaq\linux-native-bundle-test` or a newly built bundle if verification fails.
- Produces: sanitized evidence that explicitly identifies `docker-systemd` and proves cleanup.

- [ ] **Step 1: Verify/rebuild the Linux bundle**

Run: `pnpm run bundle:linux-native -- --out <workspace-artifact-path>` only if the existing bundle fails closed checksum verification.

- [ ] **Step 2: Run live acceptance**

Run: `pnpm run acceptance:native:linux -- --bundle D:\archiveaq\linux-native-bundle-test`

Expected: PASS for install, six service states, HTTP health, uninstall, and cleanup.

- [ ] **Step 3: Leak-scan and review evidence**

Run: `rg -n -i "password|secret|token|credential|authorization|cookie|postgres://|redis://" docs/evidence/v1-211d-native`

Expected: no matches.

- [ ] **Step 4: Commit Task 6**

```bash
git add docs/evidence/v1-211d-native
git commit -m "test(linux-native): record docker systemd acceptance"
```

---

### Task 7: Live Windows host acceptance

**Files:**
- Create: `docs/evidence/v1-210d-native/final-manifest.json`
- Create: `docs/evidence/v1-210d-native/README.md`

**Interfaces:**
- Consumes: verified `D:\archiveaq\windows-native-bundle-test` or a newly built bundle if verification fails.
- Produces: sanitized Windows-host evidence and a proven-clean host state.

- [ ] **Step 1: Verify/rebuild the Windows bundle**

Run: `pnpm run bundle:windows-native -- --out <workspace-artifact-path>` only if the existing bundle fails closed checksum verification.

- [ ] **Step 2: Obtain explicit approval/elevation immediately before host effects**

The acceptance command registers and removes six Windows services. Do not infer approval by timeout; request it at the tool boundary.

- [ ] **Step 3: Run live acceptance with cleanup in `finally`**

Run: `pnpm run acceptance:native:windows -- --bundle D:\archiveaq\windows-native-bundle-test --confirm-host-effects`

Expected: PASS for install, six Windows service states, HTTP health, uninstall, and cleanup.

- [ ] **Step 4: Independently prove no residue**

Run: `Get-Service archive-* -ErrorAction SilentlyContinue`

Expected: no Archive services.

Run: `docker ps -a --filter label=com.archive-suite.native-acceptance --format '{{.ID}}'`

Expected: no container from this run.

- [ ] **Step 5: Leak-scan and review evidence**

Run: `rg -n -i "password|secret|token|credential|authorization|cookie|postgres://|redis://" docs/evidence/v1-210d-native`

Expected: no matches.

- [ ] **Step 6: Commit Task 7**

```bash
git add docs/evidence/v1-210d-native
git commit -m "test(windows-native): record host acceptance"
```

---

### Task 8: Reconcile support claims and historical plans

**Files:**
- Modify: `infra/platform/compatibility.v1.json`
- Modify: `docs/superpowers/plans/2026-08-06-windows-native-release.md`
- Modify: `docs/superpowers/plans/2026-08-06-linux-native-release.md`
- Modify: `docs/superpowers/plans/2026-07-12-v1-agent-execution-plan.md`
- Modify: `docs/ops/acceptance-clean-host-blockers.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: successful evidence from Tasks 6 and 7.
- Produces: one consistent status statement; no reference to nonexistent `TASKS.md`.

- [ ] **Step 1: Add failing support-claim assertions**

Extend the platform/release readiness tests so `supported` requires the matching evidence manifest, exact platform id, passing required scenarios, and `cleanup.ok === true`.

- [ ] **Step 2: Verify red before changing status**

Run: `node --test scripts/platform-contract.test.mjs scripts/verify-release-readiness.test.mjs`

Expected: FAIL against the old `planned`/evidence assumptions.

- [ ] **Step 3: Reconcile platform status only if both evidence tasks passed**

Change `windows-native.status` and `linux-native.status` to `supported`; preserve explicit `update`/`rollback` limitations in requirements and documentation. If either evidence task did not pass, keep both statuses `planned` and record the exact blocked capability.

- [ ] **Step 4: Close stale plan checkboxes and remove `TASKS.md` references**

Mark superseded Linux Task 7 steps as not applicable, close the completed host/systemd acceptance items with evidence links, and point historical closure notes to `CHANGELOG.md` plus the two Native plans.

- [ ] **Step 5: Run contract, readiness, hygiene, and security gates**

Run: `node --test scripts/platform-contract.test.mjs scripts/verify-release-readiness.test.mjs`

Run: `node scripts/verify-release-readiness.mjs`

Run: `pnpm verify:repo-hygiene`

Run: `pnpm security:baseline`

Expected: PASS. Any unavailable external capability remains an explicit block, never a synthetic pass.

- [ ] **Step 6: Run the complete relevant script suite**

Run: `node --test scripts/control-center.test.mjs scripts/control-center/*.test.mjs scripts/control-center/**/*.test.mjs scripts/native-acceptance.test.mjs scripts/native-acceptance/evidence.test.mjs scripts/platform-contract.test.mjs scripts/verify-release-readiness.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 7: Commit Task 8**

```bash
git add CHANGELOG.md infra/platform/compatibility.v1.json docs/superpowers/plans/2026-08-06-windows-native-release.md docs/superpowers/plans/2026-08-06-linux-native-release.md docs/superpowers/plans/2026-07-12-v1-agent-execution-plan.md docs/ops/acceptance-clean-host-blockers.md scripts/platform-contract.test.mjs scripts/verify-release-readiness.test.mjs scripts/verify-release-readiness.mjs
git commit -m "docs(native): publish verified platform support status"
```
