import type { createArchiveApiClient, UploadedRecord, UploadSession } from "./archive-api";

type ArchiveApi = ReturnType<typeof createArchiveApiClient>;

export const DEFAULT_CHUNK_BYTES = 8 * 1024 * 1024;
/** Above this size, skip the client-side full-file hash — reading a multi-GB
 * file into memory to hash it before upload defeats the point of chunking. */
const CHECKSUM_MAX_BYTES = 200 * 1024 * 1024;
const RESUME_STORAGE_KEY = "archive.chunked-upload.sessions";

interface ResumeEntry {
  sessionId: string;
  fileName: string;
  size: number;
  lastModified: number;
  folder?: string;
}

export interface ChunkedUploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  /** True when this call resumed a session from a prior attempt rather than starting fresh. */
  resuming: boolean;
}

export type ChunkedUploadResult =
  | { ok: true; record: UploadedRecord }
  | { ok: false; error: string };

export interface ChunkedUploadOptions {
  chunkBytes?: number;
  folder?: string;
  onProgress?: (progress: ChunkedUploadProgress) => void;
  signal?: AbortSignal;
}

function fileFingerprint(file: File, folder?: string): string {
  return `${file.name}::${file.size}::${file.lastModified}::${folder ?? ""}`;
}

function readResumeMap(): Record<string, ResumeEntry> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(RESUME_STORAGE_KEY) ?? "{}") as Record<string, ResumeEntry>;
  } catch {
    return {};
  }
}

function writeResumeMap(map: Record<string, ResumeEntry>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(map));
}

function saveResumeEntry(fingerprint: string, entry: ResumeEntry): void {
  const map = readResumeMap();
  map[fingerprint] = entry;
  writeResumeMap(map);
}

function clearResumeEntry(fingerprint: string): void {
  const map = readResumeMap();
  delete map[fingerprint];
  writeResumeMap(map);
}

async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createSession(
  api: ArchiveApi,
  file: File,
  chunkBytes: number,
  folder?: string
): Promise<{ ok: true; session: UploadSession } | { ok: false; error: string }> {
  const checksum = file.size <= CHECKSUM_MAX_BYTES ? await computeSha256(file) : undefined;
  const response = await api.createUploadSession({ fileName: file.name, totalSize: file.size, chunkSize: chunkBytes, folder, checksum });

  if (!response.ok) return { ok: false, error: response.error };
  return { ok: true, session: response.session };
}

export type StageSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

/**
 * V1-711/V1-712: creates (or resumes) an upload session and uploads every
 * chunk, but does not call completeUploadSession. Shared by the immediate
 * upload path (`uploadFileInChunks`, which completes it) and the scheduled
 * upload path (which stages the session then calls createScheduledUpload
 * instead of completing it here).
 */
async function stageUploadSession(
  api: ArchiveApi,
  file: File,
  options: ChunkedUploadOptions = {}
): Promise<StageSessionResult> {
  const chunkBytes = options.chunkBytes ?? DEFAULT_CHUNK_BYTES;
  const fingerprint = fileFingerprint(file, options.folder);
  const existing = readResumeMap()[fingerprint];

  let session: UploadSession;
  let resuming = false;

  if (existing) {
    const statusResponse = await api.uploadSessionStatus(existing.sessionId);
    if (statusResponse.ok && statusResponse.session.status === "pending") {
      session = statusResponse.session;
      resuming = true;
    } else {
      clearResumeEntry(fingerprint);
      const created = await createSession(api, file, chunkBytes, options.folder);
      if (!created.ok) return created;
      session = created.session;
    }
  } else {
    const created = await createSession(api, file, chunkBytes, options.folder);
    if (!created.ok) return created;
    session = created.session;
  }

  saveResumeEntry(fingerprint, {
    sessionId: session.id,
    fileName: file.name,
    size: file.size,
    lastModified: file.lastModified,
    folder: options.folder
  });

  const received = new Set(session.receivedChunks);
  const totalBytes = file.size;
  let uploadedBytes = Math.min(received.size * session.chunkSize, totalBytes);
  options.onProgress?.({ uploadedBytes, totalBytes, resuming });

  for (let index = 0; index < session.totalChunks; index += 1) {
    if (options.signal?.aborted) {
      return { ok: false, error: "أُلغي الرفع." };
    }
    if (received.has(index)) continue;

    const start = index * session.chunkSize;
    const end = Math.min(start + session.chunkSize, file.size);
    const chunkResponse = await api.uploadSessionChunk(session.id, index, file.slice(start, end));
    if (!chunkResponse.ok) {
      return { ok: false, error: chunkResponse.error };
    }

    uploadedBytes = Math.min(uploadedBytes + (end - start), totalBytes);
    options.onProgress?.({ uploadedBytes, totalBytes, resuming });
  }

  return { ok: true, sessionId: session.id };
}

/**
 * V1-711: orchestrates a resumable chunked upload against the
 * /uploads/sessions API. Resumable across page reloads — the session id is
 * keyed in localStorage by file name+size+lastModified, so calling this
 * again for "the same" file resumes from the server's receivedChunks
 * instead of re-uploading from byte zero.
 */
export async function uploadFileInChunks(
  api: ArchiveApi,
  file: File,
  options: ChunkedUploadOptions = {}
): Promise<ChunkedUploadResult> {
  const staged = await stageUploadSession(api, file, options);
  if (!staged.ok) return staged;

  const completeResponse = await api.completeUploadSession(staged.sessionId);
  if (!completeResponse.ok) {
    return { ok: false, error: completeResponse.error };
  }

  clearResumeEntry(fileFingerprint(file, options.folder));
  return { ok: true, record: completeResponse.record };
}

/**
 * V1-712: stages a file through the upload-session/chunk API without
 * completing it, for the "schedule processing" wizard path — the session id
 * is handed to createScheduledUpload instead, and the resume entry stays
 * intact until the schedule is created so an interrupted staging can resume.
 */
export async function uploadFileForSchedule(
  api: ArchiveApi,
  file: File,
  options: ChunkedUploadOptions = {}
): Promise<StageSessionResult> {
  return stageUploadSession(api, file, options);
}

/** Clears the resume entry for a file once its scheduled upload session has been consumed. */
export function clearScheduledUploadResumeEntry(file: File, folder?: string): void {
  clearResumeEntry(fileFingerprint(file, folder));
}

/** Cancels an in-progress chunked upload and forgets its resume state. */
export async function abortChunkedUpload(api: ArchiveApi, file: File, folder?: string): Promise<void> {
  const fingerprint = fileFingerprint(file, folder);
  const entry = readResumeMap()[fingerprint];
  if (!entry) return;

  clearResumeEntry(fingerprint);
  await api.abortUploadSession(entry.sessionId);
}
