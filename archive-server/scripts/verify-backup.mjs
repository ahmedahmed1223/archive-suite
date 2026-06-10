import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
