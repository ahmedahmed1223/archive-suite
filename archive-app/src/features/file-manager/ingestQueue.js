import { STORES, dbPut } from "../../services/storage/index.js";

export const INGEST_QUEUE_STATUS = Object.freeze({
  PENDING: "pending",
  ARCHIVING: "archiving",
  ARCHIVED: "archived",
  DISMISSED: "dismissed",
  ERROR: "error"
});

export function shouldQueueUpload({ globalDefault = true, uploadOverride } = {}) {
  return typeof uploadOverride === "boolean" ? uploadOverride : Boolean(globalDefault);
}

export function createIngestQueueRecord(file = {}, { id, now = new Date().toISOString() } = {}) {
  const fileKey = String(file.key || file.fileKey || "").replace(/^\/+/, "");
  if (!fileKey || fileKey.includes("\0") || fileKey.split("/").includes("..")) {
    throw new Error("Invalid queued file key.");
  }
  return {
    id: id || `ingest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
    fileKey,
    name: file.name || fileKey.slice(fileKey.lastIndexOf("/") + 1),
    size: Number(file.size) || 0,
    mimeType: file.mimeType || file.type || "",
    provider: file.provider || "",
    status: INGEST_QUEUE_STATUS.PENDING,
    archiveItemId: null,
    error: "",
    createdAt: now,
    updatedAt: now
  };
}

export function moveQueuedFile(record, fileKey, now = new Date().toISOString()) {
  return { ...record, fileKey: String(fileKey || "").replace(/^\/+/, ""), updatedAt: now };
}

export function updateQueueStatus(record, status, changes = {}, now = new Date().toISOString()) {
  if (!Object.values(INGEST_QUEUE_STATUS).includes(status)) throw new Error("Invalid ingest queue status.");
  return { ...record, ...changes, status, updatedAt: now };
}

export async function persistIngestQueueRecord(record, { storage } = {}) {
  if (storage?.put) return storage.put(STORES.FILE_INGEST_QUEUE, record);
  return dbPut(STORES.FILE_INGEST_QUEUE, record);
}

export async function queueUploadedFile(file, options = {}) {
  if (!shouldQueueUpload(options)) return null;
  const record = createIngestQueueRecord(file, options);
  return persistIngestQueueRecord(record, options);
}
