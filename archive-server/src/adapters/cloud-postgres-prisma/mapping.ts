// Re-export the snapshot mapping from cloud-pocketbase so both backends use
// IDENTICAL domain-key ↔ store-name pairs. If the SPA ever adds a new store
// we only touch one map and both adapters pick it up.

export {
  defaultKeyPathFor,
  SNAPSHOT_COLLECTION_BY_DOMAIN_KEY,
  SETTINGS_COLLECTION,
  SETTINGS_RECORD_KEY
} from "../cloud-pocketbase/mapping.js";

/**
 * Domain record -> StorageRow payload.
 *
 * `data` keeps the entire domain object (so the SPA gets it back unchanged
 * on read). syncVersion + lastModifiedBy are promoted into top-level columns
 * for Phase-3 sync conflict merging — they still live inside `data` too so
 * the round-trip is exact.
 */
export function toRow(
  store: string,
  domainRecord: Record<string, unknown> | undefined,
  keyPath: string
): Record<string, unknown> {
  const uid = domainRecord?.[keyPath];
  return {
    store,
    uid: uid == null ? "" : String(uid),
    data: domainRecord,
    syncVersion: domainRecord?.syncVersion ?? null,
    lastModifiedBy: domainRecord?.lastModifiedBy ?? null
  };
}

/** StorageRow -> domain record (the original object lives in `data`). */
export function fromRow(row: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!row) return undefined;
  return row.data as Record<string, unknown>;
}
