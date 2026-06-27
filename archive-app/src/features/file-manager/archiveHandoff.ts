import type { IngestQueueRecord } from "./ingestQueue";
import { updateQueueStatus } from "./ingestQueue.js";

interface StoredFileEntry {
  key?: string;
  fileKey?: string;
  name?: string;
  size?: number;
  mimeType?: string;
  type?: string;
}

interface SavedArchiveItem {
  id?: string;
}

export function buildArchiveHandoff(entry: StoredFileEntry = {}, queueRecord: Partial<IngestQueueRecord> | null = null) {
  const fileKey = String(entry.key || entry.fileKey || queueRecord?.fileKey || "").replace(/^\/+/, "");
  if (!fileKey) throw new Error("Stored file key is required.");
  return {
    fileKey,
    name: entry.name || queueRecord?.name || fileKey.slice(fileKey.lastIndexOf("/") + 1),
    size: Number(entry.size ?? queueRecord?.size) || 0,
    mimeType: entry.mimeType || entry.type || queueRecord?.mimeType || "",
    queueId: queueRecord?.id || null
  };
}

export function markQueueArchived<TRecord extends Partial<IngestQueueRecord>>(
  record: TRecord,
  savedItem: SavedArchiveItem,
  now?: string
) {
  if (!savedItem?.id) throw new Error("A saved archive item is required.");
  return updateQueueStatus(record, "archived", { archiveItemId: savedItem.id, error: "" }, now);
}
