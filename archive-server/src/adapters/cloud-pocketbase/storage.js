import {
  defaultKeyPathFor,
  toPbRecord,
  fromPbRecord,
  uidFilter,
  SNAPSHOT_COLLECTION_BY_DOMAIN_KEY,
  SETTINGS_COLLECTION,
  SETTINGS_RECORD_KEY
} from "./mapping.js";

// PocketBase StorageProvider adapter — satisfies the @archive/core
// StorageProvider port over a PocketBase client. The client is injected (the
// real `PocketBase` instance in production, a fake in tests), so this module
// has no SDK dependency and is deterministically testable offline.
//
// Each store maps to a PocketBase collection of the same name; records use the
// generic { uid, data, syncVersion, lastModifiedBy } shape (see mapping.js).
// PocketBase has no native upsert, so `put` emulates it (find-by-uid then
// update-or-create).
//
// Whole-dataset methods (snapshot/replaceAll) are best-effort batches: PB has
// no cross-collection transactions, so `replaceAll` clears + writes each
// collection sequentially and returns per-store write counts. The SPA's
// IndexedDB adapter is atomic; both honor the same port contract.

export function createPocketBaseStorageProvider(client, options = {}) {
  const keyPathFor = options.keyPathFor || defaultKeyPathFor;

  async function findByUid(store, key) {
    try {
      return await client.collection(store).getFirstListItem(uidFilter(key));
    } catch {
      // PocketBase throws (404) when no record matches the filter.
      return null;
    }
  }

  return {
    async open() {
      // Connection is lazy; nothing to do. (Health checks live in bootstrap.)
    },

    async ping() {
      if (typeof client?.health?.check === "function") {
        await client.health.check();
        return true;
      }
      if (typeof client?.send === "function") {
        await client.send("/api/health", { method: "GET" });
        return true;
      }
      return true;
    },

    async get(store, key) {
      const row = await findByUid(store, key);
      return fromPbRecord(row);
    },

    async getAll(store) {
      const rows = await client.collection(store).getFullList();
      return rows.map(fromPbRecord);
    },

    async put(store, record) {
      if (!record) return record;
      const keyPath = keyPathFor(store);
      const payload = toPbRecord(record, keyPath);
      const existing = await findByUid(store, payload.uid);
      if (existing) {
        await client.collection(store).update(existing.id, payload);
      } else {
        await client.collection(store).create(payload);
      }
      return record;
    },

    async add(store, record) {
      if (!record) return record;
      const payload = toPbRecord(record, keyPathFor(store));
      await client.collection(store).create(payload);
      return record;
    },

    async delete(store, key) {
      const existing = await findByUid(store, key);
      if (existing) {
        await client.collection(store).delete(existing.id);
      }
    },

    async clear(store) {
      const rows = await client.collection(store).getFullList();
      for (const row of rows) {
        await client.collection(store).delete(row.id);
      }
    },

    async putBatch(store, items = []) {
      for (const item of items || []) {
        if (item) await this.put(store, item);
      }
      return items;
    },

    async deleteBatch(store, keys = []) {
      for (const key of keys || []) {
        if (key !== undefined && key !== null) await this.delete(store, key);
      }
      return keys;
    },

    // Whole-dataset operations (best-effort batches — PB has no cross-collection
    // transaction so we cannot mirror IndexedDB's atomic rollback).
    async snapshot() {
      const out = {
        exportedAt: new Date().toISOString(),
        version: "2.0"
      };
      for (const [domainKey, collection] of Object.entries(SNAPSHOT_COLLECTION_BY_DOMAIN_KEY)) {
        try {
          const rows = await client.collection(collection).getFullList();
          out[domainKey] = rows.map(fromPbRecord).filter((value) => value !== undefined);
        } catch {
          // Missing collection on a fresh server is not an error — surface an
          // empty list so the snapshot shape stays stable.
          out[domainKey] = [];
        }
      }
      try {
        const settingsRow = await findByUid(SETTINGS_COLLECTION, SETTINGS_RECORD_KEY);
        out.settings = fromPbRecord(settingsRow) || undefined;
      } catch {
        out.settings = undefined;
      }
      return out;
    },

    async replaceAll(payload = {}) {
      if (!payload || typeof payload !== "object") {
        throw new Error("حمولة replaceAll غير صالحة.");
      }
      const counts = {};
      // Clear + write each list collection. Best-effort: a failure inside any
      // collection bubbles up so the caller can roll back via a prior snapshot.
      for (const [domainKey, collection] of Object.entries(SNAPSHOT_COLLECTION_BY_DOMAIN_KEY)) {
        const records = Array.isArray(payload[domainKey]) ? payload[domainKey] : [];
        // For `users`, the SPA only clears when the import supplies users; we
        // mirror that so a partial import never wipes existing accounts.
        const shouldClear = domainKey !== "users" || records.length > 0;
        if (shouldClear) {
          try {
            const existing = await client.collection(collection).getFullList();
            for (const row of existing) {
              await client.collection(collection).delete(row.id);
            }
          } catch {
            // Treat a missing collection as already-empty.
          }
        }
        let written = 0;
        const keyPath = keyPathFor(collection);
        for (const record of records) {
          if (!record) continue;
          await client.collection(collection).create(toPbRecord(record, keyPath));
          written += 1;
        }
        counts[domainKey] = written;
      }
      // Settings is a singleton document on the SPA side — upsert it the same way.
      if (payload.settings && typeof payload.settings === "object") {
        const settingsRecord = { ...payload.settings, key: SETTINGS_RECORD_KEY };
        const existing = await findByUid(SETTINGS_COLLECTION, SETTINGS_RECORD_KEY);
        const pbPayload = toPbRecord(settingsRecord, "key");
        if (existing) {
          await client.collection(SETTINGS_COLLECTION).update(existing.id, pbPayload);
        } else {
          await client.collection(SETTINGS_COLLECTION).create(pbPayload);
        }
      }
      return counts;
    }
  };
}
