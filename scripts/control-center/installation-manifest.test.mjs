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

function schemaAcceptsString(rule, value) {
  if (rule.type === "string" && typeof value !== "string") return false;
  if (rule.minLength !== undefined && value.length < rule.minLength) return false;
  if (rule.pattern && !(new RegExp(rule.pattern).test(value))) return false;
  for (const nested of rule.allOf || []) {
    if (nested.not?.pattern && new RegExp(nested.not.pattern).test(value)) return false;
  }
  return true;
}

function schemaAcceptsOptionalString(rule, value) {
  return rule.oneOf.some((candidate) => candidate.type === "null" ? value === null : schemaAcceptsString(candidate, value));
}

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
  for (const name of ["apiKey", "PRIVATEkey", "key"]) {
    assert.throws(
      () => manifest.createInstallationManifest({ path, input: safeInput({ dataPaths: { [name]: "/srv/archive-suite/storage" } }) }),
      /sensitive|credential|secret/i,
      `${name} must be rejected case-insensitively`,
    );
  }
  assert.throws(
    () => manifest.createInstallationManifest({ path, input: safeInput({ dataPaths: { storage: "archive:topsecret@example.test" } }) }),
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

  assert.deepEqual(manifest.decideInstallationResume({ path, input: safeInput() }), { action: "resume", after: "environment-ready", nextStep: "services-started" });
  const firstRepair = manifest.beginInstallationOperation({ path, input: safeInput(), operation: "repair" });
  const secondRepair = manifest.beginInstallationOperation({ path, input: safeInput(), operation: "repair" });
  assert.equal(firstRepair.created, false);
  assert.deepEqual(firstRepair.decision, { action: "resume", after: "environment-ready", nextStep: "services-started" });
  assert.equal(secondRepair.created, false);
  assert.equal(secondRepair.manifest.previousVersion, null);
  assert.equal(secondRepair.manifest.lastSuccessfulStep, "environment-ready");
  assert.equal(secondRepair.manifest.operation.status, "in-progress");
  assert.equal(existsSync(path), true);
});

test("installation manifest schema matches required safe runtime constraints", () => {
  const schema = JSON.parse(readFileSync(new URL("../../infra/setup/installation-manifest.v1.schema.json", import.meta.url), "utf8"));
  const { artifacts, dataPaths, lastSuccessfulStep, previousVersion, operation } = schema.properties;

  assert.deepEqual(artifacts.items.anyOf, [{ required: ["digest"] }, { required: ["checksum"] }]);
  assert.equal(dataPaths.minProperties, 1);
  assert.match(dataPaths.propertyNames.pattern, /\[Kk\]\[Ee\]\[Yy\]/);
  assert.equal(dataPaths.additionalProperties.allOf.length, 3, "schema must reject URLs, credential pairs, and secret-like values");
  assert.deepEqual(lastSuccessfulStep.oneOf, [{ type: "null" }, { type: "string", minLength: 1, pattern: "\\S" }]);
  assert.deepEqual(previousVersion.oneOf, [{ type: "null" }, { type: "string", minLength: 1, pattern: "\\S" }]);
  assert.deepEqual(operation.properties.failedStep.oneOf, [{ type: "null" }, { type: "string", minLength: 1, pattern: "\\S" }]);
});

test("schema and execution both reject whitespace-only manifest strings", async () => {
  const manifest = await loadManifest();
  assert.ok(manifest, "installation manifest module must exist");
  const schema = JSON.parse(readFileSync(new URL("../../infra/setup/installation-manifest.v1.schema.json", import.meta.url), "utf8"));
  const { artifacts, dataPaths, lastSuccessfulStep, previousVersion, operation } = schema.properties;
  const artifact = artifacts.items.properties;

  for (const [name, rule] of Object.entries({
    version: schema.properties.version,
    platform: schema.properties.platform,
    runtimeProfile: schema.properties.runtimeProfiles.items,
    capability: schema.properties.capabilities.items,
    service: schema.properties.services.items,
    nextAction: operation.properties.nextActions.items,
    id: artifact.id,
    digest: artifact.digest,
    checksum: artifact.checksum,
    dataPath: dataPaths.additionalProperties,
  })) assert.match(rule.pattern, /\\S/, `${name} schema must require a non-whitespace character`);
  assert.match(dataPaths.propertyNames.pattern, /\\S/, "data path names must require a non-whitespace character");

  for (const [name, rule] of Object.entries({ id: artifact.id, digest: artifact.digest, checksum: artifact.checksum, dataPath: dataPaths.additionalProperties })) {
    assert.equal(schemaAcceptsString(rule, "/srv/archive-suite/storage"), true, `${name} must allow real content`);
    assert.equal(schemaAcceptsString(rule, "  \t"), false, `${name} must reject whitespace`);
  }
  for (const [name, rule] of Object.entries({ lastSuccessfulStep, previousVersion, failedStep: operation.properties.failedStep })) {
    assert.equal(schemaAcceptsOptionalString(rule, null), true, `${name} must allow null`);
    assert.equal(schemaAcceptsOptionalString(rule, "services-started"), true, `${name} must allow a real step`);
    assert.equal(schemaAcceptsOptionalString(rule, " \n"), false, `${name} must reject whitespace`);
  }

  const dir = mkdtempSync(join(tmpdir(), "archive-manifest-whitespace-"));
  const path = join(dir, "installation-manifest.json");
  for (const input of [
    safeInput({ artifacts: [{ id: "  ", digest: "sha256:abc123" }] }),
    safeInput({ artifacts: [{ id: "next", digest: "  " }] }),
    safeInput({ artifacts: [{ id: "next", checksum: "\t" }] }),
    safeInput({ dataPaths: { storage: "  " } }),
    safeInput({ dataPaths: { " ": "/srv/archive-suite/storage" } }),
  ]) assert.throws(() => manifest.createInstallationManifest({ path, input }), /non-empty/i);

  const safe = manifest.createInstallationManifest({ path, input: safeInput() }).manifest;
  for (const field of ["lastSuccessfulStep", "previousVersion"]) {
    writeFileSync(path, JSON.stringify({ ...safe, [field]: "  " }));
    assert.throws(() => manifest.readInstallationManifest(path), /non-empty/i);
  }
  writeFileSync(path, JSON.stringify({ ...safe, operation: { ...safe.operation, failedStep: "\t" } }));
  assert.throws(() => manifest.readInstallationManifest(path), /non-empty/i);
});

test("installation manifest rejects sensitive operation and version metadata already on disk", async () => {
  const manifest = await loadManifest();
  assert.ok(manifest, "installation manifest module must exist");
  const dir = mkdtempSync(join(tmpdir(), "archive-manifest-sensitive-state-"));
  const path = join(dir, "installation-manifest.json");
  const safe = manifest.createInstallationManifest({ path, input: safeInput() }).manifest;

  writeFileSync(path, JSON.stringify({ ...safe, previousVersion: "topsecret" }));
  assert.throws(() => manifest.readInstallationManifest(path), /sensitive|credential|secret/i);
  writeFileSync(path, JSON.stringify(safe));
  assert.throws(
    () => manifest.markInstallationFailed({ path, failedStep: "secret-step", nextActions: ["Run repair."] }),
    /sensitive|credential|secret/i,
  );
});

test("operation.type accepts update and rollback, and both schema and execution stay in sync", async () => {
  const manifest = await loadManifest();
  assert.ok(manifest, "installation manifest module must exist");
  const dir = mkdtempSync(join(tmpdir(), "archive-manifest-update-type-"));
  const path = join(dir, "installation-manifest.json");
  manifest.createInstallationManifest({ path, input: safeInput() });

  const updated = manifest.beginOperation({ path, type: "update" });
  assert.equal(updated.operation.type, "update");
  assert.equal(updated.operation.status, "in-progress");
  assert.deepEqual(manifest.readInstallationManifest(path), updated);

  const schema = JSON.parse(readFileSync(new URL("../../infra/setup/installation-manifest.v1.schema.json", import.meta.url), "utf8"));
  assert.deepEqual(schema.properties.operation.properties.type.enum, ["install", "repair", "update", "rollback"]);

  assert.throws(() => manifest.beginOperation({ path, type: "install" }), /operation must be update or rollback/i);
  assert.throws(() => manifest.beginOperation({ path: join(dir, "missing.json"), type: "update" }), /does not exist/i);
});

test("completeUpdateOperation atomically records the new version and sets previousVersion, never regressing it to null", async () => {
  const manifest = await loadManifest();
  assert.ok(manifest, "installation manifest module must exist");
  const dir = mkdtempSync(join(tmpdir(), "archive-manifest-complete-update-"));
  const path = join(dir, "installation-manifest.json");
  manifest.createInstallationManifest({ path, input: safeInput({ version: "1.0.0" }) });
  manifest.beginOperation({ path, type: "update" });
  manifest.updateLastSuccessfulStep({ path, step: "preflight-verified" });

  const next = manifest.completeUpdateOperation({
    path,
    input: safeInput({ version: "1.1.0", artifacts: [{ id: "next", digest: "sha256:def456" }] }),
    previousVersion: "1.0.0",
    step: "health-verified",
  });

  assert.equal(next.version, "1.1.0");
  assert.equal(next.previousVersion, "1.0.0");
  assert.equal(next.lastSuccessfulStep, "health-verified");
  assert.equal(next.operation.type, "update");
  assert.equal(next.operation.status, "succeeded");
  assert.deepEqual(manifest.readInstallationManifest(path), next);

  // A second update must not regress previousVersion back to null, and must
  // move it forward to the version that was actually just replaced.
  manifest.beginOperation({ path, type: "update" });
  const second = manifest.completeUpdateOperation({
    path,
    input: safeInput({ version: "1.2.0", artifacts: [{ id: "next", digest: "sha256:aaa111" }] }),
    previousVersion: "1.1.0",
    step: "health-verified",
  });
  assert.equal(second.version, "1.2.0");
  assert.equal(second.previousVersion, "1.1.0");

  assert.throws(() => manifest.completeUpdateOperation({ path: join(dir, "missing.json"), input: safeInput(), previousVersion: "1.0.0", step: "health-verified" }), /does not exist/i);
});

test("update manifest records a safe target while in progress and a complete previous release reference after success", async () => {
  const manifest = await loadManifest();
  assert.ok(manifest, "installation manifest module must exist");
  const dir = mkdtempSync(join(tmpdir(), "archive-manifest-update-reference-"));
  const path = join(dir, "installation-manifest.json");
  const oldInput = safeInput({ version: "1.0.0", releaseEnvironment: { ARCHIVE_RELEASE_PULL_POLICY: "missing", ARCHIVE_RELEASE_IMAGE_NEXT: "registry/archive-next:1.0.0@sha256:abc" } });
  const targetInput = safeInput({ version: "1.1.0", releaseEnvironment: { ARCHIVE_RELEASE_PULL_POLICY: "missing", ARCHIVE_RELEASE_IMAGE_NEXT: "registry/archive-next:1.1.0@sha256:def" } });
  manifest.createInstallationManifest({ path, input: oldInput });

  const started = manifest.beginOperation({ path, type: "update", target: targetInput });
  assert.equal(started.operation.target.version, "1.1.0");
  assert.equal(started.version, "1.0.0", "the active release remains the old release until success");

  const completed = manifest.completeUpdateOperation({ path, input: targetInput, previousVersion: "1.0.0", step: "role-smoke-verified" });
  assert.equal(completed.version, "1.1.0");
  assert.equal(completed.previousRelease.version, "1.0.0");
  assert.equal(completed.previousRelease.releaseEnvironment.ARCHIVE_RELEASE_IMAGE_NEXT, oldInput.releaseEnvironment.ARCHIVE_RELEASE_IMAGE_NEXT);
});

test("an unfamiliar lastSuccessfulStep (left by a failed update) forces a full repair instead of a bogus install resume", async () => {
  const manifest = await loadManifest();
  assert.ok(manifest, "installation manifest module must exist");
  const dir = mkdtempSync(join(tmpdir(), "archive-manifest-unknown-step-"));
  const path = join(dir, "installation-manifest.json");
  manifest.createInstallationManifest({ path, input: safeInput() });
  manifest.beginOperation({ path, type: "update" });
  manifest.updateLastSuccessfulStep({ path, step: "migrated" }); // update-vocabulary step, unknown to INSTALLATION_STEPS
  manifest.markInstallationFailed({ path, failedStep: "switched", nextActions: ["Run setup status."] });

  const decision = manifest.decideInstallationResume({ path, input: safeInput() });
  assert.deepEqual(decision, { action: "repair", reason: "unknown-successful-step" });
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
