import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const NO_PULL_POLICY = "--pull never"; // The bundle's Compose policy is authoritative.

function assertReleaseDownload(bundle) {
  const path = resolve(bundle);
  if (path.toLowerCase() === root.toLowerCase() || path.toLowerCase().startsWith(`${root.toLowerCase()}\\`) || path.toLowerCase().startsWith(`${root.toLowerCase()}/`)) throw new Error("release bundle must be a supplied download outside the workspace");
  return path;
}

function parseChecksums(path) {
  if (!existsSync(path)) throw new Error(`SHA256SUMS file not found: ${path}`);
  const records = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => {
    const match = line.match(/^([a-f0-9]{64})\s+[* ]?(.+)$/i);
    if (!match) throw new Error(`invalid SHA256SUMS record: ${line}`);
    return { digest: match[1].toLowerCase(), file: match[2].trim() };
  });
  return records;
}

export function verifyReleaseArchive({ bundle, checksumFile }) {
  const archive = assertReleaseDownload(bundle);
  if (!existsSync(archive)) throw new Error(`release bundle not found: ${archive}`);
  const checksums = resolve(checksumFile ?? join(resolve(archive, ".."), "SHA256SUMS"));
  const record = parseChecksums(checksums).find(({ file }) => file === basename(archive));
  if (!record) throw new Error(`SHA256SUMS does not contain ${basename(archive)}`);
  const archiveSha256 = sha256(archive);
  if (archiveSha256 !== record.digest) throw new Error(`release archive checksum mismatch for ${basename(archive)}`);
  return { archive, checksumFile: checksums, archiveSha256 };
}

export function createReleaseRehearsalPlan({ bundle, checksumFile, execute = false } = {}) {
  if (!bundle) throw new Error("--bundle <release archive> is required");
  const mode = execute ? "execute" : "dry-run";
  return {
    schemaVersion: 1,
    mode,
    source: { kind: "release-download", path: bundle, checksumFile: checksumFile ?? null },
    buildPolicy: "never-build-or-pull",
    noBuildNoPull: true,
    cleanup: { scope: "release-rehearsal-only", strategy: "delegated-compose-project-cleanup" },
    cleanHostEvidence: { windows: "external-required", linux: "external-required", native: "external-required" },
    scenarios: { offlineDocker: { status: execute ? "pending" : "planned" } },
    evidence: {
      schemaVersion: 1, sourceCommit: null, archiveSha256: null, manifestSha256: null,
      digestRefs: [], runtimeVersions: {}, scenarios: { offlineDocker: { status: execute ? "pending" : "planned" } },
      cleanup: { scope: "release-rehearsal-only", status: execute ? "pending" : "not-run" },
      noBuildNoPull: true, noPullPolicy: NO_PULL_POLICY,
      cleanHostEvidence: { windows: "external-required", linux: "external-required", native: "external-required" },
    },
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "pipe", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${(result.stderr || result.stdout || "").trim()}`);
  return (result.stdout || "").trim();
}

function safelyExtract(archive, destination) {
  const entries = run("tar", ["-tzf", archive]).split(/\r?\n/).filter(Boolean);
  if (!entries.length || entries.some((entry) => entry.startsWith("/") || entry.split(/[\\/]/).includes(".."))) throw new Error("release archive contains an unsafe path");
  const roots = [...new Set(entries.map((entry) => entry.split("/")[0]))];
  if (roots.length !== 1) throw new Error("release archive must contain one top-level bundle directory");
  run("tar", ["-xzf", archive, "-C", destination, "--no-same-owner", "--no-same-permissions"]);
  return join(destination, roots[0]);
}

function runtimeVersions() {
  let docker = "unavailable";
  try { docker = run("docker", ["version", "--format", "{{.Server.Version}}"]); } catch { /* evidence retains unavailable */ }
  return { node: process.version, platform: process.platform, docker };
}

export function executeReleaseRehearsal({ bundle, checksumFile, evidencePath }) {
  const verified = verifyReleaseArchive({ bundle, checksumFile }); // Must happen before tar extraction.
  const temp = mkdtempSync(join(tmpdir(), "archive-release-rehearsal-"));
  const plan = createReleaseRehearsalPlan({ bundle, checksumFile, execute: true });
  const output = resolve(evidencePath ?? join(process.cwd(), "release-rehearsal-evidence.json"));
  try {
    const extractedBundle = safelyExtract(verified.archive, temp);
    const verifier = join(extractedBundle, "verify-bundle.mjs");
    const rehearsal = join(root, "scripts", "offline-bundle.mjs");
    const compose = readFileSync(join(extractedBundle, "compose.v1.yml"), "utf8");
    if (!existsSync(verifier) || !compose.match(/pull_policy:\s*never/g)) throw new Error("release bundle does not prove no-pull verification prerequisites");
    run(process.execPath, [verifier, extractedBundle]);
    run(process.execPath, [rehearsal, "verify", extractedBundle]);
    run(process.execPath, [rehearsal, "rehearse", extractedBundle, output]);
    const manifestPath = join(extractedBundle, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const delegated = JSON.parse(readFileSync(output, "utf8"));
    const evidence = {
      ...plan.evidence, archiveSha256: verified.archiveSha256, manifestSha256: sha256(manifestPath),
      sourceCommit: manifest.sourceCommit, digestRefs: manifest.images.map(({ id, source }) => ({ id, source })),
      runtimeVersions: runtimeVersions(), scenarios: { offlineDocker: { status: "passed", delegated } },
      cleanup: { scope: "release-rehearsal-only", status: delegated.cleanup === true ? "passed" : "unknown", absence: delegated.cleanupAbsence },
      finishedAt: new Date().toISOString(), noBuildNoPull: true, noPullPolicy: NO_PULL_POLICY,
    };
    writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
    return evidence;
  } finally { rmSync(temp, { recursive: true, force: true }); }
}

function cli() {
  const args = process.argv.slice(2);
  const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
  const bundle = value("--bundle");
  const checksumFile = value("--checksums");
  const execute = args.includes("--execute");
  const evidencePath = value("--evidence");
  if (args.includes("--help") || !bundle) throw new Error("Usage: node scripts/release-rehearsal.mjs --bundle <release.tar.gz> [--checksums SHA256SUMS] [--execute --evidence evidence.json]");
  const plan = createReleaseRehearsalPlan({ bundle, checksumFile, execute });
  const verified = verifyReleaseArchive({ bundle, checksumFile });
  if (!execute) { process.stdout.write(`${JSON.stringify({ ...plan, verified }, null, 2)}\n`); return; }
  process.stdout.write(`${JSON.stringify(executeReleaseRehearsal({ bundle, checksumFile, evidencePath }), null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}` || process.argv[1]?.endsWith("release-rehearsal.mjs")) cli();
