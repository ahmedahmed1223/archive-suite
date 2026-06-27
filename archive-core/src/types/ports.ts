export type ArchiveRecordId = string;

export type ArchiveStoreKey =
  | "video_items"
  | "media_items"
  | "document_items"
  | "audio_items"
  | "image_items"
  | "collections"
  | "projects"
  | "users"
  | "settings"
  | "audit_logs"
  | string;

export interface ArchiveRecord {
  id?: ArchiveRecordId;
  key?: string;
  deleted?: boolean;
  updatedAt?: string;
  createdAt?: string;
  [field: string]: unknown;
}

export interface SnapshotPayload {
  [store: string]: ArchiveRecord[];
}
