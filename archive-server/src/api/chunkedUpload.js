/**
 * Server-side chunked / resumable upload session manager.
 *
 * Flow:
 *   1. Client  →  POST /api/upload-sessions                       (init)
 *   2. Client  →  PUT  /api/upload-sessions/:id/chunks/:index     (one per chunk)
 *   3. Client  →  POST /api/upload-sessions/:id/complete          (assemble → FileStore)
 *   4. Server  →  DELETE session + temp files, remove entry
 *
 * Sessions live in-memory; chunks are written to os.tmpdir().
 * A sweeper removes sessions that expire after SESSION_TTL_MS (24 h).
 */

import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const CHUNK_BYTES = 5 * 1024 * 1024;  // 5 MB — matches client UPLOAD_CHUNK_BYTES

const sessions = new Map(); // uploadId → SessionEntry

function tmpDir() {
  return path.join(os.tmpdir(), "archive-upload-chunks");
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
 * Store one chunk for the session.
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
  if (!Buffer.isBuffer(data) || data.length === 0) {
    throw Object.assign(new Error("chunk body is empty"), { statusCode: 400 });
  }

  const fp = chunkPath(uploadId, chunkIndex);
  await mkdir(tmpDir(), { recursive: true });
  await writeFile(fp, data);
  session.chunks.set(chunkIndex, fp);
  session.expiresAt = Date.now() + SESSION_TTL_MS; // refresh TTL on activity

  return {
    received: chunkIndex,
    chunksReceived: session.chunks.size,
    totalChunks: session.totalChunks,
  };
}

/**
 * Assemble all chunks and write the final blob to the FileStore.
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

  const parts = [];
  for (let i = 0; i < session.totalChunks; i++) {
    const fp = session.chunks.get(i);
    if (!fp) {
      throw Object.assign(new Error(`Chunk ${i} missing`), { statusCode: 409 });
    }
    parts.push(await readFile(fp));
  }
  const assembled = Buffer.concat(parts);

  if (assembled.length !== session.totalSize) {
    throw Object.assign(
      new Error(`Size mismatch: expected ${session.totalSize}, got ${assembled.length}`),
      { statusCode: 409 }
    );
  }

  const result = await files.putBlob(session.key, assembled, { contentType: session.contentType });
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
