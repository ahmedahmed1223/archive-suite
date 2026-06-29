/**
 * Watch-folder ingest service.
 *
 * Polls a directory at `intervalMs` using mtime + size tracking (no chokidar).
 * For every new file detected it:
 *   1. Computes a SHA-256 checksum over a read stream — no full-file buffer.
 *   2. Calls `onIngest({ filePath, size, mimeType, checksum })`.
 *   3. On success, moves the file to a `processed/` sub-directory.
 *
 * The `seen` Map is keyed by file name; value is `{ mtime, size }` so a file
 * that is still being written (size or mtime changed) is never ingested twice.
 */

import { readdir, stat, mkdir, rename } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { join, basename } from "node:path";
import { extractBroadcastMetadata } from "../media/broadcastIngest.js";

// ── Type definitions ──────────────────────────────────────────────────────────

interface FileInfo {
  mtime: number;
  size: number;
}

interface IngestPayload {
  filePath: string;
  size: number;
  mimeType: string;
  checksum: string;
  broadcastMeta?: unknown;
}

interface WatchFolderService {
  scan: () => Promise<void>;
  start: () => void;
  stop: () => void;
}

interface WatchFolderOptions {
  rootDir: string;
  intervalMs?: number;
  onIngest: (info: IngestPayload) => Promise<void>;
}

/** Derive a rough MIME type from the file extension. */
function mimeFromExt(filePath: string): string {
  const ext = String(filePath).split(".").pop()!.toLowerCase();
  const MAP: Record<string, string> = {
    mp4: "video/mp4", mov: "video/quicktime", avi: "video/x-msvideo",
    mkv: "video/x-matroska", webm: "video/webm",
    mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac", aac: "audio/aac",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", tiff: "image/tiff",
    pdf: "application/pdf",
    zip: "application/zip", tar: "application/x-tar",
  };
  return MAP[ext] || "application/octet-stream";
}

/**
 * Compute SHA-256 via streaming — never allocates the full file in memory.
 */
export function computeChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk: Buffer) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * Create a watch-folder ingest service.
 */
export function createWatchFolderService({
  rootDir,
  intervalMs = 30_000,
  onIngest,
}: WatchFolderOptions): WatchFolderService {
  if (typeof rootDir !== "string" || !rootDir) {
    throw new Error("watchFolder: rootDir is required");
  }
  if (typeof onIngest !== "function") {
    throw new Error("watchFolder: onIngest callback is required");
  }

  /** Map<fileName, { mtime: number, size: number }> */
  const seen = new Map<string, FileInfo>();
  let timer: NodeJS.Timeout | null = null;

  /**
   * Run one sweep of rootDir, detect new/changed files, ingest them.
   * Already-seen files whose mtime+size match the previous scan are skipped.
   */
  async function scan(): Promise<void> {
    const processedDir = join(rootDir, "processed");

    let entries;
    try {
      entries = await readdir(rootDir, { withFileTypes: true });
    } catch {
      // Directory may not exist yet — silently skip.
      return;
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = join(rootDir, entry.name);

      let st;
      try {
        st = await stat(filePath);
      } catch {
        continue;
      }

      const key = entry.name;
      const prev = seen.get(key);
      const mtimeMs = st.mtimeMs;
      const { size } = st;

      // Skip if already processed with same mtime + size.
      if (prev && prev.mtime === mtimeMs && prev.size === size) continue;

      // Update the seen record before async work so a concurrent scan
      // (if ever triggered) won't double-ingest the same file.
      seen.set(key, { mtime: mtimeMs, size });

      try {
        const checksum = await computeChecksum(filePath);
        const mimeType = mimeFromExt(filePath);
        const broadcastMeta = await extractBroadcastMetadata(filePath);

        await onIngest({ filePath, size, mimeType, checksum, ...(broadcastMeta ? { broadcastMeta } : {}) });

        // Move to processed/ on success.
        await mkdir(processedDir, { recursive: true });
        const dest = join(processedDir, entry.name);
        await rename(filePath, dest);
      } catch (err) {
        // Log but don't crash the whole sweep; leave the file in place so it
        // can be retried on the next scan.
        process.stderr.write(
          `[watchFolder] ingest error for ${filePath}: ${(err as any)?.message || err}\n`
        );
        // Reset seen so the next scan retries this file.
        seen.delete(key);
      }
    }
  }

  function start(): void {
    if (timer) return; // already running
    timer = setInterval(() => { scan().catch(() => {}); }, intervalMs);
    if (typeof timer.unref === "function") timer.unref();
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { scan, start, stop };
}
