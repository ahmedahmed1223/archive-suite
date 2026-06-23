/**
 * Enterprise backup replication — streams a local backup file to S3.
 *
 * Supports:
 *   - Single-part upload for files ≤5 MB
 *   - Multipart upload for files >5 MB
 *   - Optional client-side AES-256-GCM encryption (node:crypto)
 *
 * Pass `s3Client` to inject a fake client in tests.
 */

import { createReadStream, statSync } from "node:fs";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { basename } from "node:path";
import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { createLogger } from "../../logger.js";

const log = createLogger("backup-replicate");

const AES_ALGO = "aes-256-gcm";
const IV_LEN   = 12; // 96-bit nonce
const TAG_LEN  = 16; // GCM auth tag
const KEY_LEN  = 32; // 256-bit key

const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5 MB
const PART_SIZE           = 5 * 1024 * 1024; // 5 MB per part

// ---------------------------------------------------------------------------
// Encryption helpers (exported for tests)
// ---------------------------------------------------------------------------

/**
 * Encrypt a Buffer with AES-256-GCM.
 * Binary layout: [iv (12 B)][authTag (16 B)][ciphertext]
 *
 * @param {Buffer} plaintext
 * @param {string} hexKey  32-byte key encoded as 64 hex chars
 * @returns {Buffer}
 */
export function encryptAesGcm(plaintext, hexKey) {
  const keyBuf = Buffer.from(hexKey, "hex");
  if (keyBuf.length !== KEY_LEN) {
    throw new Error(`encryptAesGcm: key must be ${KEY_LEN} bytes (${KEY_LEN * 2} hex chars).`);
  }
  const iv     = randomBytes(IV_LEN);
  const cipher = createCipheriv(AES_ALGO, keyBuf, iv);
  const ct     = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

/**
 * Decrypt a Buffer produced by encryptAesGcm.
 *
 * @param {Buffer} encrypted
 * @param {string} hexKey  32-byte key encoded as 64 hex chars
 * @returns {Buffer}
 */
export function decryptAesGcm(encrypted, hexKey) {
  const HEADER = IV_LEN + TAG_LEN;
  if (!Buffer.isBuffer(encrypted) || encrypted.length < HEADER + 1) {
    throw new Error("decryptAesGcm: data too short.");
  }
  const keyBuf = Buffer.from(hexKey, "hex");
  if (keyBuf.length !== KEY_LEN) {
    throw new Error(`decryptAesGcm: key must be ${KEY_LEN} bytes.`);
  }
  const iv  = encrypted.slice(0, IV_LEN);
  const tag = encrypted.slice(IV_LEN, IV_LEN + TAG_LEN);
  const ct  = encrypted.slice(IV_LEN + TAG_LEN);

  const decipher = createDecipheriv(AES_ALGO, keyBuf, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch (err) {
    throw new Error(
      `decryptAesGcm: decryption failed — wrong key or corrupted data. (${err.message})`
    );
  }
}

// ---------------------------------------------------------------------------
// Main replication function
// ---------------------------------------------------------------------------

/**
 * Replicate a local backup file to S3.
 *
 * @param {object} options
 * @param {string}  options.localBackupPath  Absolute path to the backup file
 * @param {string}  options.bucket           S3 bucket name
 * @param {string}  options.region           AWS region (e.g. "us-east-1")
 * @param {string}  [options.prefix]         S3 key prefix (default "backups")
 * @param {string}  [options.encryptionKey]  32-byte AES key as 64 hex chars
 * @param {object}  [options.s3Client]       Injected S3 client for testing
 * @returns {Promise<{ etag: string, key: string, sizeBytes: number, durationMs: number }>}
 */
export async function replicateBackupToS3({
  localBackupPath,
  bucket,
  region,
  prefix = "backups",
  encryptionKey = "",
  s3Client = null,
}) {
  if (!localBackupPath || !bucket || !region) {
    throw new Error("replicateBackupToS3: localBackupPath, bucket, and region are required.");
  }

  const t0     = Date.now();
  const client = s3Client || new S3Client({ region });

  const rawSizeBytes = statSync(localBackupPath).size;
  const filename     = basename(localBackupPath);
  const cleanPrefix  = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
  const s3Key        = cleanPrefix ? `${cleanPrefix}/${filename}` : filename;
  const useEncryption = Boolean(encryptionKey);

  let body;
  let sizeBytes;

  if (useEncryption) {
    // AES-GCM needs the entire plaintext before producing the tag
    const plaintext = await readFileToBuffer(localBackupPath);
    const encrypted = encryptAesGcm(plaintext, encryptionKey);
    body      = encrypted;
    sizeBytes = encrypted.length;
  } else {
    body      = createReadStream(localBackupPath);
    sizeBytes = rawSizeBytes;
  }

  let etag;
  if (rawSizeBytes > MULTIPART_THRESHOLD) {
    etag = await uploadMultipart({ client, bucket, s3Key, body });
  } else {
    etag = await uploadSingle({ client, bucket, s3Key, body });
  }

  const durationMs = Date.now() - t0;
  log.info(
    { s3Key, bucket, region, sizeBytes, durationMs, encryption: useEncryption ? "aes-256-gcm" : "none" },
    "Backup replicated to S3."
  );

  return { etag, key: s3Key, sizeBytes, durationMs };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function readFileToBuffer(filePath) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const rs = createReadStream(filePath);
    rs.on("data", (c) => chunks.push(c));
    rs.on("end",  () => resolve(Buffer.concat(chunks)));
    rs.on("error", reject);
  });
}

async function uploadSingle({ client, bucket, s3Key, body }) {
  const result = await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: s3Key, Body: body })
  );
  return result.ETag || "";
}

async function uploadMultipart({ client, bucket, s3Key, body }) {
  const { UploadId: uploadId } = await client.send(
    new CreateMultipartUploadCommand({ Bucket: bucket, Key: s3Key })
  );

  const parts = [];
  try {
    const chunks = Buffer.isBuffer(body)
      ? bufferToChunks(body, PART_SIZE)
      : await readableToChunks(body, PART_SIZE);

    for (let i = 0; i < chunks.length; i++) {
      const result = await client.send(new UploadPartCommand({
        Bucket: bucket, Key: s3Key, UploadId: uploadId,
        PartNumber: i + 1, Body: chunks[i],
      }));
      parts.push({ PartNumber: i + 1, ETag: result.ETag });
    }

    const complete = await client.send(new CompleteMultipartUploadCommand({
      Bucket: bucket, Key: s3Key, UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }));
    return complete.ETag || "";
  } catch (err) {
    await client.send(
      new AbortMultipartUploadCommand({ Bucket: bucket, Key: s3Key, UploadId: uploadId })
    ).catch(() => {});
    throw err;
  }
}

function bufferToChunks(buf, size) {
  const chunks = [];
  for (let offset = 0; offset < buf.length; offset += size) {
    chunks.push(buf.slice(offset, Math.min(offset + size, buf.length)));
  }
  return chunks;
}

function readableToChunks(readable, partSize) {
  return new Promise((resolve, reject) => {
    const result = [];
    let acc = [];
    let accSize = 0;

    readable.on("data", (chunk) => {
      acc.push(chunk);
      accSize += chunk.length;
      while (accSize >= partSize) {
        const combined = Buffer.concat(acc);
        result.push(combined.slice(0, partSize));
        const rem = combined.slice(partSize);
        acc     = rem.length > 0 ? [rem] : [];
        accSize = rem.length;
      }
    });
    readable.on("end",  () => {
      if (accSize > 0) result.push(Buffer.concat(acc));
      resolve(result);
    });
    readable.on("error", reject);
  });
}
