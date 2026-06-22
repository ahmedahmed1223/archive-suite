/**
 * Server-side chunked / resumable upload session manager.
 *
 * Flow:
 *   1. Client  →  POST /api/upload-sessions                       (init)
 *   2. Client  →  PUT  /api/upload-sessions/:id/chunks/:index     (one per chunk)
 *   3. Client  →  POST /api/upload-sessions/:id/complete          (assemble → FileStore)
 *   4. Server  →  DELETE session + temp files, remove entry
 *
 * Sessions live in-memory; chunks are written to STORAGE_DIR/uploads (or
 * archive-server/var/uploads/ by default) — NOT os.tmpdir() — so large files
 * land on the correct partition, not the OS temp disk.
 *
 * Assembly streams chunks sequentially into a single PassThrough fed to
 * files.putBlob(), so no complete-file buffer is ever held in memory.
 * A sweeper removes sessions that expire after SESSION_TTL_MS (24 h).
 */

import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, unlink, stat } from "node:fs/promises";
import { PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const CHUNK_BYTES = 5 * 1024 * 1024;  // 5 MB — matches client UPLOAD_CHUNK_BYTES

const sessions = new Map(); // uploadId → SessionEntry

/** Project-controlled upload staging directory (not os.tmpdir()). */
function tmpDir() {
  if (process.env.STORAGE_DIR) {
    return path.join(process.env.STORAGE_DIR, "uploads", "archive-upload-chunks");
  }
  // Resolve relative to this file: archive-server/src/api/ → archive-server/var/uploads/
  const here = fileURLToPath(new URL(".", import.meta.url));
  return path.join(here, "..", "..", "var", "uploads", "archive-upload-chunks");
}

function chunkPath(uploadId, index) {
  return path.join(tmpDir(), `${uploadId}_${index}.chunk`);
}

/**
 * Create a new upload session.
 * @returns {{ uploadId: string, chunkSize: number }}
 */
export async function initSession({ key, contentType, totalSize, totalChunks, userId }) {
  if (!key || typeof key !== "string") {
    throw Object.assign(new Error("key required"), { statusCode: 400 });
  }
  if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > 2000) {
    throw Object.assign(new Error("totalChunks must be 1–2000"), { statusCode: 400 });
  }
  if (!Number.isInteger(totalSize) || totalSize < 1 || totalSize > 10 * 1024 * 1024 * 1024) {
    throw Object.assign(new Error("totalSize must be 1 byte – 10 GB"), { statusCode: 400 });
  }

  const uploadId = randomUUID();
  const now = Date.now();
  sessions.set(uploadId, {
    uploadId,
    key,
    contentType: String(contentType || "application/octet-stream"),
    totalSize,
    totalChunks,
    chunks: new Map(), // chunkIndex → temp file path
    userId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });

  await mkdir(tmpDir(), { recursive: true });
  return { uploadId, chunkSize: CHUNK_BYTES };
}

/**
 * Store one chunk for the session by streaming the request body directly to
 * disk — no Buffer accumulation.
 *
 * Accepts either a Buffer (legacy) or a Readable stream.
 * @returns {{ received: number, chunksReceived: number, totalChunks: number }}
 */
export async function receiveChunk({ uploadId, chunkIndex, data, userId }) {
  const session = _getSession(uploadId, userId);

  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.totalChunks) {
    throw Object.assign(
      new Error(`chunkIndex must be 0–${session.totalChunks - 1}`),
      { statusCode: 400 }
    );
  }

  const fp = chunkPath(uploadId, chunkIndex);
  await mkdir(tmpDir(), { recursive: true });

  if (Buffer.isBuffer(data)) {
    // Fallback for callers that already have a buffer (e.g. small test payloads)
    if (data.length === 0) {
      throw Object.assign(new Error("chunk body is empty"), { statusCode: 400 });
    }
    const ws = createWriteStream(fp);
    await pipeline(
      (async function* () { yield data; })(),
      ws
    );
  } else if (data && typeof data.pipe === "function") {
    // Stream path — request body piped directly to disk
    const ws = createWriteStream(fp);
    await pipeline(data, ws);
    // Verify the written file is non-empty
    const info = await stat(fp).catch(() => null);
    if (!info || info.size === 0) {
      throw Object.assign(new Error("chunk body is empty"), { statusCode: 400 });
    }
  } else {
    throw Object.assign(new Error("chunk data must be a Buffer or Readable stream"), { statusCode: 400 });
  }

  session.chunks.set(chunkIndex, fp);
  session.expiresAt = Date.now() + SESSION_TTL_MS; // refresh TTL on activity

  // Emit progress event on the global event emitter if one is set (optional UI hook)
  const chunkBytes = (await stat(fp).catch(() => ({ size: 0 }))).size;
  session._bytesReceived = (session._bytesReceived || 0) + chunkBytes;
  if (typeof session.onProgress === "function") {
    session.onProgress({ uploadId, bytesReceived: session._bytesReceived, totalSize: session.totalSize });
  }

  return {
    received: chunkIndex,
    chunksReceived: session.chunks.size,
    totalChunks: session.totalChunks,
  };
}

/**
 * Register a progress callback for an active session.
 * Called with { uploadId, bytesReceived, totalSize } after each chunk lands.
 */
export function setProgressCallback(uploadId, fn) {
  const session = sessions.get(uploadId);
  if (session) session.onProgress = fn;
}

/**
 * Assemble all chunks by streaming them sequentially through a PassThrough
 * into files.putBlob().  No full-file Buffer is ever held in memory.
 * Returns the FileStore result { key, url }.
 */
export async function completeSession({ uploadId, userId, files }) {
  const session = _getSession(uploadId, userId);

  if (session.chunks.size !== session.totalChunks) {
    throw Object.assign(
      new Error(`Upload incomplete: ${session.chunks.size}/${session.totalChunks} chunks received`),
      { statusCode: 409 }
    );
  }

  // Validate that all chunk files exist and sum to the expected size before streaming
  let actualSize = 0;
  for (let i = 0; i < session.totalChunks; i++) {
    const fp = session.chunks.get(i);
    if (!fp) {
      throw Object.assign(new Error(`Chunk ${i} missing`), { statusCode: 409 });
    }
    const info = await stat(fp).catch(() => null);
    if (!info) {
      throw Object.assign(new Error(`Chunk ${i} file missing on disk`), { statusCode: 409 });
    }
    actualSize += info.size;
  }

  if (actualSize !== session.totalSize) {
    throw Object.assign(
      new Error(`Size mismatch: expected ${session.totalSize}, got ${actualSize}`),
      { statusCode: 409 }
    );
  }

  // If the FileStore supports streaming, feed it a PassThrough that we pump
  // chunk files into sequentially.  Fall back to putBlob(buffer) only if
  // putStream is not available — but even then we only hold one chunk at a time.
  if (typeof files.putStream === "function") {
    const pass = new PassThrough();
    const putPromise = files.putStream(session.key, pass, { contentType: session.contentType });
    try {
      for (let i = 0; i < session.totalChunks; i++) {
        const fp = session.chunks.get(i);
        await pipeline(createReadStream(fp), pass, { end: false });
      }
    } finally {
      pass.end();
    }
    const result = await putPromise;
    await _cleanupSession(uploadId);
    return result;
  }

  // putBlob fallback: stream chunk files one-at-a-time into a single PassThrough
  // that is buffered only in memory as a Node.js stream (not a giant Buffer.concat).
  // putBlob receives the stream — adapters that accept a stream will work;
  // adapters that need a Buffer will receive it via the stream.
  const pass = new PassThrough();
  const putPromise = files.putBlob(session.key, pass, { contentType: session.contentType });
  for (let i = 0; i < session.totalChunks; i++) {
    const fp = session.chunks.get(i);
    await pipeline(createReadStream(fp), pass, { end: false });
  }
  pass.end();
  const result = await putPromise;
  await _cleanupSession(uploadId);
  return result;
}

/**
 * Abort an upload session and remove its temp files.
 */
export async function abortSession({ uploadId, userId }) {
  const session = sessions.get(uploadId);
  if (!session) return { ok: true };
  if (session.userId !== userId) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  await _cleanupSession(uploadId);
  return { ok: true };
}

/**
 * Return list of received chunk indices — lets the client resume a broken upload.
 */
export function sessionStatus({ uploadId, userId }) {
  const session = _getSession(uploadId, userId);
  return {
    uploadId,
    key: session.key,
    totalChunks: session.totalChunks,
    chunksReceived: session.chunks.size,
    receivedIndices: [...session.chunks.keys()].sort((a, b) => a - b),
  };
}

// ---- internal helpers ----

function _getSession(uploadId, userId) {
  const session = sessions.get(uploadId);
  if (!session) throw Object.assign(new Error("Upload session not found"), { statusCode: 404 });
  if (session.expiresAt < Date.now()) {
    _cleanupSession(uploadId).catch(() => {});
    throw Object.assign(new Error("Upload session expired"), { statusCode: 410 });
  }
  if (session.userId !== userId) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  return session;
}

async function _cleanupSession(uploadId) {
  const session = sessions.get(uploadId);
  sessions.delete(uploadId);
  if (!session) return;
  for (const fp of session.chunks.values()) {
    try { await unlink(fp); } catch { /* best-effort */ }
  }
}

// Sweep stale sessions every hour
setInterval(async () => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      await _cleanupSession(id).catch(() => {});
    }
  }
}, 60 * 60 * 1000).unref();
