import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";

import { restoreBackup } from "../src/backup/backupScheduler.js";

import {
  writeBackupChecksum,
  verifyBackupChecksum,
  encryptBuffer,
  decryptBuffer,
  encryptBackupFile,
  decryptBackupFile,
} from "../src/backup/backupCrypto.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let failures = 0;
function run(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); });
}

/** Create a unique temp dir for this test run. */
function makeTmpDir() {
  const dir = join(tmpdir(), `archive-backup-test-${randomBytes(4).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Write a small fake backup file and return its path. */
function writeFakeBackup(dir, content = '{"hello":"world"}') {
  const fp = join(dir, `backup-test-${randomBytes(4).toString("hex")}.json.gz`);
  writeFileSync(fp, content);
  return fp;
}

const PASSPHRASE = "test-passphrase-do-not-use-in-production";

// ---------------------------------------------------------------------------
// Checksum tests
// ---------------------------------------------------------------------------

run("writeBackupChecksum: creates .sha256 file next to backup", async () => {
  const dir = makeTmpDir();
  try {
    const fp = writeFakeBackup(dir);
    const { checksumFile, hex } = writeBackupChecksum(fp);
    assert.equal(checksumFile, `${fp}.sha256`);
    assert.match(hex, /^[0-9a-f]{64}$/);
    assert.ok(existsSync(checksumFile), ".sha256 file must exist");
    const contents = readFileSync(checksumFile, "utf8");
    // Standard sha256sum format: "<hex>  <filename>\n"
    assert.ok(contents.startsWith(hex), "checksum file must start with hex");
    assert.ok(contents.includes("  backup-test-"), "checksum file must contain filename");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

run("verifyBackupChecksum: passes for unmodified file", async () => {
  const dir = makeTmpDir();
  try {
    const fp = writeFakeBackup(dir, "pristine content");
    writeBackupChecksum(fp);
    const result = verifyBackupChecksum(fp);
    assert.equal(result.ok, true);
    assert.equal(result.actual, result.expected);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

run("verifyBackupChecksum: fails after a byte is flipped (tamper detection)", async () => {
  const dir = makeTmpDir();
  try {
    const fp = writeFakeBackup(dir, "original data 12345");
    writeBackupChecksum(fp);

    // Flip a byte in the backup file.
    const data = Buffer.from(readFileSync(fp));
    data[0] = data[0] ^ 0xff;
    writeFileSync(fp, data);

    const result = verifyBackupChecksum(fp);
    assert.equal(result.ok, false, "tampered file must fail checksum");
    assert.notEqual(result.actual, result.expected);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

run("writeBackupChecksum: rejects empty filePath", async () => {
  assert.throws(() => writeBackupChecksum(""), /non-empty string/);
});

run("verifyBackupChecksum: rejects empty filePath", async () => {
  assert.throws(() => verifyBackupChecksum(""), /non-empty string/);
});

// ---------------------------------------------------------------------------
// Encryption / decryption (Buffer-level)
// ---------------------------------------------------------------------------

run("encryptBuffer / decryptBuffer: round-trip restores plaintext", async () => {
  const plaintext = Buffer.from("sensitive backup data — صورة احتياطية");
  const enc = encryptBuffer(plaintext, PASSPHRASE);

  // Verify layout: at least 64-byte header + ciphertext length equals plaintext length.
  assert.ok(enc.length >= 64 + plaintext.length, "encrypted buffer must be at least 64 bytes longer than plaintext");

  // Magic header "ARCE"
  assert.equal(enc.slice(0, 4).toString("ascii"), "ARCE");

  const decrypted = decryptBuffer(enc, PASSPHRASE);
  assert.deepEqual(decrypted, plaintext);
});

run("decryptBuffer: wrong passphrase throws a clear error", async () => {
  const plaintext = Buffer.from("secret payload");
  const enc = encryptBuffer(plaintext, PASSPHRASE);
  assert.throws(
    () => decryptBuffer(enc, "wrong-passphrase"),
    /decryption failed/
  );
});

run("decryptBuffer: rejects corrupted ciphertext (bit-flip)", async () => {
  const plaintext = Buffer.from("data to protect");
  const enc = Buffer.from(encryptBuffer(plaintext, PASSPHRASE));
  // Flip the last byte of the ciphertext (after the 64-byte header).
  enc[enc.length - 1] ^= 0x01;
  assert.throws(() => decryptBuffer(enc, PASSPHRASE), /decryption failed/);
});

run("decryptBuffer: rejects data with wrong magic header", async () => {
  const bad = Buffer.alloc(80, 0xcc);
  assert.throws(() => decryptBuffer(bad, PASSPHRASE), /magic header/i);
});

run("decryptBuffer: rejects data that is too short", async () => {
  const short = Buffer.alloc(32, 0);
  assert.throws(() => decryptBuffer(short, PASSPHRASE), /too short/);
});

run("encryptBuffer: each call produces a different ciphertext (random IV + salt)", async () => {
  const plaintext = Buffer.from("repeatable input");
  const enc1 = encryptBuffer(plaintext, PASSPHRASE);
  const enc2 = encryptBuffer(plaintext, PASSPHRASE);
  assert.notEqual(enc1.toString("hex"), enc2.toString("hex"), "salt and IV must be random per call");
});

run("encryptBuffer: rejects non-Buffer plaintext", async () => {
  assert.throws(() => encryptBuffer("string not buffer", PASSPHRASE), /Buffer/);
});

// ---------------------------------------------------------------------------
// File-level encryption / decryption
// ---------------------------------------------------------------------------

run("encryptBackupFile / decryptBackupFile: file round-trip", async () => {
  const dir = makeTmpDir();
  try {
    const original = "backup content for file test";
    const fp = writeFakeBackup(dir, original);
    const { encPath } = encryptBackupFile(fp, PASSPHRASE);

    assert.ok(existsSync(encPath), ".enc file must exist");
    // encryptBackupFile only writes the .enc; the caller (runBackup in the
    // scheduler) is responsible for removing the plaintext.
    assert.equal(encPath, `${fp}.enc`, "encPath must be <original>.enc");

    const decrypted = decryptBackupFile(encPath, PASSPHRASE);
    assert.equal(decrypted.toString(), original);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

run("decryptBackupFile: wrong passphrase throws clearly", async () => {
  const dir = makeTmpDir();
  try {
    const fp = writeFakeBackup(dir, "some data");
    const { encPath } = encryptBackupFile(fp, PASSPHRASE);
    assert.throws(
      () => decryptBackupFile(encPath, "not-the-right-key"),
      /decryption failed/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

run("decryptBackupFile: rejects empty filePath", async () => {
  assert.throws(() => decryptBackupFile("", PASSPHRASE), /non-empty string/);
});

run("decryptBackupFile: rejects empty passphrase", async () => {
  assert.throws(() => decryptBackupFile("somefile.enc", ""), /non-empty string/);
});

// ---------------------------------------------------------------------------
// Checksum over encrypted artifact
// ---------------------------------------------------------------------------

run("checksum over .enc file: write + verify roundtrip", async () => {
  const dir = makeTmpDir();
  try {
    const fp = writeFakeBackup(dir, "data to encrypt then checksum");
    const { encPath } = encryptBackupFile(fp, PASSPHRASE);
    const { hex } = writeBackupChecksum(encPath);
    assert.match(hex, /^[0-9a-f]{64}$/);
    const result = verifyBackupChecksum(encPath);
    assert.equal(result.ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// restoreBackup (checksum verify → decrypt → gunzip → replaceAll)
// ---------------------------------------------------------------------------

function makeFakeProvider() {
  const calls = [];
  return {
    calls,
    async replaceAll(snapshot) {
      calls.push(snapshot);
      return { videoItems: (snapshot.videoItems || []).length };
    }
  };
}

function writeGzBackup(dir, snapshot) {
  const name = `backup-test-${randomBytes(4).toString("hex")}.json.gz`;
  const fp = join(dir, name);
  writeFileSync(fp, gzipSync(Buffer.from(JSON.stringify(snapshot), "utf8")));
  return { fp, name };
}

run("restoreBackup: plaintext gz round-trip applies replaceAll", async () => {
  const dir = makeTmpDir();
  try {
    const snapshot = { version: "2.0", videoItems: [{ id: "v1" }, { id: "v2" }] };
    const { fp, name } = writeGzBackup(dir, snapshot);
    writeBackupChecksum(fp);
    const provider = makeFakeProvider();
    const result = await restoreBackup(provider, name, { dir });
    assert.equal(provider.calls.length, 1);
    assert.deepEqual(provider.calls[0], snapshot);
    assert.equal(result.counts.videoItems, 2);
    assert.equal(result.filename, name);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

run("restoreBackup: encrypted backup restores with the right passphrase", async () => {
  const dir = makeTmpDir();
  try {
    const snapshot = { version: "2.0", videoItems: [{ id: "enc-1" }] };
    const { fp, name } = writeGzBackup(dir, snapshot);
    const { encPath } = encryptBackupFile(fp, PASSPHRASE);
    rmSync(fp);
    writeBackupChecksum(encPath);
    const provider = makeFakeProvider();
    const result = await restoreBackup(provider, `${name}.enc`, { dir, passphrase: PASSPHRASE });
    assert.deepEqual(provider.calls[0], snapshot);
    assert.equal(result.counts.videoItems, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

run("restoreBackup: wrong passphrase rejects with 400 and never touches data", async () => {
  const dir = makeTmpDir();
  try {
    const { fp, name } = writeGzBackup(dir, { videoItems: [] });
    const { encPath } = encryptBackupFile(fp, PASSPHRASE);
    rmSync(fp);
    writeBackupChecksum(encPath);
    const provider = makeFakeProvider();
    await assert.rejects(
      () => restoreBackup(provider, `${name}.enc`, { dir, passphrase: "wrong" }),
      (err) => err.statusCode === 400
    );
    assert.equal(provider.calls.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

run("restoreBackup: missing passphrase for .enc rejects with 400", async () => {
  const dir = makeTmpDir();
  try {
    const { fp, name } = writeGzBackup(dir, { videoItems: [] });
    const { encPath } = encryptBackupFile(fp, PASSPHRASE);
    rmSync(fp);
    writeBackupChecksum(encPath);
    await assert.rejects(
      () => restoreBackup(makeFakeProvider(), `${name}.enc`, { dir }),
      (err) => err.statusCode === 400 && /مشفّرة/.test(err.message)
    );
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

run("restoreBackup: checksum mismatch rejects with 409 and never touches data", async () => {
  const dir = makeTmpDir();
  try {
    const { fp, name } = writeGzBackup(dir, { videoItems: [{ id: "v1" }] });
    writeBackupChecksum(fp);
    // Corrupt the artifact after the checksum was written.
    writeFileSync(fp, gzipSync(Buffer.from('{"tampered":true}', "utf8")));
    const provider = makeFakeProvider();
    await assert.rejects(
      () => restoreBackup(provider, name, { dir }),
      (err) => err.statusCode === 409
    );
    assert.equal(provider.calls.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

run("restoreBackup: rejects traversal / non-backup filenames with 400", async () => {
  const dir = makeTmpDir();
  try {
    for (const bad of ["../../etc/passwd", "backup-..\\x.json.gz", "notes.txt", "backup-a.json.gz.enc.exe"]) {
      await assert.rejects(
        () => restoreBackup(makeFakeProvider(), bad, { dir }),
        (err) => err.statusCode === 400
      );
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

process.on("beforeExit", () => {
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  } else {
    console.log("\nAll backup encryption + integrity tests passed.");
  }
});
