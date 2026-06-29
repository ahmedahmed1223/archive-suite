// Generic mapping between a domain record and a PocketBase record.
//
// Every collection uses ONE generic shape so the adapter is uniform across all
// stores (and resilient to the app's dynamic custom-field model):
//   uid            (text, unique, indexed)  — our logical key (id, or `key` for app_settings)
//   data           (json)                   — the full domain record
//   syncVersion    (number, nullable)       — promoted for Phase-3 conflict merge
//   lastModifiedBy (json,   nullable)       — promoted for Phase-3 conflict merge
// PocketBase keeps its own opaque 15-char `id`; we never rely on it as the key.

/** The logical-key field for a store. app_settings is keyed by `key`; others by `id`. */
export function defaultKeyPathFor(store: string): string {
  return store === "app_settings" ? "key" : "id";
}

// Snapshot/replaceAll payload shape mapping — keeps the cloud adapter's
// whole-dataset contract identical to the SPA adapter so importers/exporters
// can flow either direction without per-backend branching. The keys on the
// left are the domain payload keys; the values are PocketBase collection names
// (1:1 with the IndexedDB store names on the SPA side).
export const SNAPSHOT_COLLECTION_BY_DOMAIN_KEY = Object.freeze({
  contentTypes: "content_types",
  videoItems: "video_items",
  changeHistory: "change_history",
  bookmarks: "bookmarks",
  relations: "video_relations",
  virtualCollections: "virtual_collections",
  vocabulary: "vocabulary",
  hierarchicalTags: "hierarchical_tags",
  users: "users",
  auditLogs: "audit_logs",
  projects: "projects",
  fileIngestQueue: "file_ingest_queue"
});

// `app_settings` is a singleton bag keyed by `key="app_settings"` rather than
// a list of records — surfaced separately on both sides of the snapshot.
export const SETTINGS_COLLECTION = "app_settings";
export const SETTINGS_RECORD_KEY = "app_settings";

/** Domain record -> PocketBase payload. */
export function toPbRecord(
  domainRecord: Record<string, unknown> | undefined,
  keyPath: string
): Record<string, unknown> {
  const uid = domainRecord?.[keyPath];
  return {
    uid: uid == null ? "" : String(uid),
    data: domainRecord,
    syncVersion: domainRecord?.syncVersion ?? null,
    lastModifiedBy: domainRecord?.lastModifiedBy ?? null
  };
}

/** PocketBase record -> domain record (the original object lives in `data`). */
export function fromPbRecord(
  pbRecord: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!pbRecord) return undefined;
  return pbRecord.data as Record<string, unknown>;
}

/** Build a safe PocketBase filter expression matching one uid. */
export function uidFilter(key: string | number): string {
  // Escape double quotes/backslashes to avoid breaking the filter string.
  const safe = String(key).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `uid="${safe}"`;
}
