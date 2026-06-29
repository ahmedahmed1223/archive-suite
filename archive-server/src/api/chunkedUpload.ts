import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, unlink, stat } from "node:fs/promises";
import { PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const CHUNK_BYTES = 5 * 1024 * 1024;

interface SessionEntry {
  uploadId: string;
  key: string;
  contentType: string;
  totalSize: number;
  totalChunks: number;
  chunks: Map<number, string>;
  userId?: string;
  createdAt: number;
  expiresAt: number;
  _bytesReceived?: number;
  onProgress?: (progress: { uploadId: string; bytesReceived: number; totalSize: number }) => void;
}

const sessions = new Map<string, SessionEntry>();

function tmpDir(): string {
  if (process.env.STORAGE_DIR) {
    return path.join(process.env.STORAGE_DIR, "uploads", "archive-upload-chunks");
  }
  const here = fileURLToPath(new URL(".", import.meta.url));
  return path.join(here, "..", "..", "var", "uploads", "archive-upload-chunks");
}

function chunkPath(uploadId: string, index: number): string {
  return path.join(tmpDir(), `${uploadId}_${index}.chunk`);
}

interface InitSessionInput {
  key: string;
  contentType?: string;
  totalSize: number;
  totalChunks: number;
  userId?: string;
}

interface InitSessionResult {
  uploadId: string;
  chunkSize: number;
}

export async function initSession({ key, contentType, totalSize, totalChunks, userId }: InitSessionInput): Promise<InitSessionResult> {
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
    chunks: new Map(),
    userId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });

  await mkdir(tmpDir(), { recursive: true });
  return { uploadId, chunkSize: CHUNK_BYTES };
}

interface ReceiveChunkInput {
  uploadId: string;
  chunkIndex: number;
  data: Buffer | NodeJS.ReadableStream;
  userId?: string;
}

interface ReceiveChunkResult {
  received: number;
  chunksReceived: number;
  totalChunks: number;
}

export async function receiveChunk({ uploadId, chunkIndex, data, userId }: ReceiveChunkInput): Promise<ReceiveChunkResult> {
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
    if (data.length === 0) {
      throw Object.assign(new Error("chunk body is empty"), { statusCode: 400 });
    }
    const ws = createWriteStream(fp);
    await pipeline(
      (async function* () { yield data; })(),
      ws
    );
  } else if (data && typeof (data as any).pipe === "function") {
    const ws = createWriteStream(fp);
    await pipeline(data as NodeJS.ReadableStream, ws);
    const info = await stat(fp).catch(() => null);
    if (!info || info.size === 0) {
      throw Object.assign(new Error("chunk body is empty"), { statusCode: 400 });
    }
  } else {
    throw Object.assign(new Error("chunk data must be a Buffer or Readable stream"), { statusCode: 400 });
  }

  session.chunks.set(chunkIndex, fp);
  session.expiresAt = Date.now() + SESSION_TTL_MS;

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

export function setProgressCallback(uploadId: string, fn: (progress: { uploadId: string; bytesReceived: number; totalSize: number }) => void): void {
  const session = sessions.get(uploadId);
  if (session) session.onProgress = fn;
}

interface CompleteSessionInput {
  uploadId: string;
  userId?: string;
  files: { putStream?: (key: string, stream: NodeJS.ReadableStream, options?: { contentType?: string }) => Promise<{ key: string; url: string }>; putBlob: (key: string, data: Buffer | NodeJS.ReadableStream, options?: { contentType?: string }) => Promise<{ key: string; url: string }> };
}

export async function completeSession({ uploadId, userId, files }: CompleteSessionInput): Promise<{ key: string; url: string }> {
  const session = _getSession(uploadId, userId);

  if (session.chunks.size !== session.totalChunks) {
    throw Object.assign(
      new Error(`Upload incomplete: ${session.chunks.size}/${session.totalChunks} chunks received`),
      { statusCode: 409 }
    );
  }

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

  if (typeof files.putStream === "function") {
    const pass = new PassThrough();
    const putPromise = files.putStream(session.key, pass, { contentType: session.contentType });
    try {
      for (let i = 0; i < session.totalChunks; i++) {
        const fp = session.chunks.get(i);
        await pipeline(createReadStream(fp!), pass, { end: false });
      }
    } finally {
      pass.end();
    }
    const result = await putPromise;
    await _cleanupSession(uploadId);
    return result;
  }

  const pass = new PassThrough();
  const putPromise = files.putBlob(session.key, pass, { contentType: session.contentType });
  for (let i = 0; i < session.totalChunks; i++) {
    const fp = session.chunks.get(i);
    await pipeline(createReadStream(fp!), pass, { end: false });
  }
  pass.end();
  const result = await putPromise;
  await _cleanupSession(uploadId);
  return result;
}

interface AbortSessionInput {
  uploadId: string;
  userId?: string;
}

interface AbortSessionResult {
  ok: boolean;
}

export async function abortSession({ uploadId, userId }: AbortSessionInput): Promise<AbortSessionResult> {
  const session = sessions.get(uploadId);
  if (!session) return { ok: true };
  if (session.userId !== userId) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  await _cleanupSession(uploadId);
  return { ok: true };
}

interface SessionStatusInput {
  uploadId: string;
  userId?: string;
}

interface SessionStatusResult {
  uploadId: string;
  key: string;
  totalChunks: number;
  chunksReceived: number;
  receivedIndices: number[];
}

export function sessionStatus({ uploadId, userId }: SessionStatusInput): SessionStatusResult {
  const session = _getSession(uploadId, userId);
  return {
    uploadId,
    key: session.key,
    totalChunks: session.totalChunks,
    chunksReceived: session.chunks.size,
    receivedIndices: [...session.chunks.keys()].sort((a, b) => a - b),
  };
}

function _getSession(uploadId: string, userId?: string): SessionEntry {
  const session = sessions.get(uploadId);
  if (!session) throw Object.assign(new Error("Upload session not found"), { statusCode: 404 });
  if (session.expiresAt < Date.now()) {
    _cleanupSession(uploadId).catch(() => {});
    throw Object.assign(new Error("Upload session expired"), { statusCode: 410 });
  }
  if (session.userId !== userId) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  return session;
}

async function _cleanupSession(uploadId: string): Promise<void> {
  const session = sessions.get(uploadId);
  sessions.delete(uploadId);
  if (!session) return;
  for (const fp of session.chunks.values()) {
    try { await unlink(fp); } catch { /* best-effort */ }
  }
}

setInterval(async () => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      await _cleanupSession(id).catch(() => {});
    }
  }
}, 60 * 60 * 1000).unref();
