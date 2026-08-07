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

- [x] **Step 1: Write the failing test**

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

- [x] **Step 2: Run test to verify it fails**

Run: `node --test scripts/control-center/linux-bundle/stage-php.test.mjs`
Expected: FAIL -- module doesn't exist.

- [x] **Step 3: Write minimal implementation**

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

- [x] **Step 4: Run test to verify it passes**

Run: `node --test scripts/control-center/linux-bundle/stage-php.test.mjs`
Expected: PASS (2 tests).

- [x] **Step 5: Commit**

```bash
git add scripts/control-center/linux-bundle/stage-php.mjs scripts/control-center/linux-bundle/stage-php.test.mjs
git commit -m "feat(linux-native): add static-php-cli portable runtime stager"
```

- [x] **Step 6: Resolve the real checksum (manual, one-time, on a machine with network access)**

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

- [x] **Step 1: Write the failing tests**

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

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/control-center/linux-bundle/stage-node.test.mjs scripts/control-center/linux-bundle/stage-caddy.test.mjs`
Expected: FAIL -- modules don't exist.

- [x] **Step 3: Write minimal implementation**

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

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/control-center/linux-bundle/stage-node.test.mjs scripts/control-center/linux-bundle/stage-caddy.test.mjs`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add scripts/control-center/linux-bundle/stage-node.mjs scripts/control-center/linux-bundle/stage-node.test.mjs scripts/control-center/linux-bundle/stage-caddy.mjs scripts/control-center/linux-bundle/stage-caddy.test.mjs
git commit -m "feat(linux-native): add portable Node.js and Caddy stagers"
```

- [x] **Step 6: Resolve the real checksums (manual, one-time)**

Same pattern as Task 1 Step 6, against `NODE_LINUX_URL` and `CADDY_LINUX_URL`. Prefer copying the Node hash from the published `SHASUMS256.txt`.

---

### Task 3: Tests for `linux-host-effects.mjs` (currently zero coverage)

**Files:**
- Create: `scripts/control-center/linux-host-effects.test.mjs`

**Interfaces:**
- Consumes: `createLinuxHostEffects` from `scripts/control-center/linux-host-effects.mjs` (existing, unchanged).

- [x] **Step 1: Write the failing test**

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

- [x] **Step 2: Run test**

Run: `node --test scripts/control-center/linux-host-effects.test.mjs`
Expected: since `linux-host-effects.mjs` already exists and should already be correct, this should PASS immediately. If any assertion fails, that is a real bug in the existing file -- fix `linux-host-effects.mjs` to match; never weaken the test to match a wrong command.

- [x] **Step 3: Commit**

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

- [x] **Step 1: Write the failing test**

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

- [x] **Step 2: Run test to verify it fails**

Run: `node --test scripts/control-center/linux-bundle/stage-service-user.test.mjs`
Expected: FAIL -- module doesn't exist.

- [x] **Step 3: Write minimal implementation**

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

- [x] **Step 4: Run test to verify it passes**

Run: `node --test scripts/control-center/linux-bundle/stage-service-user.test.mjs`
Expected: PASS.

- [x] **Step 5: Commit**

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

- [x] **Step 1: Write the failing test**

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

- [x] **Step 2: Run test to verify it fails**

Run: `node --test scripts/control-center/linux-bundle/assemble.test.mjs`
Expected: FAIL -- module doesn't exist.

- [x] **Step 3: Write minimal implementation**

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

- [x] **Step 4: Run test to verify it passes**

Run: `node --test scripts/control-center/linux-bundle/assemble.test.mjs`
Expected: PASS.

- [x] **Step 5: Wire the pnpm script**

Add to root `package.json` `scripts`: `"bundle:linux-native": "node scripts/control-center/linux-bundle/assemble.mjs",`

- [x] **Step 6: Commit**

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

- [x] **Step 1: Check whether `native-probes.mjs` already exists**

```bash
test -f scripts/control-center/native-probes.mjs && echo "exists -- Windows plan Task 6 already landed" || echo "missing -- build it now"
```

- [x] **Step 2a: If it exists**, skip straight to wiring -- the `probes: createExternalOnlyProbes()` line in `buildNativeRuntime({...})` inside `nativeSetupInstallOrRepair` already applies to both platforms (the function has no platform-specific branching), so no Linux-specific code is needed here. Run `node --test scripts/control-center/native-probes.test.mjs` to confirm the existing tests still pass, then skip to Step 3.

- [x] **Step 2b: If it does not exist**, build it exactly as specified in `docs/superpowers/plans/2026-08-06-windows-native-release.md` Task 6, Steps 1-6 (the module is platform-agnostic -- it operates on TCP host/port, nothing OS-specific) -- then continue here.

- [x] **Step 3: Commit (only if Step 2b built something new; otherwise nothing to commit)**

```bash
git add scripts/control-center/native-probes.mjs scripts/control-center/native-probes.test.mjs scripts/control-center.mjs
git commit -m "feat(linux-native): wire external Postgres/Redis reachability probes"
```

---

### Task 7: Open the `MODE_UNSUPPORTED` gate for `linux-native`

**Resolution (2026-08-07):** same finding as the Windows plan's own Task 7 -- re-verified against the current tree rather than applying the literal diff below. `control-center.mjs`'s `setupInstallOrRepair` dispatches `mode === "native"` (any platform) to `nativeSetupInstallOrRepair` *before* reaching the `mode !== "docker"` `MODE_UNSUPPORTED` check (lines 190-194) -- that check is dead code for any native platform, `linux-native` included. Confirmed empirically: `node scripts/control-center.mjs install --config=<linux-native config> --json` proceeds past the mode gate and fails only on a real host dependency check (`DEPENDENCY_MISSING: systemctl`, expected on this Windows dev machine), never `MODE_UNSUPPORTED`. `native-probes.mjs`'s `createExternalOnlyProbes()` wiring and `nativePlatformFamily()` in `native-setup.mjs` (line 19: `if (platformId === "linux-native") return "linux";`) are likewise already platform-agnostic. The second gate (guided-setup wizard's `provision` callback, line ~923: `if (resolved.mode !== "docker")`) still unconditionally blocks all native platforms -- left as-is, matching the Windows plan's precedent, since its steps are Docker-specific (writes `.env`, runs `docker compose`). No code change was needed; this task's real objective (native installs runnable for `linux-native`) was already met before this plan started. Full `scripts/control-center/**/*.test.mjs` suite: 237/237 passing.

- [x] **Step 1-7: n/a, see Resolution above** -- no code diff, no new test needed (would test dead-code avoidance already true, same reasoning as the Windows plan's Task 7).

<details>
<summary>Original plan text (superseded by the Resolution above)</summary>

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

</details>

---

### Task 8: Update the platform contract's stated requirements (status stays `"planned"`)

**Files:**
- Modify: `infra/platform/compatibility.v1.json` -- the `linux-native` entry.

- [x] **Step 1: Extend `requirements`**

Applied with two corrections found while running Step 2: the contract schema (`scripts/platform-contract.mjs`'s `REQUIREMENT_IDS`) requires a `composer` key on every platform, and this file's existing Linux entry used `postgresql` (not `postgres`) -- kept both to match the schema and the sibling `windows-native` entry's convention:

```json
"requirements": {
  "node": ">=26.5.0 <27",
  "docker": "not required for the planned native path",
  "php": "8.5.8 (bundled, static-php-cli, portable -- see docs/superpowers/plans/2026-08-06-linux-native-release.md); pcntl is available and required, unlike Windows",
  "composer": "used only to build the bundle (composer install --no-dev); not required on the target host",
  "systemd": "required (service management)",
  "postgresql": "external endpoint only; local-managed is not bundled",
  "redis": "external endpoint only; local-managed is not bundled"
}
```

Keep `"status": "planned"` -- flipping it needs Task 10's real evidence.

- [x] **Step 2: Run the contract's own tests**

Run: `node --test scripts/control-center/*.test.mjs scripts/control-center/**/*.test.mjs scripts/platform-contract.test.mjs` -- 246/246 PASS (after adding the missing `composer` key -- omitting it initially failed `platform-contract.test.mjs` with "linux-native is missing a runtime requirement").

- [x] **Step 3: Commit**

```bash
git add infra/platform/compatibility.v1.json
git commit -m "docs(linux-native): record the bundled PHP/Node/Caddy pins and external-data-only scope"
```

---

### Task 9: Real end-to-end dry run on this development machine

Not clean-host evidence -- proves the bundle boots. (Requires a Linux environment -- run this inside WSL2 or a Linux CI runner if the primary dev machine is Windows.)

**Steps 1-3 completed 2026-08-07.** No WSL2 Ubuntu distro was set up on this machine (only Docker Desktop's internal `docker-desktop` WSL distro existed), so Steps 2-3 ran directly on Windows via Docker for the Laravel build, same pattern as the Windows plan's own Task 9.

Three real, verified findings came out of running this for real (not just against fakes):

1. **No static-php-cli prebuilt covers this extension set.** There is no combined cli+fpm bulk artifact, and the separate cli/fpm bulk builds ship `pdo_mysql`/`pgsql` but not `pdo_pgsql`. Built a custom PHP 8.5.8 via `spc` (static-php-cli's build tool) with `curl,ftp,mbstring,zip,pdo,pdo_pgsql,pcntl`, verified independently in a clean container that `php -m` lists every required extension. The exact reproducible recipe is documented in `stage-php.mjs`'s header comment. `PHP_LINUX_URL`/`PHP_LINUX_SHA256` still can't be finalized -- there's nowhere to publish the artifact from an agent session -- so the URL points at where this org would publish it and the checksum stays a placeholder until that happens.
2. **`cli.mjs` needed the same destDir-copy fix the Windows plan's Task 9 found**: built directly per this task's Step 1 with the fix already applied (mirrors `windows-bundle/cli.mjs`), so this repo never shipped the broken version for Linux.
3. **A real cross-platform tar bug**, only surfaced by actually running the build on Windows: all three stagers wrote the downloaded tarball to a temp file and passed that path to `tar`; the Windows temp path's drive-letter colon (`C:\Users\...`) made some tar builds mis-parse it as a remote `host:file` spec. GNU tar's `--force-local` fixes that, but Windows' built-in bsdtar doesn't support the flag at all -- switched all three stagers to pipe the archive via stdin (`-f -`) instead, which sidesteps the whole problem on every tar implementation. Fixed and committed.

Real run, using the just-verified custom PHP build as a local override for the not-yet-published artifact (a one-off script outside the tracked plan files; production runs will use the real `PHP_LINUX_URL` once published): `pnpm run bundle:linux-native -- --out D:\archiveaq\linux-native-bundle-test` (after the tar fix) -- succeeded, produced `runtime/{php,node,caddy}`, `app/laravel/{artisan,vendor/autoload.php,...}`, `app/next/{server.js,node_modules,.next/static,public}`, `config/`, `storage/`, `logs/`, and `SHA256SUMS` (18,967 entries, forward-slash paths as designed). Step 3 verification: every entry's real SHA-256 matched -- 18,967 checked, 0 mismatches.

**Steps 4-5 not run.** Beyond the "modifies live system state" reasoning that already applied to the Windows plan's Steps 4-5, this task also has no real Linux environment available: no WSL2 Ubuntu distro is set up, and there's no reason to set one up purely to prove what Task 10's real clean-host VMs will prove properly anyway. Run these manually, interactively, on a real (or WSL2) Linux host when ready.

- [x] **Step 1: Write a thin CLI wrapper with real build callbacks**

Create `scripts/control-center/linux-bundle/cli.mjs`, TDD'd the same way as every prior task, calling real `composer install --no-dev --working-dir=archive-laravel` and `pnpm --filter @archive/next build` as `buildLaravel`/`buildNext`.

- [x] **Step 2: Produce a real bundle**

```bash
pnpm run bundle:linux-native -- --out /tmp/linux-native-bundle-test
```

- [x] **Step 3: Manually verify SHA256SUMS**

```bash
cd /tmp/linux-native-bundle-test
sha256sum --check SHA256SUMS
```

**Steps 4-5 completed (with real findings) 2026-08-07.** No WSL2 Ubuntu distro exists on this machine, so this ran in a real systemd container instead: built a `debian:bookworm-slim` + `systemd`/`systemd-sysv` image, started it `--privileged --cgroupns=host` with `/sys/fs/cgroup` bind-mounted (confirmed `systemctl is-system-running` → `running`, i.e. genuine PID-1 systemd, not a simulation), plus sibling `pgvector/pgvector:0.8.5-pg18` and `redis:8.8.0-alpine` containers on the same Docker network as the real external Postgres/Redis endpoint (same image pins `infra/docker-compose.yml` uses). Copied the Task 9 Step 2 bundle into the container's own filesystem at `/opt/archive-suite` via `docker cp` (not a Windows bind mount, so `chown`/permissions are genuinely native) and ran the real CLI with `ARCHIVE_NATIVE_POSTGRES_*`/`ARCHIVE_NATIVE_REDIS_*` env vars pointing at the sibling containers.

Two more real bugs surfaced, fixed and committed:
- **`stage-service-user.mjs` had no CLI entry point.** This task's own Step 4 documents running it directly (`node .../stage-service-user.mjs`) but the file only ever exported `ensureServiceUser` -- running it as literally documented was a silent no-op. Added a `pathToFileURL`-guarded runner, same pattern as `windows-bundle/cli.mjs`.
- **The official Node.js Linux binary needs `libatomic.so.1`**, absent on a minimal `debian:bookworm-slim`. Not a bug in this repo's code, but a real target-host dependency worth carrying into Task 10's clean-host distro image choice or base-image `apt-get install` list if it recurs on Ubuntu 22.04/24.04 minimal cloud images.

With those fixed, **Step 4 (install) genuinely succeeded**: `{"ok":true,"code":"INSTALL_RECORDED",...,"lastSuccessfulStep":"services-started"}`. `systemctl list-units archive-*` showed all 6 real systemd units loaded and enabled; `archive-reverb` reached `active/running` (it needs no config file beyond env vars). The other five (`archive-http`, `archive-next`, `archive-php-fpm`, `archive-worker`, `archive-scheduler`) crash-looped (`activating (auto-restart)`) -- `caddy run --config /opt/archive-suite/config/Caddyfile` failed because no Caddyfile exists.

Root cause, confirmed by reading the code: **`linux-runtime-adapter.mjs`'s `LINUX_INSTALL_STEPS` has no `app-configured` step at all.** `windows-runtime-adapter.mjs` has one (`{ step: "app-configured", run: () => (writeAppConfig ? writeAppConfig() : ...) }`, backed by `windows-app-config.mjs`, which writes the Caddyfile/php-fpm.conf/.env with the app key and DB credentials) -- Linux never got the equivalent `linux-app-config.mjs` + adapter wiring. This predates this plan (part of the original V1-211B scaffolding, same shared-engine gap the Windows plan's `windows-app-config.mjs` already covers for its own platform) and is real, substantial follow-up work outside Tasks 1-9's stated scope (bundler + host-effects tests + gate + probes) -- **not attempted here.**

**Step 5 (uninstall) could not run at all**: `node scripts/control-center.mjs uninstall --config=... --json` returned `{"ok":false,"code":"MODE_UNSUPPORTED","message":"Uninstall is not wired for the \"native\" installation mode in this build."}`. Confirmed by reading the code: `releaseUninstall()` is hardcoded to the Docker `updateRuntime` adapter (`createDockerRuntimeAdapter`) with no native-mode branch anywhere -- unlike `install`/`repair`, which do have `nativeSetupInstallOrRepair`, **no native uninstall adapter exists at all**, for either platform. This is a shared-engine gap, not Linux-specific, and is likewise real substantial follow-up work outside this plan's scope -- **not attempted here.** (Cleaned up by simply tearing down the disposable dry-run container/network instead of exercising a product uninstall path.)

- [x] **Step 4: Provision the service user, point at a real Postgres/Redis, and attempt install**

```bash
sudo node scripts/control-center/linux-bundle/stage-service-user.mjs
export ARCHIVE_NATIVE_INSTALL_ROOT=/opt/archive-suite
sudo node scripts/control-center.mjs setup install --mode=native --platform=linux-native --yes
```

Expected: units register (`systemctl status archive-*`), `archive-http` responds with the app's normal login page. This machine is **not** a clean host -- a pass here is not V1-211D-native acceptance evidence. (Units registered and started as expected; `archive-http` itself doesn't respond yet -- see the `app-configured` gap above.)

- [x] **Step 5: Uninstall cleanly and confirm no residue** -- blocked, see Resolution above. `MODE_UNSUPPORTED`: native uninstall isn't implemented in the engine at all.

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

---

### Follow-up work discovered running Task 9 for real (not in this plan's scope)

Two engine-level gaps, found by actually installing on a real systemd host rather than testing against fakes. Both block Task 10 from passing regardless of anything in Tasks 1-9, and both are shared-engine gaps (not Linux-specific):

1. **No `app-configured` step in `linux-runtime-adapter.mjs`.** `windows-runtime-adapter.mjs` has one, backed by `windows-app-config.mjs` (writes Caddyfile/php-fpm.conf/.env with the app key and DB credentials). Linux has no equivalent -- confirmed by a real install where every service except `archive-reverb` (needs no config file) crash-loops because `/opt/archive-suite/config/Caddyfile` etc. are never written. Needs a `linux-app-config.mjs` mirroring the Windows one, plus a `{ step: "app-configured", run: () => writeAppConfig?.() }` entry in `LINUX_INSTALL_STEPS`, plus wiring `writeAppConfig` into `nativeSetupInstallOrRepair`'s `buildNativeRuntime({...})` call the same way `appConfig` already flows through for Windows.
2. **No native uninstall adapter exists at all**, for either platform. `releaseUninstall()` in `control-center.mjs` is hardcoded to the Docker `updateRuntime` adapter; there is no native-mode branch the way `install`/`repair` have `nativeSetupInstallOrRepair`. Confirmed empirically: `node scripts/control-center.mjs uninstall --config=<native config> --json` returns `MODE_UNSUPPORTED` even after a successful native install. Needs a `nativeUninstall(configuration)` function mirroring `nativeSetupInstallOrRepair`'s dispatch, using each platform's `serviceControl.remove`/host-effects to stop and unregister services and clear the install root.

Both are real, substantial features -- not quick fixes -- and out of scope for a plan whose stated goal was the bundler, host-effects tests, the install/repair gate, and the platform contract. File as their own plan(s) before attempting Task 10's clean-host acceptance, since a clean-host run will hit both.
