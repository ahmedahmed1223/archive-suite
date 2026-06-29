import { createHash, randomBytes, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { createLogger } from "../logger.js";

const log = createLogger("backup-crypto");

// ---------------------------------------------------------------------------
// .sha256 file format  (standard sha256sum format)
// ---------------------------------------------------------------------------
// One line: "<64 hex chars>  <filename>\n"
// Example:  "a3f1...64chars  backup-2026-06-10T12-00-00.json.gz\n"
// Verified with: sha256sum -c backup-2026-06-10T12-00-00.json.gz.sha256
//
// .enc file binary layout  (AES-256-GCM, scrypt key derivation)
// ---------------------------------------------------------------------------
// Offset  Length  Field
// ------  ------  -----
//   0       4     magic header: bytes [0x41, 0x52, 0x43, 0x45] = "ARCE"
//   4      32     scrypt salt (random per file)
//  36      12     AES-256-GCM IV / nonce (random per file)
//  48      16     GCM authTag (written after encryption)
//  64       N     ciphertext (N == plaintext length; GCM is length-preserving)
//
// Total header overhead: 64 bytes.
// Key derivation: scrypt(passphrase, salt, N=2^14, r=8, p=1) → 32 bytes.
// Never log the passphrase or derived key.
// ---------------------------------------------------------------------------

const MAGIC = Buffer.from([0x41, 0x52, 0x43, 0x45]); // "ARCE"
const MAGIC_LEN   = 4;
const SALT_LEN    = 32;
const IV_LEN      = 12;
const AUTH_TAG_LEN = 16;
const HEADER_LEN  = MAGIC_LEN + SALT_LEN + IV_LEN + AUTH_TAG_LEN; // 64 bytes

const SCRYPT_N = 16384; // 2^14 — balanced cost for backup-time (not hot path)
const SCRYPT_r = 8;
const SCRYPT_p = 1;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  if (typeof passphrase !== "string" || passphrase.length === 0) {
    throw new Error("BACKUP_ENCRYPTION_KEY passphrase must be a non-empty string.");
  }
  return scryptSync(passphrase, salt, 32, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p });
}

// ---------------------------------------------------------------------------
// Checksum
// ---------------------------------------------------------------------------

interface ChecksumResult {
  checksumFile: string;
  hex: string;
}

interface VerifyChecksumResult {
  ok: boolean;
  expected: string;
  actual: string;
}

export function writeBackupChecksum(filePath: string): ChecksumResult {
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new TypeError("writeBackupChecksum: filePath must be a non-empty string.");
  }
  const data   = readFileSync(filePath);
  const hex    = createHash("sha256").update(data).digest("hex");
  const name   = basename(filePath);
  const line   = `${hex}  ${name}\n`;
  const outPath = `${filePath}.sha256`;
  writeFileSync(outPath, line, "utf8");
  log.debug({ checksumFile: outPath }, "Checksum written.");
  return { checksumFile: outPath, hex };
}

export function verifyBackupChecksum(filePath: string): VerifyChecksumResult {
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new TypeError("verifyBackupChecksum: filePath must be a non-empty string.");
  }
  const checksumFile = `${filePath}.sha256`;
  const raw = readFileSync(checksumFile, "utf8");
  // Parse the first token of the first line (sha256sum format).
  const expected = raw.trim().split(/\s+/)[0];
  if (!/^[0-9a-f]{64}$/i.test(expected)) {
    throw new Error(`verifyBackupChecksum: malformed checksum in ${checksumFile}`);
  }
  const data   = readFileSync(filePath);
  const actual = createHash("sha256").update(data).digest("hex");
  const ok     = actual.toLowerCase() === expected.toLowerCase();
  return { ok, expected: expected.toLowerCase(), actual };
}

// ---------------------------------------------------------------------------
// Encryption / Decryption
// ---------------------------------------------------------------------------

export function encryptBuffer(plaintext: Buffer, passphrase: string): Buffer {
  if (!Buffer.isBuffer(plaintext)) {
    throw new TypeError("encryptBuffer: plaintext must be a Buffer.");
  }
  const salt   = randomBytes(SALT_LEN);
  const iv     = randomBytes(IV_LEN);
  const key    = deriveKey(passphrase, salt);

  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ct     = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag    = cipher.getAuthTag();

    return Buffer.concat([MAGIC, salt, iv, tag, ct]);
  } finally {
    // Overwrite key material in memory (best-effort; GC may have already
    // copied it, but we clear what we can).
    key.fill(0);
  }
}

export function decryptBuffer(encData: Buffer, passphrase: string): Buffer {
  if (!Buffer.isBuffer(encData)) {
    throw new TypeError("decryptBuffer: encData must be a Buffer.");
  }
  if (encData.length < HEADER_LEN) {
    throw new Error("decryptBuffer: data too short to be a valid .enc file.");
  }

  // Verify magic header.
  if (!encData.slice(0, MAGIC_LEN).equals(MAGIC)) {
    throw new Error('decryptBuffer: invalid magic header — not an ARCE encrypted backup.');
  }

  const salt   = encData.slice(MAGIC_LEN,                MAGIC_LEN + SALT_LEN);
  const iv     = encData.slice(MAGIC_LEN + SALT_LEN,      MAGIC_LEN + SALT_LEN + IV_LEN);
  const tag    = encData.slice(MAGIC_LEN + SALT_LEN + IV_LEN, HEADER_LEN);
  const ct     = encData.slice(HEADER_LEN);

  const key = deriveKey(passphrase, salt);

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch (err) {
    // Don't expose internal crypto details; re-throw with a clear message.
    throw new Error(`decryptBuffer: decryption failed — wrong passphrase or corrupted file. (${err instanceof Error ? err.message : String(err)})`);
  } finally {
    key.fill(0);
  }
}

interface EncryptFileResult {
  encPath: string;
}

export function encryptBackupFile(filePath: string, passphrase: string): EncryptFileResult {
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new TypeError("encryptBackupFile: filePath must be a non-empty string.");
  }
  const plaintext = readFileSync(filePath);
  const encData   = encryptBuffer(plaintext, passphrase);
  const encPath   = `${filePath}.enc`;
  writeFileSync(encPath, encData);
  log.debug({ encPath }, "Backup encrypted.");
  return { encPath };
}

export function decryptBackupFile(filePath: string, passphrase: string): Buffer {
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new TypeError("decryptBackupFile: filePath must be a non-empty string.");
  }
  if (typeof passphrase !== "string" || passphrase.length === 0) {
    throw new TypeError("decryptBackupFile: passphrase must be a non-empty string.");
  }
  const encData = readFileSync(filePath);
  return decryptBuffer(encData, passphrase);
}
