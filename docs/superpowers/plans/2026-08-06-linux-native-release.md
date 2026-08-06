# Linux Native Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an installable, Docker-free Linux package for Archive Suite (Caddy + Next.js + Laravel PHP-FPM/worker/reverb/scheduler) that installs as real systemd services, so `linux-native` can move from `"status": "planned"` to `"status": "supported"` in `infra/platform/compatibility.v1.json`.

**Architecture:** Mirrors the sibling `docs/superpowers/plans/2026-08-06-windows-native-release.md` plan's shape — same runtime adapter/host-effects/service-definition scaffolding already exists (`scripts/control-center/linux-runtime-adapter.mjs`, `linux-host-effects.mjs`, `linux-services.mjs`), same three gaps: no bundler staging portable runtimes into the layout `linux-host-effects.mjs` already assumes, zero test coverage on the host-effects command construction itself, and the CLI's `MODE_UNSUPPORTED` gate still blocking `linux-native`. **Task 6 (external-endpoint data probes) is shared code already built by the Windows plan — this plan reuses `scripts/control-center/native-probes.mjs` rather than duplicating it.** If executing this plan before the Windows plan, build Task 6 here instead; if after, skip straight to wiring it in.

**Tech Stack:** Node.js 26.x (bundler + runtime), PHP 8.5.8 NTS, statically linked for portability (via `static-php-cli` — matches `archive-laravel/Dockerfile.worker`'s `php:8.5.8-fpm` version pin), systemd (service manager, already assumed by `linux-host-effects.mjs`), Caddy (reverse proxy/TLS, already a defined service).

## Global Constraints

- Node version floor: `>=26.5.0 <27` — pin the bundled runtime to exactly `26.5.0`.
- PHP version: `8.5.8`, matching `archive-laravel/Dockerfile.worker` line 20.
- PHP extensions required: `curl, ftp, mbstring, zip, pdo, pdo_pgsql, pcntl` (from `Dockerfile.worker` line 42 -- **unlike Windows, `pcntl` IS available and required on Linux**; it gives `queue:work`/`schedule:work` graceful SIGTERM handling under systemd's `Type=simple` + `KillSignal=SIGTERM`).
- Install root: `/opt/archive-suite` (`scripts/control-center/linux-services.mjs` `LINUX_SERVICE_USER.home` -- do not change it).
- Service user: `archive`, shell `/usr/sbin/nologin` (`LINUX_SERVICE_USER`, already defined -- do not change it).
- Services (already defined in `linux-services.mjs`, do not rename): `archive-http` (Caddy), `archive-next` (Node), `archive-php-fpm` (PHP-FPM), `archive-worker`, `archive-reverb`, `archive-scheduler`.
- Data plan: **this plan scopes native Linux to an external PostgreSQL/Redis endpoint only**, identical reasoning and identical shared module (`native-probes.mjs`) as the Windows plan. Bundling a managed local Postgres/Redis is separate, out-of-scope work.
- Checksums: every downloaded/staged runtime component must be SHA-256 pinned in source, following the `infra/offline/install.sh` `sha256sum --check SHA256SUMS` pattern.
- Target distros for the clean-host acceptance phase (Task 10): Ubuntu 22.04 LTS and Ubuntu 24.04 LTS (systemd, glibc, matches the `apt`-based `Dockerfile.worker` base) as the minimum bar -- do not leave this undecided when Task 10 starts.

---

### Task 1: Portable PHP runtime stager (static-php-cli build)

**Files:**
- Create: `scripts/control-center/linux-bundle/stage-php.mjs`
- Create: `scripts/control-center/linux-bundle/stage-php.test.mjs`

**Interfaces:**
- Produces: `stagePhpRuntime({ destDir, fetch, extract, sha256 }): Promise<{ ok, phpBinPath, extensionsEnabled }>` -- consumed by Task 5.

- [ ] **Step 1: Write the failing test**

```javascript
// scripts/control-center/linux-bundle/stage-php.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stagePhpRuntime, PHP_LINUX_SHA256, PHP_LINUX_URL } from "./stage-php.mjs";

test("stagePhpRuntime downloads the pinned tar.gz, verifies checksum, extracts, writes php.ini", async () => {
  const destDir = mkdtempSync(join(tmpdir(), "archive-php-stage-"));
  try {
    const fetchCalls = [];
    const fetch = async (url) => { fetchCalls.push(url); return Buffer.from("fake-php-tarball"); };
    const extract = async (_bytes, targetDir) => {
      const { mkdirSync, writeFileSync, chmodSync } = await import("node:fs");
      mkdirSync(join(targetDir, "bin"), { recursive: true });
      mkdirSync(join(targetDir, "sbin"), { recursive: true });
      writeFileSync(join(targetDir, "bin", "php"), "");
      chmodSync(join(targetDir, "bin", "php"), 0o755);
      writeFileSync(join(targetDir, "sbin", "php-fpm"), "");
      chmodSync(join(targetDir, "sbin", "php-fpm"), 0o755);
    };

    const result = await stagePhpRuntime({ destDir, fetch, extract, sha256: () => PHP_LINUX_SHA256 });

    assert.equal(result.ok, true);
    assert.equal(fetchCalls[0], PHP_LINUX_URL);
    assert.ok(existsSync(result.phpBinPath));
    assert.equal(result.phpBinPath, join(destDir, "bin", "php"));

    const ini = readFileSync(join(destDir, "php.ini"), "utf8");
    for (const ext of ["curl", "ftp", "mbstring", "zip", "pdo", "pdo_pgsql", "pcntl"]) {
      assert.ok(ini.includes(`extension=${ext}`), `must enable extension=${ext}`);
    }
  } finally {
    rmSync(destDir, { recursive: true, force: true });
  }
});

test("stagePhpRuntime rejects a checksum mismatch instead of extracting", async () => {
  const destDir = mkdtempSync(join(tmpdir(), "archive-php-stage-"));
  try {
    const fetch = async () => Buffer.from("tampered");
    let extractCalled = false;
    const extract = async () => { extractCalled = true; };
    await assert.rejects(
      () => stagePhpRuntime({ destDir, fetch, extract, sha256: () => "0".repeat(64) }),
      /checksum mismatch/i
    );
    assert.equal(extractCalled, false);
  } finally {
    rmSync(destDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/control-center/linux-bundle/stage-php.test.mjs`
Expected: FAIL -- module doesn't exist.

- [ ] **Step 3: Write minimal implementation**

```javascript
// scripts/control-center/linux-bundle/stage-php.mjs
// Stages a statically-linked, portable PHP 8.5.8 runtime (via static-php-cli
// prebuilt releases) so the bundle needs no system PHP or shared libraries
// on the target host. Pinned to the same PHP version
// archive-laravel/Dockerfile.worker uses.
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const PHP_VERSION = "8.5.8";
export const PHP_LINUX_URL = `https://dl.static-php.dev/static-php-cli/bulk/php-${PHP_VERSION}-cli-fpm-linux-x86_64.tar.gz`;
export const PHP_LINUX_SHA256 = "REPLACE_WITH_REAL_SHA256_FROM_STATIC_PHP_DEV_RELEASE";

const REQUIRED_EXTENSIONS = ["curl", "ftp", "mbstring", "zip", "pdo", "pdo_pgsql", "pcntl"];

function defaultSha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function defaultFetch(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function defaultExtract(tarballBytes, targetDir) {
  const { spawnSync } = await import("node:child_process");
  const { writeFileSync: wf, mkdirSync: mk } = await import("node:fs");
  const os = await import("node:os");
  mk(targetDir, { recursive: true });
  const tmpTar = join(os.tmpdir(), `php-runtime-${Date.now()}.tar.gz`);
  wf(tmpTar, tarballBytes);
  const result = spawnSync("tar", ["-xzf", tmpTar, "-C", targetDir]);
  if (result.status !== 0) throw new Error(`tar extraction failed: ${result.stderr}`);
}

export async function stagePhpRuntime({ destDir, fetch = defaultFetch, extract = defaultExtract, sha256 = defaultSha256 } = {}) {
  if (typeof destDir !== "string" || !destDir.trim()) throw new Error("stagePhpRuntime requires destDir.");
  const tarballBytes = await fetch(PHP_LINUX_URL);
  const actualHash = sha256(tarballBytes);
  if (actualHash !== PHP_LINUX_SHA256) throw new Error(`PHP runtime checksum mismatch: expected ${PHP_LINUX_SHA256}, got ${actualHash}`);
  await extract(tarballBytes, destDir);

  const phpBinPath = join(destDir, "bin", "php");
  try { chmodSync(phpBinPath, 0o755); } catch { /* extraction may already set the mode */ }
  try { chmodSync(join(destDir, "sbin", "php-fpm"), 0o755); } catch { /* same */ }

  const iniLines = [
    "; Generated by scripts/control-center/linux-bundle/stage-php.mjs -- do not edit by hand.",
    ...REQUIRED_EXTENSIONS.map((ext) => `extension=${ext}`),
  ];
  mkdirSync(destDir, { recursive: true });
  writeFileSync(join(destDir, "php.ini"), iniLines.join("\n") + "\n", "utf8");

  return { ok: true, phpBinPath, extensionsEnabled: REQUIRED_EXTENSIONS };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/control-center/linux-bundle/stage-php.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/control-center/linux-bundle/stage-php.mjs scripts/control-center/linux-bundle/stage-php.test.mjs
git commit -m "feat(linux-native): add static-php-cli portable runtime stager"
```

- [ ] **Step 6: Resolve the real checksum (manual, one-time, on a machine with network access)**

```bash
curl -fsSL -o php.tar.gz "https://dl.static-php.dev/static-php-cli/bulk/php-8.5.8-cli-fpm-linux-x86_64.tar.gz"
sha256sum php.tar.gz
```

Replace `PHP_LINUX_SHA256` with the printed hash. If `static-php-cli` has no prebuilt `8.5.8` combined `cli-fpm` release with the exact extension set at execution time, build one via their documented `--extensions` flag (`curl,ftp,mbstring,zip,pdo,pdo_pgsql,pcntl`) rather than substituting a different extension set silently -- update `PHP_LINUX_URL` to point at the resulting artifact and re-derive the checksum from that build.

---

### Task 2: Portable Node.js and Caddy stagers

**Files:**
- Create: `scripts/control-center/linux-bundle/stage-node.mjs`
- Create: `scripts/control-center/linux-bundle/stage-node.test.mjs`
- Create: `scripts/control-center/linux-bundle/stage-caddy.mjs`
- Create: `scripts/control-center/linux-bundle/stage-caddy.test.mjs`

**Interfaces:**
- Produces: `stageNodeRuntime({ destDir, fetch, extract, sha256 }): Promise<{ ok, nodeBinPath }>`
- Produces: `stageCaddyRuntime({ destDir, fetch, extract, sha256 }): Promise<{ ok, caddyBinPath }>`
- Both consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

```javascript
// scripts/control-center/linux-bundle/stage-node.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageNodeRuntime, NODE_VERSION, NODE_LINUX_SHA256, NODE_LINUX_URL } from "./stage-node.mjs";

test("stageNodeRuntime downloads the pinned tarball, verifies checksum, extracts bin/node", async () => {
  const destDir = mkdtempSync(join(tmpdir(), "archive-node-stage-"));
  try {
    const fetchCalls = [];
    const fetch = async (url) => { fetchCalls.push(url); return Buffer.from("fake-node-tarball"); };
    const extract = async (_bytes, targetDir) => {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(join(targetDir, "bin"), { recursive: true });
      writeFileSync(join(targetDir, "bin", "node"), "");
    };
    const result = await stageNodeRuntime({ destDir, fetch, extract, sha256: () => NODE_LINUX_SHA256 });
    assert.equal(result.ok, true);
    assert.equal(fetchCalls[0], NODE_LINUX_URL);
    assert.ok(existsSync(result.nodeBinPath));
    assert.match(NODE_LINUX_URL, new RegExp(NODE_VERSION.replace(/\./g, "\\.")));
  } finally {
    rmSync(destDir, { recursive: true, force: true });
  }
});
```

```javascript
// scripts/control-center/linux-bundle/stage-caddy.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageCaddyRuntime, CADDY_LINUX_SHA256, CADDY_LINUX_URL } from "./stage-caddy.mjs";

test("stageCaddyRuntime downloads the pinned tarball, verifies checksum, extracts caddy", async () => {
  const destDir = mkdtempSync(join(tmpdir(), "archive-caddy-stage-"));
  try {
    const fetchCalls = [];
    const fetch = async (url) => { fetchCalls.push(url); return Buffer.from("fake-caddy-tarball"); };
    const extract = async (_bytes, targetDir) => {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(join(targetDir, "caddy"), "");
    };
    const result = await stageCaddyRuntime({ destDir, fetch, extract, sha256: () => CADDY_LINUX_SHA256 });
    assert.equal(result.ok, true);
    assert.equal(fetchCalls[0], CADDY_LINUX_URL);
    assert.ok(existsSync(result.caddyBinPath));
  } finally {
    rmSync(destDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/control-center/linux-bundle/stage-node.test.mjs scripts/control-center/linux-bundle/stage-caddy.test.mjs`
Expected: FAIL -- modules don't exist.

- [ ] **Step 3: Write minimal implementation**

```javascript
// scripts/control-center/linux-bundle/stage-node.mjs
import { createHash } from "node:crypto";
import { chmodSync } from "node:fs";
import { join } from "node:path";

export const NODE_VERSION = "26.5.0";
export const NODE_LINUX_URL = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz`;
export const NODE_LINUX_SHA256 = "REPLACE_WITH_REAL_SHA256_FROM_NODEJS_ORG_SHASUMS256";

function defaultSha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function defaultFetch(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function defaultExtract(tarballBytes, targetDir) {
  const { spawnSync } = await import("node:child_process");
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const os = await import("node:os");
  mkdirSync(targetDir, { recursive: true });
  const tmpTar = join(os.tmpdir(), `node-runtime-${Date.now()}.tar.xz`);
  writeFileSync(tmpTar, tarballBytes);
  const result = spawnSync("tar", ["-xJf", tmpTar, "-C", targetDir, "--strip-components=1"]);
  if (result.status !== 0) throw new Error(`tar extraction failed: ${result.stderr}`);
}

export async function stageNodeRuntime({ destDir, fetch = defaultFetch, extract = defaultExtract, sha256 = defaultSha256 } = {}) {
  if (typeof destDir !== "string" || !destDir.trim()) throw new Error("stageNodeRuntime requires destDir.");
  const tarballBytes = await fetch(NODE_LINUX_URL);
  const actualHash = sha256(tarballBytes);
  if (actualHash !== NODE_LINUX_SHA256) throw new Error(`Node runtime checksum mismatch: expected ${NODE_LINUX_SHA256}, got ${actualHash}`);
  await extract(tarballBytes, destDir);
  const nodeBinPath = join(destDir, "bin", "node");
  try { chmodSync(nodeBinPath, 0o755); } catch { /* extraction may already set the mode */ }
  return { ok: true, nodeBinPath };
}
```

```javascript
// scripts/control-center/linux-bundle/stage-caddy.mjs
import { createHash } from "node:crypto";
import { chmodSync } from "node:fs";
import { join } from "node:path";

export const CADDY_VERSION = "2.11.4";
export const CADDY_LINUX_URL = `https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_amd64.tar.gz`;
export const CADDY_LINUX_SHA256 = "REPLACE_WITH_REAL_SHA256_FROM_CADDY_RELEASE_PAGE";

function defaultSha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function defaultFetch(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function defaultExtract(tarballBytes, targetDir) {
  const { spawnSync } = await import("node:child_process");
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const os = await import("node:os");
  mkdirSync(targetDir, { recursive: true });
  const tmpTar = join(os.tmpdir(), `caddy-runtime-${Date.now()}.tar.gz`);
  writeFileSync(tmpTar, tarballBytes);
  const result = spawnSync("tar", ["-xzf", tmpTar, "-C", targetDir]);
  if (result.status !== 0) throw new Error(`tar extraction failed: ${result.stderr}`);
}

export async function stageCaddyRuntime({ destDir, fetch = defaultFetch, extract = defaultExtract, sha256 = defaultSha256 } = {}) {
  if (typeof destDir !== "string" || !destDir.trim()) throw new Error("stageCaddyRuntime requires destDir.");
  const tarballBytes = await fetch(CADDY_LINUX_URL);
  const actualHash = sha256(tarballBytes);
  if (actualHash !== CADDY_LINUX_SHA256) throw new Error(`Caddy runtime checksum mismatch: expected ${CADDY_LINUX_SHA256}, got ${actualHash}`);
  await extract(tarballBytes, destDir);
  const caddyBinPath = join(destDir, "caddy");
  try { chmodSync(caddyBinPath, 0o755); } catch { /* extraction may already set the mode */ }
  return { ok: true, caddyBinPath };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/control-center/linux-bundle/stage-node.test.mjs scripts/control-center/linux-bundle/stage-caddy.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/control-center/linux-bundle/stage-node.mjs scripts/control-center/linux-bundle/stage-node.test.mjs scripts/control-center/linux-bundle/stage-caddy.mjs scripts/control-center/linux-bundle/stage-caddy.test.mjs
git commit -m "feat(linux-native): add portable Node.js and Caddy stagers"
```

- [ ] **Step 6: Resolve the real checksums (manual, one-time)**

Same pattern as Task 1 Step 6, against `NODE_LINUX_URL` and `CADDY_LINUX_URL`. Prefer copying the Node hash from the published `SHASUMS256.txt`.

---

### Task 3: Tests for `linux-host-effects.mjs` (currently zero coverage)

**Files:**
- Create: `scripts/control-center/linux-host-effects.test.mjs`

**Interfaces:**
- Consumes: `createLinuxHostEffects` from `scripts/control-center/linux-host-effects.mjs` (existing, unchanged).

- [ ] **Step 1: Write the failing test**

```javascript
// scripts/control-center/linux-host-effects.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLinuxHostEffects } from "./linux-host-effects.mjs";

const INSTALL_ROOT = "/opt/archive-suite";

function fakeRun() {
  const calls = [];
  const run = (args) => { calls.push(args); return { status: 0, stdout: "", stderr: "" }; };
  return { run, calls };
}

test("serviceControl.install writes the systemd unit and enables it", () => {
  const { run, calls } = fakeRun();
  const written = [];
  const writeFile = (path, content) => written.push({ path, content });
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, run, writeFile });

  const result = effects.serviceControl.install({ id: "archive-http", unit: "archive-http.service", description: "d", command: "/opt/archive-suite/runtime/caddy/caddy run" });

  assert.equal(result.status, 0);
  assert.equal(written[0].path, "/etc/systemd/system/archive-http.service");
  assert.deepEqual(calls[0], ["systemctl", "daemon-reload"]);
  assert.deepEqual(calls[1], ["systemctl", "enable", "archive-http"]);
});

test("serviceControl start/stop/restart/query call the right systemctl verb", () => {
  const { run, calls } = fakeRun();
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  effects.serviceControl.start("archive-next");
  effects.serviceControl.stop("archive-next");
  effects.serviceControl.restart("archive-next");
  effects.serviceControl.query("archive-next");
  assert.deepEqual(calls, [
    ["systemctl", "start", "archive-next"],
    ["systemctl", "stop", "archive-next"],
    ["systemctl", "restart", "archive-next"],
    ["systemctl", "status", "--no-pager", "archive-next"],
  ]);
});

test("serviceControl.remove disables, deletes the unit file, and reloads", () => {
  const { run, calls } = fakeRun();
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  effects.serviceControl.remove("archive-next");
  assert.deepEqual(calls, [
    ["systemctl", "disable", "archive-next"],
    ["rm", "-f", "/etc/systemd/system/archive-next.service"],
    ["systemctl", "daemon-reload"],
  ]);
});

test("applyOwnership chowns the install root to the service user", () => {
  const { run, calls } = fakeRun();
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  effects.applyOwnership();
  assert.deepEqual(calls[0], ["chown", "-R", "archive:archive", INSTALL_ROOT]);
});

test("applyLogrotate writes a weekly, 8-rotation policy for the install root's logs", () => {
  const written = [];
  const writeFile = (path, content) => written.push({ path, content });
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, run: () => ({ status: 0 }), writeFile });
  const result = effects.applyLogrotate();
  assert.equal(result.status, 0);
  assert.equal(written[0].path, "/etc/logrotate.d/archive-suite");
  assert.match(written[0].content, /weekly/);
  assert.match(written[0].content, /rotate 8/);
  assert.match(written[0].content, /su archive archive/);
});

test("logs reads journalctl for every service unit", () => {
  const { run, calls } = fakeRun();
  const services = [{ id: "archive-http" }, { id: "archive-next" }];
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {}, services });
  effects.logs();
  assert.deepEqual(calls[0], ["journalctl", "--no-pager", "-n", "200", "-u", "archive-http", "-u", "archive-next"]);
});

test("exec invokes the staged php binary with artisan and the given arguments", () => {
  const { run, calls } = fakeRun();
  const effects = createLinuxHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  effects.exec(["queue:work", "--once"]);
  assert.deepEqual(calls[0], [
    "/opt/archive-suite/runtime/php/bin/php",
    "/opt/archive-suite/app/laravel/artisan",
    "queue:work", "--once",
  ]);
});
```

- [ ] **Step 2: Run test**

Run: `node --test scripts/control-center/linux-host-effects.test.mjs`
Expected: since `linux-host-effects.mjs` already exists and should already be correct, this should PASS immediately. If any assertion fails, that is a real bug in the existing file -- fix `linux-host-effects.mjs` to match; never weaken the test to match a wrong command.

- [ ] **Step 3: Commit**

```bash
git add scripts/control-center/linux-host-effects.test.mjs
git commit -m "test(linux-native): cover the real systemctl/chown/logrotate/journalctl command construction"
```

---

### Task 4: systemd unit + install-user provisioning stager

**Files:**
- Create: `scripts/control-center/linux-bundle/stage-service-user.mjs`
- Create: `scripts/control-center/linux-bundle/stage-service-user.test.mjs`

**Interfaces:**
- Consumes: `LINUX_SERVICE_USER` from `scripts/control-center/linux-services.mjs` (existing).
- Produces: `ensureServiceUser({ run }): { ok, created }` -- creates the non-interactive `archive` system user/group if absent. Consumed by Task 9 (the dry run) before `serviceControl.install` runs, since `applyOwnership`/`serviceControl` assume the user already exists.

- [ ] **Step 1: Write the failing test**

```javascript
// scripts/control-center/linux-bundle/stage-service-user.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureServiceUser } from "./stage-service-user.mjs";
import { LINUX_SERVICE_USER } from "../linux-services.mjs";

test("ensureServiceUser creates the group and user when neither exists", () => {
  const calls = [];
  const run = (args) => {
    calls.push(args);
    if (args[0] === "getent") return { status: 2 }; // getent returns 2 when the entry is absent
    return { status: 0 };
  };

  const result = ensureServiceUser({ run });

  assert.equal(result.ok, true);
  assert.equal(result.created, true);
  assert.deepEqual(calls[0], ["getent", "passwd", LINUX_SERVICE_USER.name]);
  assert.deepEqual(calls[1], ["groupadd", "--system", LINUX_SERVICE_USER.name]);
  assert.deepEqual(calls[2], ["useradd", "--system", "--gid", LINUX_SERVICE_USER.name, "--home-dir", LINUX_SERVICE_USER.home, "--shell", LINUX_SERVICE_USER.shell, "--no-create-home", LINUX_SERVICE_USER.name]);
});

test("ensureServiceUser is a no-op when the user already exists", () => {
  const calls = [];
  const run = (args) => { calls.push(args); return { status: 0 }; }; // getent success (exists)

  const result = ensureServiceUser({ run });

  assert.equal(result.ok, true);
  assert.equal(result.created, false);
  assert.equal(calls.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/control-center/linux-bundle/stage-service-user.test.mjs`
Expected: FAIL -- module doesn't exist.

- [ ] **Step 3: Write minimal implementation**

```javascript
// scripts/control-center/linux-bundle/stage-service-user.mjs
// The non-interactive system account linux-host-effects.mjs's applyOwnership
// and serviceControl assume already exists (LINUX_SERVICE_USER). This module
// creates it idempotently -- getent's exit code (2 = "not found") is the
// standard POSIX way to check for an existing passwd/group entry.
import { spawnSync } from "node:child_process";
import { LINUX_SERVICE_USER } from "../linux-services.mjs";

function defaultRun(args) {
  const result = spawnSync(args[0], args.slice(1), { stdio: "pipe", encoding: "utf8" });
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

export function ensureServiceUser({ run = defaultRun, user = LINUX_SERVICE_USER } = {}) {
  const check = run(["getent", "passwd", user.name]);
  if (check.status === 0) return { ok: true, created: false };

  const groupResult = run(["groupadd", "--system", user.name]);
  if (groupResult.status !== 0) return { ok: false, created: false };

  const userResult = run(["useradd", "--system", "--gid", user.name, "--home-dir", user.home, "--shell", user.shell, "--no-create-home", user.name]);
  return { ok: userResult.status === 0, created: userResult.status === 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/control-center/linux-bundle/stage-service-user.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/control-center/linux-bundle/stage-service-user.mjs scripts/control-center/linux-bundle/stage-service-user.test.mjs
git commit -m "feat(linux-native): add idempotent service-user provisioning"
```

---

### Task 5: Bundle assembler

**Files:**
- Create: `scripts/control-center/linux-bundle/assemble.mjs`
- Create: `scripts/control-center/linux-bundle/assemble.test.mjs`
- Modify: `package.json` -- add `"bundle:linux-native": "node scripts/control-center/linux-bundle/assemble.mjs"`

**Interfaces:**
- Consumes: `stagePhpRuntime` (Task 1), `stageNodeRuntime`/`stageCaddyRuntime` (Task 2).
- Produces: `assembleLinuxBundle({ outDir, stagePhp, stageNode, stageCaddy, buildLaravel, buildNext }): Promise<{ ok, shasumsPath }>` -- consumed by Task 9.

- [ ] **Step 1: Write the failing test**

```javascript
// scripts/control-center/linux-bundle/assemble.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assembleLinuxBundle } from "./assemble.mjs";

test("assembleLinuxBundle lays out runtime/app/config and writes SHA256SUMS", async () => {
  const outDir = mkdtempSync(join(tmpdir(), "archive-linux-bundle-"));
  try {
    const stagePhp = async ({ destDir }) => { mkdirSync(join(destDir, "bin"), { recursive: true }); writeFileSync(join(destDir, "bin", "php"), "php"); return { ok: true }; };
    const stageNode = async ({ destDir }) => { mkdirSync(join(destDir, "bin"), { recursive: true }); writeFileSync(join(destDir, "bin", "node"), "node"); return { ok: true }; };
    const stageCaddy = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "caddy"), "caddy"); return { ok: true }; };
    const buildLaravel = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "artisan"), "#!/usr/bin/env php\n"); };
    const buildNext = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "server.js"), "// standalone server\n"); };

    const result = await assembleLinuxBundle({ outDir, stagePhp, stageNode, stageCaddy, buildLaravel, buildNext });

    assert.equal(result.ok, true);
    assert.ok(existsSync(join(outDir, "runtime", "php", "bin", "php")));
    assert.ok(existsSync(join(outDir, "runtime", "node", "bin", "node")));
    assert.ok(existsSync(join(outDir, "runtime", "caddy", "caddy")));
    assert.ok(existsSync(join(outDir, "app", "laravel", "artisan")));
    assert.ok(existsSync(join(outDir, "app", "next", "server.js")));
    assert.ok(existsSync(result.shasumsPath));
    const shasums = readFileSync(result.shasumsPath, "utf8");
    assert.match(shasums, /runtime\/php\/bin\/php/);
    assert.match(shasums, /^[0-9a-f]{64}  /m);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/control-center/linux-bundle/assemble.test.mjs`
Expected: FAIL -- module doesn't exist.

- [ ] **Step 3: Write minimal implementation**

```javascript
// scripts/control-center/linux-bundle/assemble.mjs
// Produces the exact directory layout linux-host-effects.mjs and
// linux-services.mjs already assume. Mirrors infra/offline/install.sh's
// SHA256SUMS pattern (sha256sum --check).
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { stagePhpRuntime } from "./stage-php.mjs";
import { stageNodeRuntime } from "./stage-node.mjs";
import { stageCaddyRuntime } from "./stage-caddy.mjs";

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(path));
    else out.push(path);
  }
  return out;
}

export async function assembleLinuxBundle({
  outDir,
  stagePhp = stagePhpRuntime,
  stageNode = stageNodeRuntime,
  stageCaddy = stageCaddyRuntime,
  buildLaravel,
  buildNext,
} = {}) {
  if (typeof outDir !== "string" || !outDir.trim()) throw new Error("assembleLinuxBundle requires outDir.");
  if (typeof buildLaravel !== "function" || typeof buildNext !== "function") throw new Error("assembleLinuxBundle requires buildLaravel and buildNext callbacks.");

  mkdirSync(outDir, { recursive: true });
  await stagePhp({ destDir: join(outDir, "runtime", "php") });
  await stageNode({ destDir: join(outDir, "runtime", "node") });
  await stageCaddy({ destDir: join(outDir, "runtime", "caddy") });
  await buildLaravel({ destDir: join(outDir, "app", "laravel") });
  await buildNext({ destDir: join(outDir, "app", "next") });
  mkdirSync(join(outDir, "config"), { recursive: true });
  mkdirSync(join(outDir, "storage"), { recursive: true });
  mkdirSync(join(outDir, "logs"), { recursive: true });

  const shasumsPath = join(outDir, "SHA256SUMS");
  const lines = listFilesRecursive(outDir)
    .filter((path) => path !== shasumsPath && statSync(path).isFile())
    .map((path) => `${createHash("sha256").update(readFileSync(path)).digest("hex")}  ${relative(outDir, path)}`)
    .sort();
  writeFileSync(shasumsPath, lines.join("\n") + "\n", "utf8");

  return { ok: true, shasumsPath };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/control-center/linux-bundle/assemble.test.mjs`
Expected: PASS.

- [ ] **Step 5: Wire the pnpm script**

Add to root `package.json` `scripts`: `"bundle:linux-native": "node scripts/control-center/linux-bundle/assemble.mjs",`

- [ ] **Step 6: Commit**

```bash
git add scripts/control-center/linux-bundle/assemble.mjs scripts/control-center/linux-bundle/assemble.test.mjs package.json
git commit -m "feat(linux-native): add bundle assembler producing the install-root layout"
```

---

### Task 6: External Postgres/Redis probes -- reuse, don't duplicate

**Files:**
- Modify: `scripts/control-center.mjs` (`nativeSetupInstallOrRepair`) -- pass `probes` for `linux-native` too.

**Interfaces:**
- Consumes: `createExternalOnlyProbes` from `scripts/control-center/native-probes.mjs`.

- [ ] **Step 1: Check whether `native-probes.mjs` already exists**

```bash
test -f scripts/control-center/native-probes.mjs && echo "exists -- Windows plan Task 6 already landed" || echo "missing -- build it now"
```

- [ ] **Step 2a: If it exists**, skip straight to wiring -- the `probes: createExternalOnlyProbes()` line in `buildNativeRuntime({...})` inside `nativeSetupInstallOrRepair` already applies to both platforms (the function has no platform-specific branching), so no Linux-specific code is needed here. Run `node --test scripts/control-center/native-probes.test.mjs` to confirm the existing tests still pass, then skip to Step 3.

- [ ] **Step 2b: If it does not exist**, build it exactly as specified in `docs/superpowers/plans/2026-08-06-windows-native-release.md` Task 6, Steps 1-6 (the module is platform-agnostic -- it operates on TCP host/port, nothing OS-specific) -- then continue here.

- [ ] **Step 3: Commit (only if Step 2b built something new; otherwise nothing to commit)**

```bash
git add scripts/control-center/native-probes.mjs scripts/control-center/native-probes.test.mjs scripts/control-center.mjs
git commit -m "feat(linux-native): wire external Postgres/Redis reachability probes"
```

---

### Task 7: Open the `MODE_UNSUPPORTED` gate for `linux-native`

**Files:**
- Modify: `scripts/control-center.mjs` (the two `MODE_UNSUPPORTED` returns).
- Modify: `scripts/control-center/native-setup.test.mjs`.

- [ ] **Step 1: Write the failing test**

```javascript
// Add to scripts/control-center/native-setup.test.mjs
test("setup install --mode=native --platform=linux-native no longer returns MODE_UNSUPPORTED", async () => {
  const result = await runSetupInstall({ mode: "native", platform: "linux-native" /* ...fakes matching this file's existing pattern... */ });
  assert.notEqual(result.code, "MODE_UNSUPPORTED");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/control-center/native-setup.test.mjs`
Expected: FAIL -- `result.code === "MODE_UNSUPPORTED"`.

- [ ] **Step 3: Extend the same guard the Windows plan's Task 7 already edited**

If the Windows plan's Task 7 already landed, the guard reads:

```javascript
if (configuration.mode !== "docker" && configuration.platform !== "windows-native") {
```

Extend it to also allow `linux-native`:

```javascript
if (configuration.mode !== "docker" && configuration.platform !== "windows-native" && configuration.platform !== "linux-native") {
  return renderSetupResult(setupConfiguration.errorResult("MODE_UNSUPPORTED", "Install and repair are currently available for Docker mode, windows-native, and linux-native only.", { mode: configuration.mode }));
}
```

If this Linux plan is executed **before** the Windows plan, the guard still reads the original `if (configuration.mode !== "docker")` -- change it to `if (configuration.mode !== "docker" && configuration.platform !== "linux-native")` instead, and leave a comment noting the Windows plan's Task 7 will extend it further. Apply the same edit to the second gate.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/control-center/native-setup.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run the full control-center suite**

Run: `node --test scripts/control-center/*.test.mjs`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/control-center.mjs scripts/control-center/native-setup.test.mjs
git commit -m "feat(linux-native): open the install/repair gate for linux-native"
```

---

### Task 8: Update the platform contract's stated requirements (status stays `"planned"`)

**Files:**
- Modify: `infra/platform/compatibility.v1.json` -- the `linux-native` entry.

- [ ] **Step 1: Extend `requirements`**

```json
"requirements": {
  "node": ">=26.5.0 <27",
  "docker": "not required for the planned native path",
  "php": "8.5.8 (bundled, static-php-cli, portable -- see docs/superpowers/plans/2026-08-06-linux-native-release.md)",
  "systemd": "required (service management)",
  "postgres": "external endpoint only; local-managed is not bundled",
  "redis": "external endpoint only; local-managed is not bundled"
}
```

Keep `"status": "planned"` -- flipping it needs Task 10's real evidence.

- [ ] **Step 2: Run the contract's own tests**

Run: `node --test scripts/control-center/*.test.mjs`
Expected: PASS. Update any test asserting an exact `requirements` shape rather than deleting it.

- [ ] **Step 3: Commit**

```bash
git add infra/platform/compatibility.v1.json
git commit -m "docs(linux-native): record the bundled PHP/Node/Caddy pins and external-data-only scope"
```

---

### Task 9: Real end-to-end dry run on this development machine

Not clean-host evidence -- proves the bundle boots. (Requires a Linux environment -- run this inside WSL2 or a Linux CI runner if the primary dev machine is Windows.)

- [ ] **Step 1: Write a thin CLI wrapper with real build callbacks**

Create `scripts/control-center/linux-bundle/cli.mjs`, TDD'd the same way as every prior task, calling real `composer install --no-dev --working-dir=archive-laravel` and `pnpm --filter @archive/next build` as `buildLaravel`/`buildNext`.

- [ ] **Step 2: Produce a real bundle**

```bash
pnpm run bundle:linux-native -- --out /tmp/linux-native-bundle-test
```

- [ ] **Step 3: Manually verify SHA256SUMS**

```bash
cd /tmp/linux-native-bundle-test
sha256sum --check SHA256SUMS
```

- [ ] **Step 4: Provision the service user, point at a real Postgres/Redis, and attempt install**

```bash
sudo node scripts/control-center/linux-bundle/stage-service-user.mjs
export ARCHIVE_NATIVE_INSTALL_ROOT=/opt/archive-suite
sudo node scripts/control-center.mjs setup install --mode=native --platform=linux-native --yes
```

Expected: units register (`systemctl status archive-*`), `archive-http` responds with the app's normal login page. This machine is **not** a clean host -- a pass here is not V1-211D-native acceptance evidence.

- [ ] **Step 5: Uninstall cleanly and confirm no residue**

```bash
sudo node scripts/control-center.mjs setup uninstall --mode=native --platform=linux-native --yes
systemctl status archive-* 2>&1 | grep -i "could not be found" || echo "residue detected -- investigate before Task 10"
```

---

### Task 10 (external, non-code): Clean-host acceptance and the platform-contract flip

Cannot be executed on a desk machine with the dev toolchain installed -- requires exactly what `docs/ops/acceptance-clean-host-blockers.md` already documents as blocked.

- [ ] Provision a clean Ubuntu 22.04 LTS VM and a clean Ubuntu 24.04 LTS VM/host (no dev toolchain, no prior install) -- see Global Constraints for why these two.
- [ ] Copy the Task 9 bundle over via a normal file transfer (not a dev-tooling mount).
- [ ] Run install, verify reachability, run update-in-place, run rollback, run uninstall -- same scenario matrix `docs/evidence/v1-210d/README.md` used for `windows-10-11-docker`, adapted to `linux-native`.
- [ ] Record a manifest matching the shape of `docs/evidence/v1-210d/final-manifest.json`, saved to `docs/evidence/v1-211d-native/`.
- [ ] Only then flip `infra/platform/compatibility.v1.json`'s `linux-native.status` from `"planned"` to `"supported"` -- the existing V1-212C evidence check in `scripts/verify-release-readiness.mjs` will fail the release gate without a matching evidence file.
- [ ] Update `TASKS.md`: close the corresponding V1 item with a link to the new evidence directory.
