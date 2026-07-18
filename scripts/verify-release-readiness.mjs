import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Verifies actual release-readiness CONTENT (version coherence, license,
// support policy, release pipeline shape, API contract, open P0s, env
// completeness) plus a small set of cross-file wiring invariants worth
// keeping from the original cutover-era checks. Everything here fails with a
// message naming the exact file/field to fix.

const ROOT = process.env.READINESS_ROOT
  ? path.resolve(process.env.READINESS_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function exists(relativePath) {
  return existsSync(path.join(ROOT, relativePath));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const rootPkg = json("package.json");

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

// 1. Version coherence: SemVer, HEAD tag (if any) matches, release notes exist.
function checkVersionCoherence() {
  const version = rootPkg.version;
  assert.match(
    version,
    SEMVER_RE,
    `package.json "version" ("${version}") is not valid SemVer (expected MAJOR.MINOR.PATCH[-pre][+build])`
  );

  let tags = [];
  try {
    tags = execFileSync("git", ["-C", ROOT, "tag", "--points-at", "HEAD"], { encoding: "utf8" })
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
  } catch {
    tags = []; // not a git repo / git unavailable: skip tag coherence, still check the rest
  }
  const versionTag = tags.find((t) => /^v\d/.test(t));
  if (versionTag) {
    assert.equal(
      versionTag,
      `v${version}`,
      `git tag "${versionTag}" points at HEAD but package.json version is "${version}" — retag or bump package.json`
    );
  }

  const notesFile = `docs/release-notes/v${version}.md`;
  assert.ok(exists(notesFile), `${notesFile} is missing — add release notes for the current package.json version`);
}

// 2. LICENSE exists and contains a recognizable license.
function checkLicense() {
  const file = "LICENSE";
  assert.ok(exists(file), `${file} is missing at the repo root — add a LICENSE file`);
  const text = read(file);
  const KNOWN_MARKERS = [
    "MIT License",
    "Apache License",
    "GNU GENERAL PUBLIC LICENSE",
    "BSD 2-Clause",
    "BSD 3-Clause",
    "Mozilla Public License",
  ];
  assert.ok(
    KNOWN_MARKERS.some((marker) => text.includes(marker)),
    `${file} does not contain a recognizable license header (expected one of: ${KNOWN_MARKERS.join(", ")})`
  );
}

// 3. docs/versioning.md documents the support window.
function checkVersioningDoc() {
  const file = "docs/versioning.md";
  assert.ok(exists(file), `${file} is missing — document the SemVer + support-window policy`);
  const text = read(file);
  assert.match(text, /\|.*\|.*\|/, `${file} must contain a markdown table describing the support window`);
  assert.match(text, /(support|دعم)/i, `${file} must mention the support window (expected "support" or "دعم")`);
}

async function tryParseYaml(text) {
  for (const name of ["yaml", "js-yaml"]) {
    try {
      const mod = await import(name);
      if (name === "yaml" && typeof mod.parse === "function") return mod.parse(text);
      if (name === "js-yaml") {
        const loader = mod.load || mod.default?.load;
        if (loader) return loader(text);
      }
    } catch {
      // parser not installed — fall through to the next candidate / regex fallback
    }
  }
  return null;
}

// 4. .github/workflows/release.yml: tag trigger + verify -> publish gate.
async function checkReleaseWorkflow() {
  const file = ".github/workflows/release.yml";
  assert.ok(exists(file), `${file} is missing — the release pipeline is not wired up`);
  const text = read(file);
  const parsed = await tryParseYaml(text);

  if (parsed) {
    const tags = parsed.on?.push?.tags;
    assert.ok(
      Array.isArray(tags) && tags.includes("v*"),
      `${file}: on.push.tags must include "v*" (found ${JSON.stringify(tags)})`
    );
    assert.ok(parsed.jobs?.verify, `${file}: must define a "verify" job`);
    assert.ok(parsed.jobs?.publish, `${file}: must define a "publish" job`);
    const needs = parsed.jobs.publish.needs;
    const needsVerify = needs === "verify" || (Array.isArray(needs) && needs.includes("verify"));
    assert.ok(needsVerify, `${file}: "publish" job must declare needs: verify`);
  } else {
    // No YAML parser in node_modules: fall back to structural regex checks.
    assert.match(
      text,
      /on:\s*\n\s*push:\s*\n\s*tags:\s*\n\s*-\s*["']?v\*["']?/,
      `${file}: on.push.tags must include "v*" (checked structurally, no YAML parser available)`
    );
    assert.match(text, /^\s{2}verify:\s*$/m, `${file}: must define a top-level "verify" job`);
    assert.match(text, /^\s{2}publish:\s*$/m, `${file}: must define a top-level "publish" job`);
    assert.match(text, /needs:\s*verify\b/, `${file}: "publish" job must declare needs: verify`);
  }
}

// 5. Shared OpenAPI contract parses and has a version + non-empty paths.
function checkOpenApiContract() {
  const file = "docs/api/archive-contract.openapi.json";
  assert.ok(exists(file), `${file} is missing`);
  let contract;
  try {
    contract = JSON.parse(read(file));
  } catch (err) {
    assert.fail(`${file} is not valid JSON: ${err.message}`);
  }
  assert.ok(contract.info?.version, `${file}: info.version must be set`);
  assert.ok(
    contract.paths && Object.keys(contract.paths).length > 0,
    `${file}: paths must be a non-empty object`
  );
}

// 6. No unchecked P0 items left in the task ledger.
function checkTasksP0() {
  const file = "TASKS.md";
  if (!exists(file)) return; // nothing to enforce if the ledger doesn't exist
  const offenders = read(file)
    .split("\n")
    .filter((line) => /^- \[ \].*P0 #/.test(line));
  assert.equal(
    offenders.length,
    0,
    `TASKS.md has unchecked P0 item(s), release cannot proceed:\n${offenders.join("\n")}`
  );
}

// 6b. V1-406: in release mode, no unchecked release-blocking V1 item may remain.
// Release mode = a v* tag points at HEAD, or READINESS_RELEASE=1 (release.yml
// runs on tag push, so the tag check covers it; CI pushes only get a warning).
// V1-X items (optional capability verifications) and B backlog items never block.
function isReleaseMode() {
  if (process.env.READINESS_RELEASE === "1") return true;
  try {
    return execFileSync("git", ["-C", ROOT, "tag", "--points-at", "HEAD"], { encoding: "utf8" })
      .split("\n")
      .some((t) => /^v\d/.test(t.trim()));
  } catch {
    return false;
  }
}

function checkTasksV1Blockers() {
  const file = "TASKS.md";
  if (!exists(file)) return;
  const offenders = read(file)
    .split("\n")
    .filter((line) => /^- \[ \] \*\*V1-(?!X)/.test(line));
  if (offenders.length === 0) return;
  if (!isReleaseMode()) {
    console.warn(
      `warning: ${offenders.length} open V1 release blocker(s) in TASKS.md (release will be blocked until they close)`
    );
    return;
  }
  assert.fail(
    `TASKS.md has unchecked release-blocking V1 item(s), release cannot proceed:\n${offenders.join("\n")}`
  );
}

// 6c. V1-406: no platform may claim "supported" without recorded evidence.
// Planned/conditional platforms never block (disabled features stay free),
// but flipping one to supported requires an evidence reference (V1-212C).
function checkPlatformSupportEvidence() {
  const file = "infra/platform/compatibility.v1.json";
  if (!exists(file)) return;
  const contract = json(file);
  const offenders = (contract.platforms ?? []).filter(
    (p) => p.status === "supported" && !p.evidence
  );
  assert.equal(
    offenders.length,
    0,
    `${file}: platform(s) claim "supported" without evidence: ${offenders.map((p) => p.id).join(", ")}`
  );
}

// 7. Every ${VAR:?...} required by docker-compose.yml has a line in .env.example.
function checkEnvExampleCompleteness() {
  const composeFile = "infra/docker-compose.yml";
  const envFile = "infra/.env.example";
  const composeText = read(composeFile);
  const envText = read(envFile);
  const required = [...new Set([...composeText.matchAll(/\$\{([A-Z0-9_]+):\?/g)].map((m) => m[1]))];
  const missing = required.filter((name) => !new RegExp(`^${name}=`, "m").test(envText));
  assert.equal(
    missing.length,
    0,
    `${envFile} is missing required variable(s) referenced by ${composeFile}: ${missing.join(", ")}`
  );
}

// --- Kept from the original script: real cross-file coherence, not prose theater. ---

function checkNodeEngineCoherence() {
  const toolchain = json("infra/platform/toolchain.v1.json");
  const nextPkg = json("archive-next/package.json");
  assert.equal(
    rootPkg.engines?.node,
    `>=${toolchain.node} <26`,
    "root package.json engines.node must track infra/platform/toolchain.v1.json (node)"
  );
  assert.equal(
    nextPkg.engines?.node,
    `>=${toolchain.node} <26`,
    "archive-next/package.json engines.node must track infra/platform/toolchain.v1.json (node)"
  );
  assert.match(
    read("scripts/node-version.mjs"),
    new RegExp(`MIN_NODE_VERSION\\s*=\\s*"${escapeRegExp(toolchain.node)}"`),
    "scripts/node-version.mjs MIN_NODE_VERSION must track infra/platform/toolchain.v1.json (node)"
  );
}

function checkScriptWiring() {
  assert.equal(
    rootPkg.scripts?.dev,
    "node scripts/dev-laravel-next.mjs",
    'root "dev" script must run Laravel + Next.js together'
  );
  assert.equal(
    rootPkg.scripts?.build,
    "pnpm run build:next",
    'root "build" script must build the canonical Next.js app'
  );
  assert.equal(
    rootPkg.scripts?.verify,
    "pnpm run verify:laravel-next",
    'root "verify" script must target the Laravel + Next.js gate'
  );
  assert.equal(
    rootPkg.scripts?.server,
    "node scripts/laravel-docker.mjs serve",
    'root "server" script must run the Laravel API'
  );
  assert.ok(
    rootPkg.scripts?.["verify:laravel-next:live"],
    "root package.json is missing the live Laravel/Next integration gate (verify:laravel-next:live)"
  );

  for (const script of [
    "security:baseline",
    "security:audit",
    "verify:cutover",
    "verify:laravel",
    "verify:laravel-next",
    "ci",
    "ci:docker",
    "release:verify",
  ]) {
    assert.ok(rootPkg.scripts?.[script], `root package.json is missing required script "${script}"`);
  }

  const laravelComposer = json("archive-laravel/composer.json");
  const laravelPkg = json("archive-laravel/package.json");
  assert.ok(laravelComposer.scripts?.setup, 'archive-laravel/composer.json is missing a "setup" script');
  assert.ok(
    !laravelComposer.scripts.setup.some((step) => step.includes("npm run build")),
    'archive-laravel composer "setup" must not build a Laravel Vite frontend (Next.js is canonical)'
  );
  assert.ok(
    !laravelComposer.scripts.dev?.some((step) => step.includes("npm run dev") || step.includes("vite")),
    'archive-laravel composer "dev" must not start a Vite frontend (Next.js is canonical)'
  );
  assert.ok(
    !laravelPkg.devDependencies?.vite,
    "archive-laravel/package.json must not depend on vite after the Next.js cutover"
  );
}

function checkCiWorkflowWiring() {
  const file = ".github/workflows/ci.yml";
  const text = read(file);
  assert.match(
    text,
    /pnpm run verify:laravel\b/,
    `${file} must run "pnpm run verify:laravel" so CI exercises the Laravel test suite`
  );
  assert.match(
    text,
    /node scripts\/verify-release-readiness\.mjs/,
    `${file} must invoke this readiness script so CI actually enforces it`
  );
}

const failures = [];

async function run(label, fn) {
  try {
    await fn();
  } catch (err) {
    failures.push(`- [${label}] ${err.message}`);
  }
}

await run("version-coherence", checkVersionCoherence);
await run("license", checkLicense);
await run("versioning-doc", checkVersioningDoc);
await run("release-workflow", checkReleaseWorkflow);
await run("openapi-contract", checkOpenApiContract);
await run("tasks-p0", checkTasksP0);
await run("tasks-v1-blockers", checkTasksV1Blockers);
await run("platform-support-evidence", checkPlatformSupportEvidence);
await run("env-example-completeness", checkEnvExampleCompleteness);
await run("node-engine-coherence", checkNodeEngineCoherence);
await run("script-wiring", checkScriptWiring);
await run("ci-workflow-wiring", checkCiWorkflowWiring);

if (failures.length > 0) {
  console.error(`FAIL - release readiness (${failures.length} issue(s)):\n${failures.join("\n")}`);
  process.exit(1);
}

console.log("ok - release readiness content verified");
