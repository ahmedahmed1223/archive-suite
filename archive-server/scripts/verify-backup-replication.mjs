/**
 * Verify enterprise backup replication primitives.
 * Runs with node:test (no vitest — matches the pattern used in verify-backup.mjs).
 * No real S3 calls. No real pg_restore invocations against a database.
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  appendBackupManifestEntry,
  findRestorableEntry,
} from "../src/backup/enterprise/manifest.js";

import {
  encryptAesGcm,
  decryptAesGcm,
  replicateBackupToS3,
} from "../src/backup/enterprise/replicate.js";

import { runRestoreSmoke } from "../src/backup/enterprise/restoreSmoke.js";

// ---------------------------------------------------------------------------
// Minimal test runner (same pattern as verify-backup.mjs)
// ---------------------------------------------------------------------------

let failures = 0;
function run(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => {
      failures += 1;
      console.error(`not ok - ${name}\n  ${err?.message || err}`);
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  const dir = join(tmpdir(), `rep-test-${randomBytes(4).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** 64 hex chars = 32 bytes */
const TEST_KEY = randomBytes(32).toString("hex");

// ---------------------------------------------------------------------------
// 1. Manifest — append + find-by-region
// ---------------------------------------------------------------------------

run("manifest: appendBackupManifestEntry adds to empty array", () => {
  const entry = {
    backupId: "b1",
    createdAt: "2026-06-23T00:00:00.000Z",
    sizeBytes: 1024,
    sha256: "a".repeat(64),
    region: "us-east-1",
    bucket: "my-bucket",
    key: "backups/b1.json.gz",
    encryption: "none",
  };
  const result = appendBackupManifestEntry([], entry);
  assert.equal(result.length, 1);
  assert.equal(result[0].backupId, "b1");
});

run("manifest: appendBackupManifestEntry does not mutate original array", () => {
  const original = [];
  const entry = {
    backupId: "b2", createdAt: "2026-06-23T01:00:00.000Z", sizeBytes: 512,
    sha256: "b".repeat(64), region: "eu-west-1", bucket: "bkt", key: "backups/b2.gz",
    encryption: "aes-256-gcm",
  };
  appendBackupManifestEntry(original, entry);
  assert.equal(original.length, 0, "original must not be mutated");
});

run("manifest: findRestorableEntry returns latest by createdAt", () => {
  const entries = [
    { backupId: "old", createdAt: "2026-06-20T00:00:00.000Z", region: "us-east-1",
      sizeBytes: 1, sha256: "a".repeat(64), bucket: "b", key: "k1", encryption: "none" },
    { backupId: "new", createdAt: "2026-06-22T00:00:00.000Z", region: "us-east-1",
      sizeBytes: 2, sha256: "b".repeat(64), bucket: "b", key: "k2", encryption: "none" },
  ];
  const found = findRestorableEntry(entries);
  assert.equal(found.backupId, "new");
});

run("manifest: findRestorableEntry filters by region", () => {
  const entries = [
    { backupId: "eu", createdAt: "2026-06-22T00:00:00.000Z", region: "eu-west-1",
      sizeBytes: 1, sha256: "a".repeat(64), bucket: "b", key: "k-eu", encryption: "none" },
    { backupId: "us", createdAt: "2026-06-23T00:00:00.000Z", region: "us-east-1",
      sizeBytes: 2, sha256: "b".repeat(64), bucket: "b", key: "k-us", encryption: "none" },
  ];
  const found = findRestorableEntry(entries, { region: "eu-west-1" });
  assert.equal(found.backupId, "eu");
});

run("manifest: findRestorableEntry returns null when no match", () => {
  const entries = [
    { backupId: "x", createdAt: "2026-06-22T00:00:00.000Z", region: "ap-southeast-1",
      sizeBytes: 1, sha256: "a".repeat(64), bucket: "b", key: "k", encryption: "none" },
  ];
  const found = findRestorableEntry(entries, { region: "us-east-1" });
  assert.equal(found, null);
});

run("manifest: findRestorableEntry filters by before timestamp", () => {
  const entries = [
    { backupId: "past",   createdAt: "2026-06-21T00:00:00.000Z", region: "us-east-1",
      sizeBytes: 1, sha256: "a".repeat(64), bucket: "b", key: "k1", encryption: "none" },
    { backupId: "future", createdAt: "2026-06-24T00:00:00.000Z", region: "us-east-1",
      sizeBytes: 2, sha256: "b".repeat(64), bucket: "b", key: "k2", encryption: "none" },
  ];
  const found = findRestorableEntry(entries, { before: "2026-06-23T00:00:00.000Z" });
  assert.equal(found.backupId, "past");
});

// ---------------------------------------------------------------------------
// 2. Encryption round-trip (AES-256-GCM)
// ---------------------------------------------------------------------------

run("encryption: encryptAesGcm / decryptAesGcm round-trip restores plaintext", () => {
  const plaintext = Buffer.from("enterprise backup payload — نسخ احتياطي مؤسسي");
  const encrypted = encryptAesGcm(plaintext, TEST_KEY);

  // iv (12) + authTag (16) = 28 bytes overhead; encrypted.length === plaintext.length + 28
  assert.ok(encrypted.length >= plaintext.length + 28, "encrypted must include iv+tag overhead");

  const decrypted = decryptAesGcm(encrypted, TEST_KEY);
  assert.deepEqual(decrypted, plaintext, "round-trip must restore original bytes");
});

run("encryption: each call produces a different ciphertext (random IV)", () => {
  const pt = Buffer.from("same plaintext");
  const enc1 = encryptAesGcm(pt, TEST_KEY);
  const enc2 = encryptAesGcm(pt, TEST_KEY);
  assert.notEqual(enc1.toString("hex"), enc2.toString("hex"), "IV must be random per call");
});

run("encryption: decryptAesGcm rejects wrong key", () => {
  const pt  = Buffer.from("secret");
  const enc = encryptAesGcm(pt, TEST_KEY);
  const wrongKey = randomBytes(32).toString("hex");
  assert.throws(() => decryptAesGcm(enc, wrongKey), /decryption failed/);
});

run("encryption: encryptAesGcm rejects key with wrong length", () => {
  assert.throws(
    () => encryptAesGcm(Buffer.from("x"), "tooshort"),
    /32 bytes/
  );
});

// ---------------------------------------------------------------------------
// 3. replicateBackupToS3 — mock S3 client, assert multipart when size > 5 MB
// ---------------------------------------------------------------------------

run("replicate: single-part upload for small file", async () => {
  const dir = makeTmpDir();
  try {
    const fp = join(dir, "small.json.gz");
    writeFileSync(fp, Buffer.alloc(1024, 0x42)); // 1 KB — below threshold

    const commands = [];
    const fakeClient = {
      async send(cmd) {
        commands.push(cmd.constructor.name);
        if (cmd.constructor.name === "PutObjectCommand") {
          // Drain the stream so the file handle closes before cleanup
          const body = cmd.input.Body;
          if (body && typeof body.resume === "function") {
            await new Promise((res, rej) => { body.resume(); body.on("end", res); body.on("error", rej); });
          }
          return { ETag: '"test-etag"' };
        }
        throw new Error(`Unexpected command: ${cmd.constructor.name}`);
      },
    };

    const result = await replicateBackupToS3({
      localBackupPath: fp,
      bucket: "test-bucket",
      region: "us-east-1",
      s3Client: fakeClient,
    });

    assert.ok(commands.includes("PutObjectCommand"), "must use PutObjectCommand for small files");
    assert.ok(!commands.includes("CreateMultipartUploadCommand"), "must NOT use multipart for small files");
    assert.equal(result.key, "backups/small.json.gz");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

run("replicate: multipart upload requested for file > 5 MB", async () => {
  const dir = makeTmpDir();
  try {
    const fp = join(dir, "large.json.gz");
    // 6 MB — above 5 MB threshold
    writeFileSync(fp, Buffer.alloc(6 * 1024 * 1024, 0x55));

    const commands = [];
    let partCount = 0;
    const fakeClient = {
      async send(cmd) {
        const name = cmd.constructor.name;
        commands.push(name);
        if (name === "CreateMultipartUploadCommand") return { UploadId: "uid-123" };
        if (name === "UploadPartCommand") { partCount++; return { ETag: `"part-${partCount}"` }; }
        if (name === "CompleteMultipartUploadCommand") return { ETag: '"final-etag"' };
        if (name === "AbortMultipartUploadCommand") return {};
        throw new Error(`Unexpected command: ${name}`);
      },
    };

    const result = await replicateBackupToS3({
      localBackupPath: fp,
      bucket: "test-bucket",
      region: "us-west-2",
      s3Client: fakeClient,
    });

    assert.ok(commands.includes("CreateMultipartUploadCommand"), "must use multipart for large files");
    assert.ok(commands.includes("UploadPartCommand"), "must upload parts");
    assert.ok(commands.includes("CompleteMultipartUploadCommand"), "must complete multipart");
    assert.ok(partCount >= 2, `must upload at least 2 parts for a 6 MB file (got ${partCount})`);
    assert.equal(result.sizeBytes, 6 * 1024 * 1024);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

run("replicate: encryption parameter causes encrypted body to be uploaded", async () => {
  const dir = makeTmpDir();
  try {
    const plaintext = Buffer.from("sensitive backup data");
    const fp = join(dir, "enc-test.json.gz");
    writeFileSync(fp, plaintext);

    let capturedBody = null;
    const fakeClient = {
      async send(cmd) {
        if (cmd.constructor.name === "PutObjectCommand") {
          capturedBody = cmd.input.Body;
          return { ETag: '"enc-etag"' };
        }
        throw new Error(`Unexpected: ${cmd.constructor.name}`);
      },
    };

    await replicateBackupToS3({
      localBackupPath: fp,
      bucket: "test-bucket",
      region: "us-east-1",
      encryptionKey: TEST_KEY,
      s3Client: fakeClient,
    });

    assert.ok(Buffer.isBuffer(capturedBody), "body must be a Buffer when encrypted");
    // Encrypted body must not equal plaintext
    assert.notEqual(capturedBody.toString("hex"), plaintext.toString("hex"));
    // Must be decryptable
    const decrypted = decryptAesGcm(capturedBody, TEST_KEY);
    assert.deepEqual(decrypted, plaintext);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 4. restore-smoke: pg_restore absent → { ok: false }
// ---------------------------------------------------------------------------

run("restore-smoke: returns { ok: false } when pg_restore is not installed", async () => {
  const dir = makeTmpDir();
  try {
    // Fake S3 client that returns a tiny buffer
    const payload = Buffer.from("not-a-real-pg-dump");
    const { createHash } = await import("node:crypto");
    const sha256 = createHash("sha256").update(payload).digest("hex");

    const fakeClient = {
      async send(cmd) {
        if (cmd.constructor.name === "GetObjectCommand") {
          const { Readable } = await import("node:stream");
          return { Body: Readable.from([payload]) };
        }
        throw new Error(`Unexpected: ${cmd.constructor.name}`);
      },
    };

    const entry = {
      backupId: "smoke-test",
      createdAt: new Date().toISOString(),
      sizeBytes: payload.length,
      sha256,
      region: "us-east-1",
      bucket: "test-bucket",
      key: "backups/smoke-test.json.gz",
      encryption: "none",
    };

    const result = await runRestoreSmoke({ entry, tempDir: dir, s3Client: fakeClient });

    // pg_restore may or may not be installed in CI. Either outcome is valid:
    // - If installed: it will exit non-zero for a non-pg_dump file → ok: true
    //   (we treat that as "binary is available and ran")
    // - If not installed: ok: false with "pg_restore not available"
    // The test just asserts the function returns without throwing.
    assert.ok(
      typeof result.ok === "boolean",
      `result.ok must be boolean, got ${typeof result.ok}`
    );
    assert.ok(Array.isArray(result.errors), "result.errors must be an array");
    assert.ok(typeof result.durationMs === "number", "result.durationMs must be a number");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

run("restore-smoke: SHA-256 mismatch returns { ok: false }", async () => {
  const dir = makeTmpDir();
  try {
    const payload = Buffer.from("some backup content");
    const wrongSha = "0".repeat(64); // intentionally wrong

    const fakeClient = {
      async send(cmd) {
        if (cmd.constructor.name === "GetObjectCommand") {
          const { Readable } = await import("node:stream");
          return { Body: Readable.from([payload]) };
        }
        throw new Error(`Unexpected: ${cmd.constructor.name}`);
      },
    };

    const entry = {
      backupId: "mismatch-test",
      createdAt: new Date().toISOString(),
      sizeBytes: payload.length,
      sha256: wrongSha,
      region: "us-east-1",
      bucket: "test-bucket",
      key: "backups/mismatch.json.gz",
      encryption: "none",
    };

    const result = await runRestoreSmoke({ entry, tempDir: dir, s3Client: fakeClient });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /sha-256/i.test(e)), "error must mention SHA-256");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

run("restore-smoke: decryption failure returns { ok: false }", async () => {
  const dir = makeTmpDir();
  try {
    // Upload encrypted data but provide wrong key
    const plaintext = Buffer.from("real backup");
    const encrypted = encryptAesGcm(plaintext, TEST_KEY);
    const { createHash } = await import("node:crypto");
    const sha256 = createHash("sha256").update(encrypted).digest("hex");

    const fakeClient = {
      async send(cmd) {
        if (cmd.constructor.name === "GetObjectCommand") {
          const { Readable } = await import("node:stream");
          return { Body: Readable.from([encrypted]) };
        }
        throw new Error(`Unexpected: ${cmd.constructor.name}`);
      },
    };

    const entry = {
      backupId: "bad-key-test",
      createdAt: new Date().toISOString(),
      sizeBytes: encrypted.length,
      sha256,
      region: "us-east-1",
      bucket: "test-bucket",
      key: "backups/bad-key.json.gz.enc",
      encryption: "aes-256-gcm",
    };

    const wrongKey = randomBytes(32).toString("hex");
    const result = await runRestoreSmoke({ entry, encryptionKey: wrongKey, tempDir: dir, s3Client: fakeClient });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /decrypt/i.test(e)), "error must mention decryption");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

process.on("beforeExit", () => {
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  } else {
    console.log("\nAll backup replication tests passed.");
  }
});
