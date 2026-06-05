import {
  defaultKeyPathFor,
  toRow,
  fromRow,
  SNAPSHOT_COLLECTION_BY_DOMAIN_KEY,
  SETTINGS_COLLECTION,
  SETTINGS_RECORD_KEY
} from "./mapping.js";

// Postgres StorageProvider adapter — satisfies the @archive/core
// StorageProvider port (11 methods) over a Prisma client. The client is
// injected so this module has no Prisma runtime dependency at import time
// and stays deterministically testable with an in-memory fake.
//
// Wire-compatible with the cloud-pocketbase adapter: snapshot/replaceAll
// produce/consume the same payload shape, so an export from either backend
// imports cleanly into the other.
//
// Concurrency note: replaceAll runs inside a single $transaction so the
// "wipe all stores, then write all stores" sequence is ATOMIC on Postgres
// (matches the IndexedDB adapter's atomicity guarantee). PocketBase
// couldn't offer this — Postgres can, and we should use it.

export function createPostgresStorageProvider(prisma, options = {}) {
  const keyPathFor = options.keyPathFor || defaultKeyPathFor;
  const row = prisma.storageRow;
  if (!row || typeof row.findUnique !== "function") {
    throw new Error("Prisma client missing `storageRow` model — did you run `prisma generate`?");
  }

  return {
    async open() {
      // Prisma auto-connects on first query; this gives bootstrap a single
      // place to surface "can't reach DB" errors with a clear stack.
      await prisma.$connect?.();
    },

    async ping() {
      if (typeof prisma.$queryRaw === "function") {
        await prisma.$queryRaw`SELECT 1`;
      } else if (typeof prisma.$executeRaw === "function") {
        await prisma.$executeRaw`SELECT 1`;
      } else {
        await row.findMany({ take: 1 });
      }
      return true;
    },

    async get(store, key) {
      if (key === undefined || key === null) return undefined;
      const found = await row.findUnique({
        where: { store_uid: { store, uid: String(key) } }
      });
      return fromRow(found);
    },

    async getAll(store) {
      const rows = await row.findMany({ where: { store } });
      return rows.map(fromRow);
    },

    async put(store, record) {
      if (!record) return record;
      const keyPath = keyPathFor(store);
      const payload = toRow(store, record, keyPath);
      await row.upsert({
        where: { store_uid: { store: payload.store, uid: payload.uid } },
        create: payload,
        update: {
          data: payload.data,
          syncVersion: payload.syncVersion,
          lastModifiedBy: payload.lastModifiedBy
        }
      });
      return record;
    },

    async add(store, record) {
      if (!record) return record;
      const keyPath = keyPathFor(store);
      await row.create({ data: toRow(store, record, keyPath) });
      return record;
    },

    async delete(store, key) {
      if (key === undefined || key === null) return;
      await row.deleteMany({
        where: { store, uid: String(key) }
      });
    },

    async clear(store) {
      await row.deleteMany({ where: { store } });
    },

    async putBatch(store, items = []) {
      if (!items?.length) return items;
      const keyPath = keyPathFor(store);
      // Each upsert is its own statement; wrap in a transaction so a partial
      // failure rolls back instead of leaving the batch half-applied.
      await prisma.$transaction(
        items
          .filter(Boolean)
          .map((record) => {
            const payload = toRow(store, record, keyPath);
            return row.upsert({
              where: { store_uid: { store: payload.store, uid: payload.uid } },
              create: payload,
              update: {
                data: payload.data,
                syncVersion: payload.syncVersion,
                lastModifiedBy: payload.lastModifiedBy
              }
            });
          })
      );
      return items;
    },

    async deleteBatch(store, keys = []) {
      const usableKeys = (keys || [])
        .filter((key) => key !== undefined && key !== null)
        .map(String);
      if (!usableKeys.length) return keys;
      await row.deleteMany({
        where: { store, uid: { in: usableKeys } }
      });
      return keys;
    },

    // ── Whole-dataset operations ──────────────────────────────────────

    async snapshot() {
      const out = {
        exportedAt: new Date().toISOString(),
        version: "2.0"
      };
      // One query per store keeps the result-set bounded and avoids loading
      // unrelated stores into memory on Postgres-side. The SPA only reads
      // these specific keys so we don't gain anything from a single big query.
      for (const [domainKey, store] of Object.entries(SNAPSHOT_COLLECTION_BY_DOMAIN_KEY)) {
        const rows = await row.findMany({ where: { store } });
        out[domainKey] = rows.map(fromRow).filter((value) => value !== undefined);
      }
      const settingsRow = await row.findUnique({
        where: { store_uid: { store: SETTINGS_COLLECTION, uid: SETTINGS_RECORD_KEY } }
      });
      out.settings = fromRow(settingsRow) || undefined;
      return out;
    },

    async replaceAll(payload = {}) {
      if (!payload || typeof payload !== "object") {
        throw new Error("حمولة replaceAll غير صالحة.");
      }
      const counts = {};
      // Single transaction — atomic across all stores (Postgres can do what
      // PocketBase couldn't). A failure mid-way rolls back the entire
      // import so the database never sits in a half-applied state.
      await prisma.$transaction(async (tx) => {
        const txRow = tx.storageRow;
        for (const [domainKey, store] of Object.entries(SNAPSHOT_COLLECTION_BY_DOMAIN_KEY)) {
          const records = Array.isArray(payload[domainKey]) ? payload[domainKey] : [];
          const shouldClear = domainKey !== "users" || records.length > 0;
          if (shouldClear) {
            await txRow.deleteMany({ where: { store } });
          }
          let written = 0;
          const keyPath = keyPathFor(store);
          for (const record of records) {
            if (!record) continue;
            await txRow.create({ data: toRow(store, record, keyPath) });
            written += 1;
          }
          counts[domainKey] = written;
        }
        // Settings is a singleton — upsert the same as PocketBase.
        if (payload.settings && typeof payload.settings === "object") {
          const settingsRecord = { ...payload.settings, key: SETTINGS_RECORD_KEY };
          const settingsPayload = toRow(SETTINGS_COLLECTION, settingsRecord, "key");
          await txRow.upsert({
            where: {
              store_uid: { store: SETTINGS_COLLECTION, uid: SETTINGS_RECORD_KEY }
            },
            create: settingsPayload,
            update: {
              data: settingsPayload.data,
              syncVersion: settingsPayload.syncVersion,
              lastModifiedBy: settingsPayload.lastModifiedBy
            }
          });
        }
      });
      return counts;
    }
  };
}
