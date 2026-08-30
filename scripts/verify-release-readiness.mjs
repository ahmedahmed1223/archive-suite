import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Verifies actual release-readiness CONTENT (version coherence, license,
// support policy, release pipeline shape, API contract, open P0s, env
// completeness) plus a small set of cross-file wiring invariants. Everything here fails with a
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

function tagsAtHead() {
  if (!exists(".git")) return [];

  return execFileSync(
    "git",
    ["-c", `safe.directory=${ROOT.replaceAll("\\", "/")}`, "-C", ROOT, "tag", "--points-at", "HEAD"],
    { encoding: "utf8" }
  )
    .split("\n")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// 1. Version coherence: SemVer, HEAD tag (if any) matches, release notes exist.
function checkVersionCoherence() {
  const version = rootPkg.version;
  assert.match(
    version,
    SEMVER_RE,
    `package.json "version" ("${version}") is not valid SemVer (expected MAJOR.MINOR.PATCH[-pre][+build])`
  );

  const nextVersion = json("archive-next/package.json").version;
  assert.equal(
    nextVersion,
    version,
    `archive-next/package.json version ${nextVersion} must match root package.json version ${version}`
  );

  const versionTag = tagsAtHead().find((tag) => /^v\d/.test(tag));
  if (versionTag) {
    assert.equal(
      versionTag,
      `v${version}`,
      `git tag "${versionTag}" points at HEAD but package.json version is "${version}" — retag or bump package.json`
    );
  }

  const notesFile = `docs/release-notes/v${version}.md`;
  assert.ok(exists(notesFile), `${notesFile} is missing — add release notes for the current package.json version`);
  const arabicNotesFile = `docs/release-notes/v${version}.ar.md`;
  assert.ok(exists(arabicNotesFile), `${arabicNotesFile} is missing — add Arabic release notes for the current package.json version`);
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

  const requiredDistributionPatterns = [
    ["Windows Native build and acceptance", /windows-native(?:-build)?:[\s\S]*?bundle:windows-native[\s\S]*?windows-native-acceptance:[\s\S]*?native-acceptance\.mjs windows[\s\S]*?upload-artifact@v4/i],
    ["Linux Native build and acceptance", /linux-native:[\s\S]*?bundle:linux-native[\s\S]*?native-acceptance\.mjs linux[\s\S]*?upload-artifact@v4/i],
    ["Whisper release smoke", /whisper:[\s\S]*?smoke-whisper-release\.mjs/i],
  ];
  for (const [label, pattern] of requiredDistributionPatterns) {
    assert.match(text, pattern, `${file}: missing required ${label}.`);
  }
  assert.match(text, /WINDOWS_REDIS_URL[\s\S]*WINDOWS_REDIS_SHA256/i, `${file}: Windows Native release is missing its Redis input contract.`);
  assert.match(text, /LINUX_POSTGRES_URL[\s\S]*LINUX_PGVECTOR_URL[\s\S]*LINUX_REDIS_URL/i, `${file}: Linux Native release is missing its three data-service input contract.`);
  assert.match(text, /fetch-native-release-inputs\.mjs linux[\s\S]*bundle:linux-native[\s\S]*--postgres-dir[\s\S]*--pgvector-dir[\s\S]*--redis-dir/i, `${file}: Linux Native assembly must consume the verified data-service inputs.`);
  assert.match(text, /build-native-release-metadata\.mjs[\s\S]*RELEASE\.json/i, `${file}: release packaging must publish aggregate Native RELEASE.json metadata.`);
  assert.match(text, /artifacts=.*RELEASE\.json/i, `${file}: RELEASE.json must be covered by the release artifact list.`);
  assert.match(text, /download-artifact@v4/i, `${file}: publish job must download verified distribution artifacts.`);
  assert.match(text, /sha256sum\s+--check\s+SHA256SUMS/i, `${file}: publish job must verify SHA256SUMS before release creation.`);
  assert.match(text, /node scripts\/build-release-notes\.mjs/i, `${file}: publish job must build bilingual GitHub Release notes from the canonical files.`);
  assert.match(text, /--notes-file\s+release-notes\.md/i, `${file}: GitHub Release creation must use the generated bilingual notes.`);
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

function isReleaseMode() {
  if (process.env.READINESS_RELEASE === "1") return true;
  return tagsAtHead().some((tag) => /^v\d/.test(tag));
}

// 6c. V1-406: no platform may claim "supported" without recorded evidence.
// Planned/conditional platforms never block (disabled features stay free),
// but flipping one to supported requires an evidence reference (V1-212C).
function checkPlatformSupportEvidence() {
  if (!isReleaseMode()) return;
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
  const missingEvidence = (contract.platforms ?? []).filter(
    (platform) => platform.status === "supported" && platform.evidence && !exists(platform.evidence)
  );
  assert.equal(
    missingEvidence.length,
    0,
    `${file}: evidence path does not exist for supported platform(s): ${missingEvidence.map((platform) => platform.id).join(", ")}`
  );
}

function checkReleaseClaims() {
  const version = rootPkg.version;
  for (const file of [`docs/release-notes/v${version}.md`, `docs/release-notes/v${version}.ar.md`]) {
    if (!exists(file)) continue;
    const text = read(file);
    assert.doesNotMatch(
      text,
      /(?:windows|linux|Windows|Linux).{0,80}(?:native|Native).{0,80}(?:remain|status|still|تظل|يبقى).{0,40}(?:planned|مخطط)/isu,
      `${file}: contains an obsolete Native planned claim.`
    );
  }
}

function checkWhisperCoherence() {
  const expected = "whisper-ctranslate2";
  const files = ["archive-laravel/config/media.php", "infra/k8s/configmap.yaml"];
  for (const file of files) {
    if (!exists(file)) continue;
    assert.match(read(file), new RegExp(escapeRegExp(expected)), `${file}: canonical Whisper binary must be ${expected}.`);
  }
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
    `>=${toolchain.node} <27`,
    "root package.json engines.node must track infra/platform/toolchain.v1.json (node)"
  );
  assert.equal(
    nextPkg.engines?.node,
    `>=${toolchain.node} <27`,
    "archive-next/package.json engines.node must track infra/platform/toolchain.v1.json (node)"
  );
  assert.match(
    read("scripts/node-version.mjs"),
    new RegExp(`MIN_NODE_VERSION\\s*=\\s*"${escapeRegExp(toolchain.node)}"`),
    "scripts/node-version.mjs MIN_NODE_VERSION must track infra/platform/toolchain.v1.json (node)"
  );
}

// Reuses the loader Control Center itself runs at install time — if the
// descriptor is malformed, placeholder, or version-incoherent, this fails
// with the exact same error the installer would raise on a real machine.
async function checkReleaseDescriptorIntegrity() {
  const modulePath = pathToFileURL(path.join(ROOT, "scripts/control-center/release-descriptor.mjs"));
  const { loadReleaseDescriptor } = await import(modulePath);
  loadReleaseDescriptor();
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
    "verify:canonical-defaults",
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
    "archive-laravel/package.json must not depend on vite because Next.js is the supported frontend"
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
await run("platform-support-evidence", checkPlatformSupportEvidence);
await run("release-claims", checkReleaseClaims);
await run("whisper-coherence", checkWhisperCoherence);
await run("env-example-completeness", checkEnvExampleCompleteness);
await run("node-engine-coherence", checkNodeEngineCoherence);
await run("release-descriptor-integrity", checkReleaseDescriptorIntegrity);
await run("script-wiring", checkScriptWiring);
await run("ci-workflow-wiring", checkCiWorkflowWiring);

if (failures.length > 0) {
  console.error(`FAIL - release readiness (${failures.length} issue(s)):\n${failures.join("\n")}`);
  process.exit(1);
}

console.log("ok - release readiness content verified");
