import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createReleaseRehearsalPlan, verifyReleaseArchive } from "./release-rehearsal.mjs";

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

test("release rehearsal defaults to dry-run and records the external clean-host evidence boundary", () => {
  const plan = createReleaseRehearsalPlan({ bundle: "C:/downloads/archive-suite-offline-v1.0.0.tar.gz" });
  assert.equal(plan.mode, "dry-run");
  assert.equal(plan.source.kind, "release-download");
  assert.equal(plan.source.path, "C:/downloads/archive-suite-offline-v1.0.0.tar.gz");
  assert.equal(plan.cleanHostEvidence.windows, "external-required");
  assert.equal(plan.cleanHostEvidence.linux, "external-required");
  assert.equal(plan.cleanHostEvidence.native, "external-required");
  assert.equal(plan.scenarios.offlineDocker.status, "planned");
  assert.equal(plan.cleanup.scope, "release-rehearsal-only");
  assert.equal(plan.buildPolicy, "never-build-or-pull");
});

test("release rehearsal verifies the supplied top-level SHA256SUMS before extraction", () => {
  const dir = mkdtempSync(join(tmpdir(), "archive-release-rehearsal-"));
  try {
    const archive = join(dir, "archive-suite-offline-v1.0.0.tar.gz");
    writeFileSync(archive, "release bytes");
    writeFileSync(join(dir, "SHA256SUMS"), `${sha256(archive)}  ${archive.split(/[\\/]/).at(-1)}\n`);
    const verified = verifyReleaseArchive({ bundle: archive });
    assert.equal(verified.archiveSha256, sha256(archive));
    assert.equal(verified.checksumFile, join(dir, "SHA256SUMS"));
    assert.throws(() => verifyReleaseArchive({ bundle: archive, checksumFile: join(dir, "missing") }), /SHA256SUMS/i);
    writeFileSync(join(dir, "SHA256SUMS"), `${"0".repeat(64)}  ${archive.split(/[\\/]/).at(-1)}\n`);
    assert.throws(() => verifyReleaseArchive({ bundle: archive }), /checksum mismatch/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("release rehearsal evidence schema binds archive, manifest, digest references, runtime and scoped cleanup", () => {
  const plan = createReleaseRehearsalPlan({ bundle: "/releases/archive.tgz", execute: true });
  for (const field of ["archiveSha256", "manifestSha256", "sourceCommit", "digestRefs", "runtimeVersions", "scenarios", "cleanup", "noBuildNoPull"]) {
    assert.ok(field in plan.evidence, field);
  }
  assert.equal(plan.noBuildNoPull, true);
  assert.equal(plan.evidence.scenarios.offlineDocker.status, "pending");
});

test("implementation delegates only to the extracted bundle verifier and rehearsal, never workspace images", () => {
  const script = readFileSync(new URL("./release-rehearsal.mjs", import.meta.url), "utf8");
  assert.match(script, /offline-bundle\.mjs/);
  assert.match(script, /\[rehearsal, "verify", extractedBundle\]/);
  assert.match(script, /\[rehearsal, "rehearse", extractedBundle, output\]/);
  assert.match(script, /SHA256SUMS/);
  assert.match(script, /--pull\s+never/);
  assert.doesNotMatch(script, /docker\s+(?:pull|build|image\s+save)/);
});
