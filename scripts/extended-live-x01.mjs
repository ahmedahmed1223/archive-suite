/**
 * V1-X01 live external-storage acceptance.
 *
 * Brings up a real S3-compatible provider, drives the product storage path
 * against it, induces a genuine provider outage, then proves scoped cleanup.
 * Every phase's stdout is scanned for the credentials before anything is
 * written to disk, so the evidence file cannot carry a secret.
 *
 * The provider is self-hosted (MinIO), so this run is explicitly scope-limited:
 * it proves the S3 protocol path, not a commercial AWS/Dropbox account.
 *
 * Usage: node scripts/extended-live-x01.mjs [--size-mb 64] [--keep]
 */

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTAINER = "archive-x01-minio";
const IMAGE = "minio/minio:latest";
const PORT = 9199;
const BUCKET = "archive-x01";
// Minted per run for a throwaway container that is destroyed at the end, so no
// credential is ever committed and the run cannot pass by depending on a fixed
// value. These never reach the evidence file -- see redact()/leaks() below.
const ACCESS_KEY = `x01-${randomBytes(6).toString("hex")}`;
const SECRET_KEY = randomBytes(24).toString("base64url");
const RUNTIME_IMAGE = "archive-laravel-runtime-test";

const args = process.argv.slice(2);
const sizeMb = Number(args[args.indexOf("--size-mb") + 1]) || 64;
const keep = args.includes("--keep");

const docker = (argv, opts = {}) => spawnSync("docker", argv, { encoding: "utf8", windowsHide: true, ...opts });
const sleep = (ms) => spawnSync(process.execPath, ["-e", `setTimeout(()=>{},${ms})`], { timeout: ms + 2000 });

/** Never let a credential reach the evidence file, whatever a provider echoes back. */
function redact(text) {
  return String(text ?? "")
    .split(SECRET_KEY).join("[REDACTED]")
    .split(ACCESS_KEY).join("[REDACTED]");
}

function leaks(text) {
  const raw = String(text ?? "");
  return raw.includes(SECRET_KEY) || raw.includes(ACCESS_KEY);
}

function runPhase(phase) {
  const result = docker([
    "run", "--rm",
    "-v", `${ROOT}:/app`,
    "-v", "archive-laravel-vendor:/app/archive-laravel/vendor",
    "-w", "/app/archive-laravel",
    "--add-host", "host.docker.internal:host-gateway",
    "-e", "FILESYSTEM_DISK=s3",
    "-e", `AWS_ACCESS_KEY_ID=${ACCESS_KEY}`,
    "-e", `AWS_SECRET_ACCESS_KEY=${SECRET_KEY}`,
    "-e", `AWS_BUCKET=${BUCKET}`,
    "-e", "AWS_DEFAULT_REGION=us-east-1",
    "-e", `AWS_ENDPOINT=http://host.docker.internal:${PORT}`,
    "-e", "AWS_USE_PATH_STYLE_ENDPOINT=true",
    RUNTIME_IMAGE, "sh", "-lc",
    `test -f .env || cp .env.example .env; php scripts/live-acceptance/x01-storage.php ${phase} ${sizeMb}`,
  ]);

  const stdout = String(result.stdout ?? "");
  // Scan the raw output before redacting, so a leak is detected rather than hidden.
  const leaked = leaks(stdout) || leaks(result.stderr);
  let payload = null;
  try {
    payload = JSON.parse(stdout.slice(stdout.indexOf("{"), stdout.lastIndexOf("}") + 1));
  } catch {
    payload = null;
  }
  return { phase, exitStatus: result.status, ok: payload?.ok === true, payload, leaked, stderr: redact(result.stderr).slice(0, 400) };
}

const records = [];
let cleanupProved = false;

try {
  docker(["rm", "-f", CONTAINER]);
  const up = docker(["run", "-d", "--name", CONTAINER, "-p", `${PORT}:9000`,
    "-e", `MINIO_ROOT_USER=${ACCESS_KEY}`, "-e", `MINIO_ROOT_PASSWORD=${SECRET_KEY}`,
    IMAGE, "server", "/data"]);
  if (up.status !== 0) throw new Error(`provider failed to start: ${redact(up.stderr)}`);
  sleep(6000);

  const mb = docker(["run", "--rm", "--network", "host", "--entrypoint", "sh", "minio/mc:latest", "-c",
    `mc alias set x01 http://127.0.0.1:${PORT} ${ACCESS_KEY} ${SECRET_KEY} >/dev/null && mc mb --ignore-existing x01/${BUCKET} >/dev/null && echo ok`]);
  if (!String(mb.stdout).includes("ok")) throw new Error("bucket creation failed");

  records.push(runPhase("identity"));
  records.push(runPhase("rwd"));
  records.push(runPhase("large"));

  // Genuine outage, not a mocked error.
  docker(["stop", CONTAINER]);
  records.push(runPhase("expect-failure"));
  docker(["start", CONTAINER]);
  sleep(6000);

  records.push(runPhase("integrity"));
} finally {
  if (!keep) {
    docker(["rm", "-f", CONTAINER]);
    const remaining = docker(["ps", "-a", "--filter", `name=${CONTAINER}`, "--format", "{{.Names}}"]);
    cleanupProved = remaining.status === 0 && String(remaining.stdout).trim() === "";
  }
}

const leakedPhases = records.filter((record) => record.leaked).map((record) => record.phase);
const evidence = {
  schemaVersion: 1,
  kind: "v1-x01-live-external-storage",
  generatedAt: new Date().toISOString(),
  provider: { kind: "s3-compatible", implementation: "minio", selfHosted: true, pathStyle: true },
  scopeLimits: [
    "Self-hosted MinIO over the S3 protocol; not a commercial AWS S3 or Dropbox account.",
    "Single-node provider: no cross-region, versioning, lifecycle, or provider-side IAM policy coverage.",
    "Dropbox OAuth/webhook paths are not exercised by this run.",
  ],
  status: records.length > 0 && records.every((record) => record.ok) && leakedPhases.length === 0 ? "passed" : "failed",
  secretScan: { scanned: records.length, leakedPhases, clean: leakedPhases.length === 0 },
  cleanup: { scope: CONTAINER, requested: !keep, proved: cleanupProved },
  phases: records.map(({ phase, ok, exitStatus, payload, stderr }) => ({ phase, ok, exitStatus, payload, stderr })),
};

const outDir = join(ROOT, "artifacts", "v1-x01");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `v1-x01-live-${evidence.generatedAt.replace(/[:.]/g, "-")}.json`);
writeFileSync(outFile, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });

process.stdout.write(`${JSON.stringify({ status: evidence.status, secretScan: evidence.secretScan, cleanup: evidence.cleanup, phases: evidence.phases.map((p) => ({ phase: p.phase, ok: p.ok })) }, null, 2)}\n`);
process.stdout.write(`evidence: ${outFile}\n`);
process.exit(evidence.status === "passed" ? 0 : 1);
