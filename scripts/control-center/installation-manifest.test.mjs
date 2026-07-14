import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const modulePath = "./installation-manifest.mjs";
const loadManifest = async () => import(modulePath).catch(() => null);

const safeInput = (overrides = {}) => ({
  version: "1.2.3",
  source: "offline",
  mode: "docker",
  platform: "linux-docker",
  runtimeProfiles: ["core", "media"],
  capabilities: ["ocr"],
  artifacts: [{ id: "next", digest: "sha256:abc123" }],
  services: ["postgres", "redis", "next", "ocr"],
  dataPaths: { storage: "/srv/archive-suite/storage", postgres: "/srv/archive-suite/postgres" },
  ...overrides,
});

test("installation manifest creates the exact safe resumable record", async () => {
  const manifest = await loadManifest();
  assert.ok(manifest, "installation manifest module must exist");
  const dir = mkdtempSync(join(tmpdir(), "archive-manifest-"));
  const path = join(dir, "installation-manifest.json");

  const result = manifest.createInstallationManifest({ path, input: safeInput() });

  assert.equal(result.created, true);
  assert.deepEqual(Object.keys(result.manifest), [
    "schemaVersion", "version", "source", "mode", "platform", "runtimeProfiles", "capabilities",
    "artifacts", "services", "dataPaths", "lastSuccessfulStep", "previousVersion", "operation",
  ]);
  assert.equal(result.manifest.lastSuccessfulStep, null);
  assert.equal(result.manifest.previousVersion, null);
  assert.equal(result.manifest.operation.status, "in-progress");
  assert.deepEqual(manifest.readInstallationManifest(path), result.manifest);
});

test("installation manifest rejects secrets and never writes their values", async () => {
  const manifest = await loadManifest();
  assert.ok(manifest, "installation manifest module must exist");
  const dir = mkdtempSync(join(tmpdir(), "archive-manifest-sensitive-"));
  const path = join(dir, "installation-manifest.json");

  assert.throws(
    () => manifest.createInstallationManifest({ path, input: safeInput({ dataPaths: { storage: "https://archive:topsecret@example.test/storage" } }) }),
    /sensitive|credential|secret/i,
  );
  assert.equal(existsSync(path), false);
  assert.throws(
    () => manifest.createInstallationManifest({ path, input: safeInput({ artifacts: [{ id: "next", token: "topsecret" }] }) }),
    /sensitive|credential|secret/i,
  );
  assert.equal(existsSync(path), false);
});

test("installation manifest writes atomically and retains a valid prior JSON when replacement fails", async () => {
  const manifest = await loadManifest();
  assert.ok(manifest, "installation manifest module must exist");
  const dir = mkdtempSync(join(tmpdir(), "archive-manifest-atomic-"));
  const path = join(dir, "installation-manifest.json");
  const initial = manifest.createInstallationManifest({ path, input: safeInput() }).manifest;
  const fs = {
    ...manifest.nodeFs,
    renameSync: () => { throw new Error("disk full"); },
  };

  assert.throws(() => manifest.updateLastSuccessfulStep({ path, step: "services-started", fs }), /disk full/);
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), initial);
});

test("installation manifest resumes after failure and repair is idempotent", async () => {
  const manifest = await loadManifest();
  assert.ok(manifest, "installation manifest module must exist");
  const dir = mkdtempSync(join(tmpdir(), "archive-manifest-resume-"));
  const path = join(dir, "installation-manifest.json");
  manifest.createInstallationManifest({ path, input: safeInput() });
  manifest.updateLastSuccessfulStep({ path, step: "environment-ready" });
  manifest.markInstallationFailed({ path, failedStep: "services-start", nextActions: ["Check Docker and run repair."] });

  assert.deepEqual(manifest.decideInstallationResume({ path, input: safeInput() }), { action: "resume", step: "environment-ready" });
  const firstRepair = manifest.beginInstallationOperation({ path, input: safeInput(), operation: "repair" });
  const secondRepair = manifest.beginInstallationOperation({ path, input: safeInput(), operation: "repair" });
  assert.equal(firstRepair.created, false);
  assert.equal(secondRepair.created, false);
  assert.equal(secondRepair.manifest.previousVersion, null);
  assert.equal(secondRepair.manifest.lastSuccessfulStep, "environment-ready");
  assert.equal(secondRepair.manifest.operation.status, "in-progress");
  assert.equal(existsSync(path), true);
});

test("malformed manifest is never overwritten during a resume decision", async () => {
  const manifest = await loadManifest();
  assert.ok(manifest, "installation manifest module must exist");
  const dir = mkdtempSync(join(tmpdir(), "archive-manifest-invalid-"));
  const path = join(dir, "installation-manifest.json");
  writeFileSync(path, "{not valid json");

  assert.throws(() => manifest.decideInstallationResume({ path, input: safeInput() }), /valid JSON/i);
  assert.equal(readFileSync(path, "utf8"), "{not valid json");
});
