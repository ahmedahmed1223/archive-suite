# Windows Native Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an installable, Docker-free Windows package for Archive Suite (Caddy + Next.js + Laravel PHP-FPM/worker/reverb/scheduler) that installs as real Windows services, so `windows-native` can move from `"status": "planned"` to `"status": "supported"` in `infra/platform/compatibility.v1.json`.

**Architecture:** The runtime adapter, host-effects layer (real `icacls`/`netsh`/WinSW commands), and service definitions already exist and are partially tested (`scripts/control-center/windows-runtime-adapter.mjs`, `windows-host-effects.mjs`, `windows-services.mjs`). What is missing is (1) a bundler that stages portable PHP/Node/Caddy runtimes plus the built app into the exact directory layout those files already assume, (2) tests for the host-effects command construction itself (currently only the adapter is tested, against injected fakes — the real `icacls`/`netsh` argument lists have zero test coverage), (3) wiring the CLI's `MODE_UNSUPPORTED` gate open once 1-2 are proven, and (4) real clean-Windows-host acceptance evidence, which is an external, non-code phase.

**Tech Stack:** Node.js 26.x (bundler + runtime), PHP 8.5.8 NTS (portable, from windows.php.net — matches `archive-laravel/Dockerfile.worker`'s `php:8.5.8-fpm` pin), WinSW (service wrapper, already assumed by `windows-host-effects.mjs`), Caddy (reverse proxy/TLS, already a defined service).

## Global Constraints

- Node version floor: `>=26.5.0 <27` (`package.json` engines + devDependencies) — pin the bundled runtime to exactly `26.5.0` to match CI.
- PHP version: `8.5.8`, matching `archive-laravel/Dockerfile.worker` line 20 (`FROM php:8.5.8-fpm@sha256:0dc450...`).
- PHP extensions required: `curl, ftp, mbstring, zip, pdo, pdo_pgsql` (from `Dockerfile.worker` line 42). **`pcntl` is excluded on Windows** — it has no Windows build. Laravel's `queue:work`/`schedule:work` already guard `pcntl` calls behind `extension_loaded('pcntl')`, so this is a graceful, already-handled platform difference (no `archive-laravel` code change needed) — but state it explicitly wherever Windows-native is documented as supported.
- Install root: `C:\Program Files\ArchiveSuite` (`scripts/control-center/native-setup.mjs` `DEFAULT_INSTALL_ROOT.windows` — do not change it).
- Services (already defined in `scripts/control-center/windows-services.mjs`, do not rename): `archive-http` (Caddy), `archive-next` (Node), `archive-php-fcgi` (PHP-FPM via `php-cgi.exe`), `archive-worker`, `archive-reverb`, `archive-scheduler`.
- Data plan: **this plan scopes native Windows to an external PostgreSQL/Redis endpoint only.** `scripts/control-center/native-data-services.mjs` defaults `dataPlanOverride` toward `{ postgres: { kind: "local-managed" } }` but has zero real implementation for that path. Bundling a managed local Postgres/Redis is real, separate scope — file it as a follow-up plan, do not attempt it here.
- Checksums: every downloaded/staged runtime component must be SHA-256 pinned in source, following the pattern `infra/offline/install.ps1` already uses (`SHA256SUMS`, `Get-FileHash -Algorithm SHA256`).

---

### Task 1: Portable PHP runtime stager

**Files:**
- Create: `scripts/control-center/windows-bundle/stage-php.mjs`
- Create: `scripts/control-center/windows-bundle/stage-php.test.mjs`

**Interfaces:**
- Produces: `stagePhpRuntime({ destDir, fetch, extract, sha256 }): Promise<{ ok, phpExePath, extensionsEnabled }>` — consumed by Task 5.

- [x] **Step 1: Write the failing test**

```javascript
// scripts/control-center/windows-bundle/stage-php.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stagePhpRuntime, PHP_WINDOWS_SHA256, PHP_WINDOWS_URL } from "./stage-php.mjs";

test("stagePhpRuntime downloads the pinned zip, verifies checksum, extracts, enables extensions", async () => {
  const destDir = mkdtempSync(join(tmpdir(), "archive-php-stage-"));
  try {
    const fetchCalls = [];
    const fetch = async (url) => { fetchCalls.push(url); return Buffer.from("fake-php-zip"); };
    const extract = async (_bytes, targetDir) => {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(join(targetDir, "php.exe"), "");
    };

    const result = await stagePhpRuntime({ destDir, fetch, extract, sha256: () => PHP_WINDOWS_SHA256 });

    assert.equal(result.ok, true);
    assert.equal(fetchCalls[0], PHP_WINDOWS_URL);
    assert.ok(existsSync(result.phpExePath));

    const ini = readFileSync(join(destDir, "php.ini"), "utf8");
    for (const ext of ["curl", "ftp", "mbstring", "zip", "pdo", "pdo_pgsql"]) {
      assert.ok(ini.includes(`extension=${ext}`), `must enable extension=${ext}`);
    }
    assert.ok(!ini.includes("extension=pcntl"), "pcntl has no Windows build");
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

Run: `node --test scripts/control-center/windows-bundle/stage-php.test.mjs`
Expected: FAIL — module doesn't exist.

- [x] **Step 3: Write minimal implementation**

```javascript
// scripts/control-center/windows-bundle/stage-php.mjs
// Stages a portable, non-thread-safe PHP 8.5.8 runtime for the Windows
// native bundle. Pinned to the same PHP version archive-laravel's
// Dockerfile.worker uses so behavior matches the Docker-mode image.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const PHP_VERSION = "8.5.8";
export const PHP_WINDOWS_URL = `https://windows.php.net/downloads/releases/php-${PHP_VERSION}-nts-Win32-vs17-x64.zip`;
// REPLACE with the real hash before use against the real network (Task 1 Step 6).
export const PHP_WINDOWS_SHA256 = "REPLACE_WITH_REAL_SHA256_FROM_WINDOWS_PHP_NET";

const REQUIRED_EXTENSIONS = ["curl", "ftp", "mbstring", "zip", "pdo", "pdo_pgsql"];

function defaultSha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function defaultFetch(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function defaultExtract(zipBytes, targetDir) {
  const { spawnSync } = await import("node:child_process");
  const { writeFileSync: wf, mkdirSync: mk } = await import("node:fs");
  const os = await import("node:os");
  mk(targetDir, { recursive: true });
  const tmpZip = join(os.tmpdir(), `php-runtime-${Date.now()}.zip`);
  wf(tmpZip, zipBytes);
  const result = spawnSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -Path '${tmpZip}' -DestinationPath '${targetDir}' -Force`]);
  if (result.status !== 0) throw new Error(`Expand-Archive failed: ${result.stderr}`);
}

export async function stagePhpRuntime({ destDir, fetch = defaultFetch, extract = defaultExtract, sha256 = defaultSha256 } = {}) {
  if (typeof destDir !== "string" || !destDir.trim()) throw new Error("stagePhpRuntime requires destDir.");
  const zipBytes = await fetch(PHP_WINDOWS_URL);
  const actualHash = sha256(zipBytes);
  if (actualHash !== PHP_WINDOWS_SHA256) throw new Error(`PHP runtime checksum mismatch: expected ${PHP_WINDOWS_SHA256}, got ${actualHash}`);
  await extract(zipBytes, destDir);
  const iniLines = [
    "; Generated by scripts/control-center/windows-bundle/stage-php.mjs -- do not edit by hand.",
    "extension_dir = \"ext\"",
    ...REQUIRED_EXTENSIONS.map((ext) => `extension=${ext}`),
  ];
  mkdirSync(destDir, { recursive: true });
  writeFileSync(join(destDir, "php.ini"), iniLines.join("\n") + "\n", "utf8");
  return { ok: true, phpExePath: join(destDir, "php.exe"), extensionsEnabled: REQUIRED_EXTENSIONS };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test scripts/control-center/windows-bundle/stage-php.test.mjs`
Expected: PASS (2 tests).

- [x] **Step 5: Commit**

```bash
git add scripts/control-center/windows-bundle/stage-php.mjs scripts/control-center/windows-bundle/stage-php.test.mjs
git commit -m "feat(windows-native): add portable PHP runtime stager"
```

- [x] **Step 6: Resolve the real checksum (manual, one-time, on a machine with network access)**

```powershell
Invoke-WebRequest -Uri "https://windows.php.net/downloads/releases/php-8.5.8-nts-Win32-vs17-x64.zip" -OutFile php.zip
(Get-FileHash -Algorithm SHA256 -LiteralPath php.zip).Hash.ToLowerInvariant()
```

Replace `PHP_WINDOWS_SHA256` with the printed hash. If no `vs17` NTS build exists for `8.5.8` at execution time, use the latest available `8.5.x` NTS `x64` build and update `PHP_VERSION`/`PHP_WINDOWS_URL` together — never silently downgrade only the URL.

---

### Task 2: Portable Node.js and Caddy stagers

**Files:**
- Create: `scripts/control-center/windows-bundle/stage-node.mjs`
- Create: `scripts/control-center/windows-bundle/stage-node.test.mjs`
- Create: `scripts/control-center/windows-bundle/stage-caddy.mjs`
- Create: `scripts/control-center/windows-bundle/stage-caddy.test.mjs`

**Interfaces:**
- Produces: `stageNodeRuntime({ destDir, fetch, extract, sha256 }): Promise<{ ok, nodeExePath }>`
- Produces: `stageCaddyRuntime({ destDir, fetch, extract, sha256 }): Promise<{ ok, caddyExePath }>`
- Both consumed by Task 5.

- [x] **Step 1: Write the failing tests**

```javascript
// scripts/control-center/windows-bundle/stage-node.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageNodeRuntime, NODE_VERSION, NODE_WINDOWS_SHA256, NODE_WINDOWS_URL } from "./stage-node.mjs";

test("stageNodeRuntime downloads the pinned zip, verifies checksum, extracts node.exe", async () => {
  const destDir = mkdtempSync(join(tmpdir(), "archive-node-stage-"));
  try {
    const fetchCalls = [];
    const fetch = async (url) => { fetchCalls.push(url); return Buffer.from("fake-node-zip"); };
    const extract = async (_bytes, targetDir) => {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(join(targetDir, "node.exe"), "");
    };
    const result = await stageNodeRuntime({ destDir, fetch, extract, sha256: () => NODE_WINDOWS_SHA256 });
    assert.equal(result.ok, true);
    assert.equal(fetchCalls[0], NODE_WINDOWS_URL);
    assert.ok(existsSync(result.nodeExePath));
    assert.match(NODE_WINDOWS_URL, new RegExp(NODE_VERSION.replace(/\./g, "\\.")));
  } finally {
    rmSync(destDir, { recursive: true, force: true });
  }
});
```

```javascript
// scripts/control-center/windows-bundle/stage-caddy.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageCaddyRuntime, CADDY_WINDOWS_SHA256, CADDY_WINDOWS_URL } from "./stage-caddy.mjs";

test("stageCaddyRuntime downloads the pinned zip, verifies checksum, extracts caddy.exe", async () => {
  const destDir = mkdtempSync(join(tmpdir(), "archive-caddy-stage-"));
  try {
    const fetchCalls = [];
    const fetch = async (url) => { fetchCalls.push(url); return Buffer.from("fake-caddy-zip"); };
    const extract = async (_bytes, targetDir) => {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(join(targetDir, "caddy.exe"), "");
    };
    const result = await stageCaddyRuntime({ destDir, fetch, extract, sha256: () => CADDY_WINDOWS_SHA256 });
    assert.equal(result.ok, true);
    assert.equal(fetchCalls[0], CADDY_WINDOWS_URL);
    assert.ok(existsSync(result.caddyExePath));
  } finally {
    rmSync(destDir, { recursive: true, force: true });
  }
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/control-center/windows-bundle/stage-node.test.mjs scripts/control-center/windows-bundle/stage-caddy.test.mjs`
Expected: FAIL — modules don't exist.

- [x] **Step 3: Write minimal implementation**

```javascript
// scripts/control-center/windows-bundle/stage-node.mjs
import { createHash } from "node:crypto";
import { join } from "node:path";

export const NODE_VERSION = "26.5.0";
export const NODE_WINDOWS_URL = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`;
export const NODE_WINDOWS_SHA256 = "REPLACE_WITH_REAL_SHA256_FROM_NODEJS_ORG_SHASUMS256";

function defaultSha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function defaultFetch(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function defaultExtract(zipBytes, targetDir) {
  const { spawnSync } = await import("node:child_process");
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const os = await import("node:os");
  mkdirSync(targetDir, { recursive: true });
  const tmpZip = join(os.tmpdir(), `node-runtime-${Date.now()}.zip`);
  writeFileSync(tmpZip, zipBytes);
  const result = spawnSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -Path '${tmpZip}' -DestinationPath '${targetDir}' -Force`]);
  if (result.status !== 0) throw new Error(`Expand-Archive failed: ${result.stderr}`);
}

export async function stageNodeRuntime({ destDir, fetch = defaultFetch, extract = defaultExtract, sha256 = defaultSha256 } = {}) {
  if (typeof destDir !== "string" || !destDir.trim()) throw new Error("stageNodeRuntime requires destDir.");
  const zipBytes = await fetch(NODE_WINDOWS_URL);
  const actualHash = sha256(zipBytes);
  if (actualHash !== NODE_WINDOWS_SHA256) throw new Error(`Node runtime checksum mismatch: expected ${NODE_WINDOWS_SHA256}, got ${actualHash}`);
  await extract(zipBytes, destDir);
  return { ok: true, nodeExePath: join(destDir, "node.exe") };
}
```

```javascript
// scripts/control-center/windows-bundle/stage-caddy.mjs
import { createHash } from "node:crypto";
import { join } from "node:path";

export const CADDY_VERSION = "2.11.4";
export const CADDY_WINDOWS_URL = `https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_windows_amd64.zip`;
export const CADDY_WINDOWS_SHA256 = "REPLACE_WITH_REAL_SHA256_FROM_CADDY_RELEASE_PAGE";

function defaultSha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function defaultFetch(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function defaultExtract(zipBytes, targetDir) {
  const { spawnSync } = await import("node:child_process");
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const os = await import("node:os");
  mkdirSync(targetDir, { recursive: true });
  const tmpZip = join(os.tmpdir(), `caddy-runtime-${Date.now()}.zip`);
  writeFileSync(tmpZip, zipBytes);
  const result = spawnSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -Path '${tmpZip}' -DestinationPath '${targetDir}' -Force`]);
  if (result.status !== 0) throw new Error(`Expand-Archive failed: ${result.stderr}`);
}

export async function stageCaddyRuntime({ destDir, fetch = defaultFetch, extract = defaultExtract, sha256 = defaultSha256 } = {}) {
  if (typeof destDir !== "string" || !destDir.trim()) throw new Error("stageCaddyRuntime requires destDir.");
  const zipBytes = await fetch(CADDY_WINDOWS_URL);
  const actualHash = sha256(zipBytes);
  if (actualHash !== CADDY_WINDOWS_SHA256) throw new Error(`Caddy runtime checksum mismatch: expected ${CADDY_WINDOWS_SHA256}, got ${actualHash}`);
  await extract(zipBytes, destDir);
  return { ok: true, caddyExePath: join(destDir, "caddy.exe") };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/control-center/windows-bundle/stage-node.test.mjs scripts/control-center/windows-bundle/stage-caddy.test.mjs`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add scripts/control-center/windows-bundle/stage-node.mjs scripts/control-center/windows-bundle/stage-node.test.mjs scripts/control-center/windows-bundle/stage-caddy.mjs scripts/control-center/windows-bundle/stage-caddy.test.mjs
git commit -m "feat(windows-native): add portable Node.js and Caddy stagers"
```

- [x] **Step 6: Resolve the real checksums (manual, one-time)**

Same pattern as Task 1 Step 6, against `NODE_WINDOWS_URL` and `CADDY_WINDOWS_URL`. Prefer copying the hash from Node's published `SHASUMS256.txt` over recomputing locally.

---

### Task 3: WinSW binary stager

**Files:**
- Create: `scripts/control-center/windows-bundle/stage-winsw.mjs`
- Create: `scripts/control-center/windows-bundle/stage-winsw.test.mjs`

**Interfaces:**
- Consumes: `WINDOWS_SERVICES` from `scripts/control-center/windows-services.mjs`.
- Produces: `stageWinswCopies({ destDir, fetch, sha256 }): Promise<{ ok, exePaths }>` — writes one `<id>.exe` WinSW copy per service (matches `windows-host-effects.mjs`'s `exeFor()`).

- [x] **Step 1: Write the failing test**

```javascript
// scripts/control-center/windows-bundle/stage-winsw.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WINDOWS_SERVICES } from "../windows-services.mjs";
import { stageWinswCopies, WINSW_SHA256, WINSW_URL } from "./stage-winsw.mjs";

test("stageWinswCopies writes one identically-named WinSW.exe copy per service id", async () => {
  const destDir = mkdtempSync(join(tmpdir(), "archive-winsw-stage-"));
  try {
    const fetch = async (url) => { assert.equal(url, WINSW_URL); return Buffer.from("fake-winsw-binary"); };
    const result = await stageWinswCopies({ destDir, fetch, sha256: () => WINSW_SHA256 });
    assert.equal(result.ok, true);
    assert.equal(result.exePaths.length, WINDOWS_SERVICES.length);
    for (const service of WINDOWS_SERVICES) {
      const expectedPath = join(destDir, `${service.id}.exe`);
      assert.ok(existsSync(expectedPath));
      assert.equal(readFileSync(expectedPath, "utf8"), "fake-winsw-binary");
    }
  } finally {
    rmSync(destDir, { recursive: true, force: true });
  }
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test scripts/control-center/windows-bundle/stage-winsw.test.mjs`
Expected: FAIL — module doesn't exist.

- [x] **Step 3: Write minimal implementation**

```javascript
// scripts/control-center/windows-bundle/stage-winsw.mjs
// windows-host-effects.mjs's serviceControl already assumes
// services\<id>.exe is a WinSW copy per service; WinSW reads its config from
// a same-named .xml, which serviceControl.install() already writes.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { WINDOWS_SERVICES } from "../windows-services.mjs";

export const WINSW_VERSION = "3.0.0-alpha.11";
export const WINSW_URL = `https://github.com/winsw/winsw/releases/download/v${WINSW_VERSION}/WinSW-x64.exe`;
export const WINSW_SHA256 = "REPLACE_WITH_REAL_SHA256_FROM_WINSW_RELEASE_PAGE";

function defaultSha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function defaultFetch(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function stageWinswCopies({ destDir, fetch = defaultFetch, sha256 = defaultSha256, services = WINDOWS_SERVICES } = {}) {
  if (typeof destDir !== "string" || !destDir.trim()) throw new Error("stageWinswCopies requires destDir.");
  const bytes = await fetch(WINSW_URL);
  const actualHash = sha256(bytes);
  if (actualHash !== WINSW_SHA256) throw new Error(`WinSW checksum mismatch: expected ${WINSW_SHA256}, got ${actualHash}`);
  mkdirSync(destDir, { recursive: true });
  const exePaths = services.map((service) => {
    const path = join(destDir, `${service.id}.exe`);
    writeFileSync(path, bytes);
    return path;
  });
  return { ok: true, exePaths };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test scripts/control-center/windows-bundle/stage-winsw.test.mjs`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add scripts/control-center/windows-bundle/stage-winsw.mjs scripts/control-center/windows-bundle/stage-winsw.test.mjs
git commit -m "feat(windows-native): add WinSW binary stager"
```

---

### Task 4: Tests for `windows-host-effects.mjs` (currently zero coverage)

**Files:**
- Create: `scripts/control-center/windows-host-effects.test.mjs`

**Interfaces:**
- Consumes: `createWindowsHostEffects` from `scripts/control-center/windows-host-effects.mjs` (existing, unchanged).

- [x] **Step 1: Write the failing test**

```javascript
// scripts/control-center/windows-host-effects.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWindowsHostEffects } from "./windows-host-effects.mjs";

const INSTALL_ROOT = "C:\\Program Files\\ArchiveSuite";

function fakeRun() {
  const calls = [];
  const run = (args) => { calls.push(args); return { status: 0, stdout: "", stderr: "" }; };
  return { run, calls };
}

test("serviceControl.install writes the service XML and calls <id>.exe install", () => {
  const { run, calls } = fakeRun();
  const written = [];
  const writeFile = (path, content) => written.push({ path, content });
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile });
  const result = effects.serviceControl.install({ id: "archive-http", description: "d", executable: "runtime\\caddy\\caddy.exe", arguments: "run" });
  assert.equal(result.status, 0);
  assert.equal(written[0].path, "C:\\Program Files\\ArchiveSuite\\services\\archive-http.xml");
  assert.deepEqual(calls[0], ["C:\\Program Files\\ArchiveSuite\\services\\archive-http.exe", "install"]);
});

test("serviceControl start/stop/restart/remove/query call the right WinSW verb", () => {
  const { run, calls } = fakeRun();
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  const exe = "C:\\Program Files\\ArchiveSuite\\services\\archive-next.exe";
  effects.serviceControl.start("archive-next");
  effects.serviceControl.stop("archive-next");
  effects.serviceControl.restart("archive-next");
  effects.serviceControl.remove("archive-next");
  effects.serviceControl.query("archive-next");
  assert.deepEqual(calls, [
    [exe, "start"], [exe, "stop"], [exe, "restart"], [exe, "uninstall"], [exe, "status"],
  ]);
});

test("applyAcls grants read/execute on the tree and modify on storage/logs, per service", () => {
  const { run, calls } = fakeRun();
  const services = [{ id: "svc-a" }, { id: "svc-b" }];
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {}, services });
  const result = effects.applyAcls();
  assert.equal(result.status, 0);
  assert.equal(calls.length, 6);
  assert.deepEqual(calls[0], ["icacls", INSTALL_ROOT, "/grant", "NT SERVICE\\svc-a:(OI)(CI)RX"]);
  assert.deepEqual(calls[1], ["icacls", "C:\\Program Files\\ArchiveSuite\\storage", "/grant", "NT SERVICE\\svc-a:(OI)(CI)M"]);
  assert.deepEqual(calls[2], ["icacls", "C:\\Program Files\\ArchiveSuite\\logs", "/grant", "NT SERVICE\\svc-a:(OI)(CI)M"]);
});

test("applyAcls surfaces the first failing icacls call, not the last", () => {
  let call = 0;
  const run = () => { call += 1; return call === 2 ? { status: 5, stdout: "", stderr: "denied" } : { status: 0 }; };
  const services = [{ id: "svc-a" }];
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {}, services });
  const result = effects.applyAcls();
  assert.equal(result.status, 5);
});

test("applyFirewallRules opens inbound TCP 443 for the archive-http rule only", () => {
  const { run, calls } = fakeRun();
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  effects.applyFirewallRules();
  assert.deepEqual(calls[0], ["netsh", "advfirewall", "firewall", "add", "rule", "name=archive-http", "dir=in", "action=allow", "protocol=TCP", "localport=443"]);
});

test("removeFirewallRules deletes the same named rule", () => {
  const { run, calls } = fakeRun();
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  effects.removeFirewallRules();
  assert.deepEqual(calls[0], ["netsh", "advfirewall", "firewall", "delete", "rule", "name=archive-http"]);
});

test("exec invokes the staged php.exe with artisan and the given arguments", () => {
  const { run, calls } = fakeRun();
  const effects = createWindowsHostEffects({ installRoot: INSTALL_ROOT, run, writeFile: () => {} });
  effects.exec(["queue:work", "--once"]);
  assert.deepEqual(calls[0], [
    "C:\\Program Files\\ArchiveSuite\\runtime\\php\\php.exe",
    "C:\\Program Files\\ArchiveSuite\\app\\laravel\\artisan",
    "queue:work", "--once",
  ]);
});

test("createWindowsHostEffects throws without a non-empty installRoot", () => {
  assert.throws(() => createWindowsHostEffects({ installRoot: "" }), /install root/i);
  assert.throws(() => createWindowsHostEffects({}), /install root/i);
});
```

- [x] **Step 2: Run test**

Run: `node --test scripts/control-center/windows-host-effects.test.mjs`
Expected: since `windows-host-effects.mjs` already exists and should already be correct (this task adds coverage, not new behavior), this should PASS immediately. If any assertion fails, that is a real bug in the existing host-effects file — fix `windows-host-effects.mjs` to match the documented command shapes above; never weaken the test to match a wrong command.

- [x] **Step 3: Commit**

```bash
git add scripts/control-center/windows-host-effects.test.mjs
git commit -m "test(windows-native): cover the real icacls/netsh/WinSW command construction"
```

---

### Task 5: Bundle assembler

**Files:**
- Create: `scripts/control-center/windows-bundle/assemble.mjs`
- Create: `scripts/control-center/windows-bundle/assemble.test.mjs`
- Modify: `package.json` — add `"bundle:windows-native": "node scripts/control-center/windows-bundle/assemble.mjs"`

**Interfaces:**
- Consumes: `stagePhpRuntime` (Task 1), `stageNodeRuntime`/`stageCaddyRuntime` (Task 2), `stageWinswCopies` (Task 3).
- Produces: `assembleWindowsBundle({ outDir, stagePhp, stageNode, stageCaddy, stageWinsw, buildLaravel, buildNext }): Promise<{ ok, manifestPath, shasumsPath }>` — consumed by Task 9.

- [x] **Step 1: Write the failing test**

```javascript
// scripts/control-center/windows-bundle/assemble.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assembleWindowsBundle } from "./assemble.mjs";

test("assembleWindowsBundle lays out runtime/app/services/config and writes SHA256SUMS", async () => {
  const outDir = mkdtempSync(join(tmpdir(), "archive-windows-bundle-"));
  try {
    const stagePhp = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "php.exe"), "php"); return { ok: true }; };
    const stageNode = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "node.exe"), "node"); return { ok: true }; };
    const stageCaddy = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "caddy.exe"), "caddy"); return { ok: true }; };
    const stageWinsw = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "archive-http.exe"), "winsw"); return { ok: true }; };
    const buildLaravel = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "artisan"), "#!/usr/bin/env php\n"); };
    const buildNext = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "server.js"), "// standalone server\n"); };

    const result = await assembleWindowsBundle({ outDir, stagePhp, stageNode, stageCaddy, stageWinsw, buildLaravel, buildNext });

    assert.equal(result.ok, true);
    assert.ok(existsSync(join(outDir, "runtime", "php", "php.exe")));
    assert.ok(existsSync(join(outDir, "runtime", "node", "node.exe")));
    assert.ok(existsSync(join(outDir, "runtime", "caddy", "caddy.exe")));
    assert.ok(existsSync(join(outDir, "services", "archive-http.exe")));
    assert.ok(existsSync(join(outDir, "app", "laravel", "artisan")));
    assert.ok(existsSync(join(outDir, "app", "next", "server.js")));
    assert.ok(existsSync(result.shasumsPath));
    const shasums = readFileSync(result.shasumsPath, "utf8");
    assert.match(shasums, /runtime\\php\\php\.exe/);
    assert.match(shasums, /^[0-9a-f]{64}  /m);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test scripts/control-center/windows-bundle/assemble.test.mjs`
Expected: FAIL — module doesn't exist.

- [x] **Step 3: Write minimal implementation**

```javascript
// scripts/control-center/windows-bundle/assemble.mjs
// Produces the exact directory layout windows-host-effects.mjs and
// windows-services.mjs already assume. Mirrors the existing offline-bundle
// pattern (infra/offline/install.ps1 + SHA256SUMS).
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { stagePhpRuntime } from "./stage-php.mjs";
import { stageNodeRuntime } from "./stage-node.mjs";
import { stageCaddyRuntime } from "./stage-caddy.mjs";
import { stageWinswCopies } from "./stage-winsw.mjs";

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(path));
    else out.push(path);
  }
  return out;
}

export async function assembleWindowsBundle({
  outDir,
  stagePhp = stagePhpRuntime,
  stageNode = stageNodeRuntime,
  stageCaddy = stageCaddyRuntime,
  stageWinsw = stageWinswCopies,
  buildLaravel,
  buildNext,
} = {}) {
  if (typeof outDir !== "string" || !outDir.trim()) throw new Error("assembleWindowsBundle requires outDir.");
  if (typeof buildLaravel !== "function" || typeof buildNext !== "function") throw new Error("assembleWindowsBundle requires buildLaravel and buildNext callbacks.");

  mkdirSync(outDir, { recursive: true });
  await stagePhp({ destDir: join(outDir, "runtime", "php") });
  await stageNode({ destDir: join(outDir, "runtime", "node") });
  await stageCaddy({ destDir: join(outDir, "runtime", "caddy") });
  await stageWinsw({ destDir: join(outDir, "services") });
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

  return { ok: true, manifestPath: join(outDir, "config"), shasumsPath };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test scripts/control-center/windows-bundle/assemble.test.mjs`
Expected: PASS.

- [x] **Step 5: Wire the pnpm script**

Add to root `package.json` `scripts`: `"bundle:windows-native": "node scripts/control-center/windows-bundle/assemble.mjs",`

- [x] **Step 6: Commit**

```bash
git add scripts/control-center/windows-bundle/assemble.mjs scripts/control-center/windows-bundle/assemble.test.mjs package.json
git commit -m "feat(windows-native): add bundle assembler producing the install-root layout"
```

---

### Task 6: Wire external Postgres/Redis probes into the native CLI path

**Files:**
- Modify: `scripts/control-center.mjs` (`nativeSetupInstallOrRepair`, around line 258 — passes `preflight` to `buildNativeRuntime` but never `probes`, so `dataGate` always fails with "not wired into this build").
- Create: `scripts/control-center/native-probes.mjs`
- Create: `scripts/control-center/native-probes.test.mjs`

**Interfaces:**
- Produces: `createExternalOnlyProbes(): { postgres, redis }` matching the `probes` shape `createNativeDataGate` (in `native-data-services.mjs`) expects — consumed by `control-center.mjs`.

- [x] **Step 1: Confirm the exact `probes` contract before writing the test**

```bash
grep -n "createNativeDataGate\|probes\." scripts/control-center/native-data-services.mjs
```

- [x] **Step 2: Write the failing test**

```javascript
// scripts/control-center/native-probes.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createExternalOnlyProbes } from "./native-probes.mjs";

test("postgres probe reports ok:true when a TCP connection to the endpoint succeeds", async () => {
  const fakeConnect = async (host, port) => { assert.equal(host, "db.example.internal"); assert.equal(port, 5432); return true; };
  const probes = createExternalOnlyProbes({ tcpConnect: fakeConnect });
  const result = await probes.postgres({ host: "db.example.internal", port: 5432 });
  assert.equal(result.ok, true);
});

test("postgres probe reports a clear failure when the endpoint is unreachable", async () => {
  const fakeConnect = async () => { throw new Error("ECONNREFUSED"); };
  const probes = createExternalOnlyProbes({ tcpConnect: fakeConnect });
  const result = await probes.postgres({ host: "db.example.internal", port: 5432 });
  assert.equal(result.ok, false);
  assert.match(result.message, /ECONNREFUSED|unreachable/i);
});

test("local-managed postgres plan is rejected with the documented not-bundled message", async () => {
  const probes = createExternalOnlyProbes({ tcpConnect: async () => true });
  const result = await probes.postgres({ kind: "local-managed" });
  assert.equal(result.ok, false);
  assert.match(result.code, /LOCAL_POSTGRES_UNAVAILABLE/);
});
```

- [x] **Step 3: Run test to verify it fails**

Run: `node --test scripts/control-center/native-probes.test.mjs`
Expected: FAIL — module doesn't exist.

- [x] **Step 4: Write minimal implementation**

```javascript
// scripts/control-center/native-probes.mjs
// This plan scopes native Windows to external Postgres/Redis only. These
// probes verify the operator-supplied endpoint is reachable; they never
// attempt to start a local database.
import { connect } from "node:net";

async function defaultTcpConnect(host, port, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port, timeout: timeoutMs });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); reject(new Error(`Connection to ${host}:${port} timed out`)); });
    socket.once("error", (error) => { socket.destroy(); reject(error); });
  });
}

export function createExternalOnlyProbes({ tcpConnect = defaultTcpConnect } = {}) {
  async function probeEndpoint(endpoint, label) {
    if (endpoint?.kind === "local-managed") {
      return { ok: false, code: "LOCAL_POSTGRES_UNAVAILABLE", message: `The locally managed ${label} runtime is not bundled in this build.` };
    }
    if (!endpoint?.host || !endpoint?.port) {
      return { ok: false, code: "ENDPOINT_NOT_CONFIGURED", message: `No ${label} endpoint configured.` };
    }
    try {
      await tcpConnect(endpoint.host, endpoint.port);
      return { ok: true };
    } catch (error) {
      return { ok: false, code: "ENDPOINT_UNREACHABLE", message: `${label} endpoint ${endpoint.host}:${endpoint.port} is unreachable: ${error.message}` };
    }
  }
  return {
    postgres: (endpoint) => probeEndpoint(endpoint, "PostgreSQL"),
    redis: (endpoint) => probeEndpoint(endpoint, "Redis"),
  };
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `node --test scripts/control-center/native-probes.test.mjs`
Expected: PASS.

- [x] **Step 6: Wire it into `control-center.mjs`**

Add the import and pass `probes: createExternalOnlyProbes()` inside the `buildNativeRuntime({...})` call in `nativeSetupInstallOrRepair`.

- [x] **Step 7: Commit**

```bash
git add scripts/control-center/native-probes.mjs scripts/control-center/native-probes.test.mjs scripts/control-center.mjs
git commit -m "feat(windows-native): wire external Postgres/Redis reachability probes"
```

---

### Task 7: Open the `MODE_UNSUPPORTED` gate for `windows-native`

**Resolution (2026-08-07):** re-verified against the current tree instead of applying the literal diff below — the code has moved since this plan was written (`feat(ops): wire runnable native mode into the setup CLI`, 2026-07-16, predates this plan). The CLI gate at `control-center.mjs`'s `setupInstallOrRepair` already dispatches `mode === "native"` (any platform) to `nativeSetupInstallOrRepair` *before* reaching the `MODE_UNSUPPORTED` check — that check is dead code, unreachable for native. Confirmed empirically: `node scripts/control-center.mjs install --config=<windows-native config> --json` proceeds past the mode gate and fails only on a real host preflight check (`INSUFFICIENT_DISK_SPACE`), never `MODE_UNSUPPORTED`. The second gate (interactive guided-setup wizard) still blocks all native platforms — left as-is, since its provisioning steps are Docker-env-specific (writes `.env`, runs `docker compose`) and flipping that check without building real native wizard steps would route a user into a broken path. No code change was needed; the plan's real objective (native installs runnable for `windows-native`) is already met via the tested CLI path.

**Files:**
- Modify: `scripts/control-center.mjs` (the two `MODE_UNSUPPORTED` returns, around lines 192 and 906).
- Modify: `scripts/control-center/native-setup.test.mjs`.

- [x] **Step 1: Read the existing test harness first**

```bash
grep -n "^test\|^async function\|^function" scripts/control-center/native-setup.test.mjs
```

Use the real, existing entry-point name from this output in Step 2 below — do not invent one.

- [x] **Step 2: Write the failing test** — skipped; per this task's Resolution note, the empirical CLI probe (`node scripts/control-center.mjs install --config=<windows-native config> --json`) already showed `nativeSetupInstallOrRepair` is reached before the `MODE_UNSUPPORTED` check, so a "no longer returns MODE_UNSUPPORTED" test would pass without any code change — it would test dead-code avoidance that's already true, not a behavior this task introduces.

- [x] **Step 3: Run test to verify it fails** — n/a, no new test written (see Step 2).

- [x] **Step 4: Remove the gate for `windows-native` only** — n/a. Re-confirmed 2026-08-07 by reading `scripts/control-center.mjs` lines 189-193: `mode === "native"` dispatches to `nativeSetupInstallOrRepair` at line 190, before the `mode !== "docker"` MODE_UNSUPPORTED check at line 192 — that check is unreachable for native mode already. The second gate (line 911-912, inside `runGuidedProvisioningFlow`'s `provision` callback in the interactive wizard) is confirmed to be the Docker-specific guided-setup path and intentionally stays blocked, per this task's Resolution note.

In `scripts/control-center.mjs`, change:

```javascript
if (configuration.mode !== "docker") {
  return renderSetupResult(setupConfiguration.errorResult("MODE_UNSUPPORTED", "Install and repair are currently available for Docker mode only.", { mode: configuration.mode }));
}
```

to:

```javascript
if (configuration.mode !== "docker" && configuration.platform !== "windows-native") {
  return renderSetupResult(setupConfiguration.errorResult("MODE_UNSUPPORTED", "Install and repair are currently available for Docker mode and windows-native only.", { mode: configuration.mode }));
}
```

Apply the equivalent change to the second gate near line 906. **Do not** open the gate for `linux-native` here — that stays blocked until the sibling Linux plan's own Task 7 lands. — n/a, see Step 4.

- [x] **Step 5: Run test to verify it passes** — n/a, see Step 2.

- [x] **Step 6: Run the full control-center suite** — re-run 2026-08-07: `node --test scripts/control-center/*.test.mjs scripts/control-center/**/*.test.mjs` → 210/210 passing (199 + 11 in `windows-bundle/`).

- [x] **Step 7: Commit** — no code diff to commit; this task's outcome (native installs no longer blocked by `MODE_UNSUPPORTED`) was already true in the tree per the Resolution note. Only this plan document changes, committed below.

---

### Task 8: Update the platform contract's stated requirements (status stays `"planned"`)

**Files:**
- Modify: `infra/platform/compatibility.v1.json` — the `windows-native` entry.

- [x] **Step 1: Extend `requirements` with the pins this plan implemented**

```json
"requirements": {
  "node": ">=26.5.0 <27",
  "docker": "not required for the planned native path",
  "php": "8.5.8 (bundled, NTS, portable -- see docs/superpowers/plans/2026-08-06-windows-native-release.md)",
  "postgres": "external endpoint only; local-managed is not bundled",
  "redis": "external endpoint only; local-managed is not bundled"
}
```

Keep `"status": "planned"` — flipping it needs Task 10's real evidence, per the V1-212C gate `scripts/verify-release-readiness.mjs` already enforces.

- [x] **Step 2: Run the contract's own tests**

Run: `node --test scripts/control-center/*.test.mjs`
Expected: PASS. If a test asserts an exact `requirements` object shape that this edit breaks, update that test to match — never delete a contract-shape assertion to force a pass.

- [x] **Step 3: Commit**

```bash
git add infra/platform/compatibility.v1.json
git commit -m "docs(windows-native): record the bundled PHP/Node/Caddy pins and external-data-only scope"
```

---

### Task 9: Real end-to-end dry run on this development machine

Not clean-host evidence — proves the bundle boots.

- [x] **Step 1: Write a thin CLI wrapper with real build callbacks**

Created `scripts/control-center/windows-bundle/cli.mjs` + `cli.test.mjs` (5 tests, TDD-first), wiring real `composer install --no-dev --working-dir=archive-laravel` and `pnpm --filter @archive/next build` as `buildLaravel`/`buildNext`. Also resolved this task's outstanding Step 6 checksum placeholders across Tasks 1-3 with real, network-verified SHA-256 hashes (PHP 8.5.8 moved from `releases/` to `releases/archives/` on windows.php.net since the plan was written — URL updated accordingly, version pin unchanged). Full `scripts/control-center/**/*.test.mjs` suite: 210/210 passing.

**Steps 2-3 completed 2026-08-07.** Running Step 2 first surfaced a real bug: `cli.mjs`'s default `buildLaravel`/`buildNext` ran `composer install`/`pnpm build` but never copied the resulting output into `destDir` — the assembled bundle's `app/` folder would have been empty regardless of Composer availability. Fixed in `scripts/control-center/windows-bundle/cli.mjs`: `buildLaravel` now builds the `Dockerfile.worker` runtime image and runs `composer install --no-dev` inside it (this dev machine has no local PHP/Composer, only Docker, per repo convention), then copies `archive-laravel` (minus `tests`/`docker`/Dockerfiles) into `destDir`; `buildNext` copies the Next.js `standalone` output, its hoisted `node_modules`, `.next/static`, and `public` into `destDir`. `cli.test.mjs` updated to cover the new copy behavior with injected fakes (still fast/mocked, no real fs or docker calls). Full `scripts/control-center/**/*.test.mjs` suite: 211/211 passing.

Real run: `pnpm run bundle:windows-native -- --out D:\archiveaq\windows-native-bundle-test` — succeeded, produced `runtime/{php,node,caddy}`, `services/*.exe`, `app/laravel/{artisan,vendor/autoload.php,...}`, `app/next/{server.js,node_modules,.next/static,public}`, `config/`, `storage/`, `logs/`, and `SHA256SUMS` (16,323 entries). Step 3 verification: every entry's real SHA-256 matched `SHA256SUMS` — 16,323 checked, 0 mismatches.

**Steps 4-5 intentionally not run:** they register/uninstall real Windows services via WinSW, which modifies live system service state — out of scope for an unattended agent regardless of this plan's text. Run those manually, interactively, when ready.

- [x] **Step 2: Produce a real bundle**

```powershell
pnpm run bundle:windows-native -- --out D:\archiveaq\windows-native-bundle-test
```

- [x] **Step 3: Manually verify SHA256SUMS**

```powershell
cd D:\archiveaq\windows-native-bundle-test
Get-Content SHA256SUMS | ForEach-Object {
  $hash, $path = $_ -split '  ', 2
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant() -ne $hash) { throw "SHA256SUMS verification failed: $path" }
}
Write-Host "All files verified."
```

- [ ] **Step 4: Point the bundle at a real Postgres/Redis and attempt install**

```powershell
$env:ARCHIVE_NATIVE_INSTALL_ROOT = "D:\archiveaq\windows-native-install-test"
node scripts/control-center.mjs setup install --mode=native --platform=windows-native --yes
```

Expected: services register (`Get-Service archive-*`), `archive-http` responds with the app's normal login page. This machine is **not** a clean host — a pass here is not V1-210D-native acceptance evidence.

- [ ] **Step 5: Uninstall cleanly and confirm no residue**

```powershell
node scripts/control-center.mjs setup uninstall --mode=native --platform=windows-native --yes
Get-Service archive-* -ErrorAction SilentlyContinue
```

Expected: no `archive-*` services remain.

---

### Task 10 (external, non-code): Clean-host acceptance and the platform-contract flip

Cannot be executed on a desk machine with the dev toolchain installed — requires exactly what `docs/ops/acceptance-clean-host-blockers.md` already documents as blocked.

- [ ] Provision a clean Windows 10 VM and a clean Windows 11 VM/host (no dev toolchain, no prior install).
- [ ] Copy the Task 9 bundle over via a normal file transfer (not a dev-tooling mount).
- [ ] Run install, verify reachability, run update-in-place, run rollback, run uninstall — same scenario matrix `docs/evidence/v1-210d/README.md` used for `windows-10-11-docker`, adapted to native mode.
- [ ] Record a manifest (commit, version, digests, scenario results) matching the shape of `docs/evidence/v1-210d/final-manifest.json`, saved to `docs/evidence/v1-210d-native/`.
- [ ] Only then flip `infra/platform/compatibility.v1.json`'s `windows-native.status` from `"planned"` to `"supported"` — the existing V1-212C evidence check in `scripts/verify-release-readiness.mjs` will fail the release gate without a matching evidence file.
- [ ] Update `TASKS.md`: close the corresponding V1 item with a link to the new evidence directory, following the prose pattern used for V1-210D's closure entry.
