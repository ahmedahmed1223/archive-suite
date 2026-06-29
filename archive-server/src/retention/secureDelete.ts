/**
 * DoD 5220.22-M secure file overwrite and deletion.
 *
 * Three-pass sequence (the DoD short form):
 *   Pass 1 — overwrite with 0x00
 *   Pass 2 — overwrite with 0xFF
 *   Pass 3 — overwrite with cryptographically random bytes
 */

import { open, stat, unlink } from "node:fs/promises";
import { randomBytes }        from "node:crypto";
import { createLogger }       from "../logger.js";

const log = createLogger("secure-delete");

const TEN_GB = 10 * 1024 * 1024 * 1024;

// Chunk size for streaming writes — keeps memory flat for large files.
const CHUNK_BYTES = 1024 * 1024; // 1 MiB

interface SecureOverwriteOptions {
  passes?: number;
  pattern?: string;
}

interface SecureOverwriteResult {
  filepath: string;
  passes: number;
  fileSizeBytes: number;
  skipped?: boolean;
  reason?: string;
  pattern?: string;
}

/**
 * Overwrite a file in place using the DoD 5220.22-M three-pass wipe, then
 * delete it from the filesystem.
 */
export async function secureOverwrite(filepath: string, { passes = 3, pattern = "dod-5220-22-m" }: SecureOverwriteOptions = {}): Promise<SecureOverwriteResult> {
  if (typeof filepath !== "string" || !filepath.trim()) {
    throw new Error("secureOverwrite: filepath must be a non-empty string");
  }

  const info = await stat(filepath);
  const fileSizeBytes = Number(info.size);

  if (fileSizeBytes >= TEN_GB) {
    log.warn(
      { filepath, fileSizeBytes },
      "secureOverwrite: file ≥ 10 GB — skipping wipe (hardware-level erasure required). File NOT deleted."
    );
    return { filepath, passes: 0, fileSizeBytes, skipped: true, reason: "file-too-large" };
  }

  // Open with "r+" so we overwrite in place without truncating first.
  const fh = await open(filepath, "r+");
  try {
    const effectivePasses = Math.max(1, Math.floor(passes));

    for (let pass = 0; pass < effectivePasses; pass++) {
      await fh.write(Buffer.alloc(0), 0, 0, 0); // seek to 0 (no-op write resets position)

      let remaining = fileSizeBytes;
      let offset    = 0;

      while (remaining > 0) {
        const chunkSize = Math.min(CHUNK_BYTES, remaining);
        const buf       = makePassBuffer(pass, chunkSize);
        await fh.write(buf, 0, chunkSize, offset);
        offset    += chunkSize;
        remaining -= chunkSize;
      }

      // Flush each pass to storage before starting the next.
      await fh.datasync();
    }
  } finally {
    await fh.close();
  }

  await unlink(filepath);

  log.info(
    { filepath, passes: passes, fileSizeBytes, pattern },
    "secureOverwrite: file wiped and unlinked"
  );

  return { filepath, passes, fileSizeBytes, pattern };
}

// ─── Internal ──────────────────────────────────────────────────────────────

/**
 * Return a buffer for a given pass index:
 *   pass 0 → 0x00
 *   pass 1 → 0xFF
 *   pass 2+ → cryptographic random bytes
 */
function makePassBuffer(passIndex: number, size: number): Buffer {
  if (passIndex === 0) return Buffer.alloc(size, 0x00);
  if (passIndex === 1) return Buffer.alloc(size, 0xff);
  return randomBytes(size);
}
