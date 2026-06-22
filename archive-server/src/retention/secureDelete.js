/**
 * DoD 5220.22-M secure file overwrite and deletion.
 *
 * Three-pass sequence (the DoD short form):
 *   Pass 1 — overwrite with 0x00
 *   Pass 2 — overwrite with 0xFF
 *   Pass 3 — overwrite with cryptographically random bytes
 *
 * After all passes the file is unlinked. Files ≥ 10 GB are skipped with a
 * warning (they require a separate hardware-level approach tracked in the
 * L-task follow-up).
 *
 * All I/O uses fs/promises to stay compatible with the project's async style.
 */

import { open, stat, unlink } from "node:fs/promises";
import { randomBytes }        from "node:crypto";
import { createLogger }       from "../logger.js";

const log = createLogger("secure-delete");

const TEN_GB = 10 * 1024 * 1024 * 1024;

// Chunk size for streaming writes — keeps memory flat for large files.
const CHUNK_BYTES = 1024 * 1024; // 1 MiB

/**
 * Overwrite a file in place using the DoD 5220.22-M three-pass wipe, then
 * delete it from the filesystem.
 *
 * @param {string} filepath - absolute path to the file to destroy
 * @param {object} [options]
 * @param {number} [options.passes=3]              - number of overwrite passes (≥ 1)
 * @param {string} [options.pattern="dod-5220-22-m"] - wipe pattern identifier (reserved for future variants)
 * @returns {Promise<{ filepath: string, passes: number, fileSizeBytes: number }>}
 * @throws if the file cannot be opened r+w, or if unlink fails
 */
export async function secureOverwrite(filepath, { passes = 3, pattern = "dod-5220-22-m" } = {}) {
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
 *
 * @param {number} passIndex
 * @param {number} size
 * @returns {Buffer}
 */
function makePassBuffer(passIndex, size) {
  if (passIndex === 0) return Buffer.alloc(size, 0x00);
  if (passIndex === 1) return Buffer.alloc(size, 0xff);
  return randomBytes(size);
}
