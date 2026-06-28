import { STORES, dbPut } from "../../services/storage/index.js";

export const INGEST_QUEUE_STATUS = Object.freeze({
  PENDING: "pending",
  ARCHIVING: "archiving",
  ARCHIVED: "archived",
  DISMISSED: "dismissed",
  ERROR: "error"
});

export type IngestQueueStatus = (typeof INGEST_QUEUE_STATUS)[keyof typeof INGEST_QUEUE_STATUS];

interface QueueUploadPolicy {
  globalDefault?: boolean;
  uploadOverride?: boolean;
}

interface QueuedFileInput {
  key?: string;
  fileKey?: string;
  name?: string;
  size?: number;
  mimeType?: string;
  type?: string;
  provider?: string;
}

interface CreateQueueRecordOptions extends QueueUploadPolicy {
  id?: string;
  now?: string;
}

export interface IngestQueueRecord {
  id: string;
  fileKey: string;
  name: string;
  size: number;
  mimeType: string;
  provider: string;
  status: IngestQueueStatus;
  archiveItemId: string | null;
  error: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

interface QueueStorage {
  put(store: string, record: IngestQueueRecord): Promise<IngestQueueRecord> | IngestQueueRecord;
}

interface PersistQueueOptions extends CreateQueueRecordOptions {
  storage?: QueueStorage;
}

export function shouldQueueUpload({ globalDefault = true, uploadOverride }: QueueUploadPolicy = {}): boolean {
  return typeof uploadOverride === "boolean" ? uploadOverride : Boolean(globalDefault);
}

export function createIngestQueueRecord(
  file: QueuedFileInput = {},
  { id, now = new Date().toISOString() }: CreateQueueRecordOptions = {}
): IngestQueueRecord {
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

export function moveQueuedFile<TRecord extends Pick<IngestQueueRecord, "fileKey">>(
  record: TRecord,
  fileKey: string,
  now = new Date().toISOString()
): TRecord & { updatedAt: string } {
  return { ...record, fileKey: String(fileKey || "").replace(/^\/+/, ""), updatedAt: now };
}

export function updateQueueStatus<TRecord extends Partial<IngestQueueRecord>>(
  record: TRecord,
  status: IngestQueueStatus,
  changes: Partial<IngestQueueRecord> = {},
  now = new Date().toISOString()
): TRecord & Partial<IngestQueueRecord> {
  if (!Object.values(INGEST_QUEUE_STATUS).includes(status)) throw new Error("Invalid ingest queue status.");
  return { ...record, ...changes, status, updatedAt: now };
}

export async function persistIngestQueueRecord(
  record: IngestQueueRecord,
  { storage }: PersistQueueOptions = {}
): Promise<IngestQueueRecord> {
  if (storage?.put) return storage.put(STORES.FILE_INGEST_QUEUE, record) as Promise<IngestQueueRecord>;
  return dbPut(STORES.FILE_INGEST_QUEUE, record) as Promise<IngestQueueRecord>;
}

export async function queueUploadedFile(
  file: QueuedFileInput,
  options: PersistQueueOptions = {}
): Promise<IngestQueueRecord | null> {
  if (!shouldQueueUpload(options)) return null;
  const record = createIngestQueueRecord(file, options);
  return persistIngestQueueRecord(record, options);
}
