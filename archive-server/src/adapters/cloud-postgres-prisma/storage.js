import { Prisma } from "../../generated/prisma/client.js";
import { generateEmbedding, buildEmbeddingText } from "../../ai/embeddingService.js";
import {
  defaultKeyPathFor,
  toRow,
  fromRow,
  SNAPSHOT_COLLECTION_BY_DOMAIN_KEY,
  SETTINGS_COLLECTION,
  SETTINGS_RECORD_KEY
} from "./mapping.js";
import { fireWebhooks } from "../../webhooks/webhookService.js";

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

// ── Chunked batch helpers ─────────────────────────────────────────────────
// Postgres has a hard limit of ~65 535 parameters per statement. With
// createMany each row typically expands to ~5 columns, so 1 000 rows/chunk
// stays well under that ceiling while still being large enough to amortise
// round-trip latency.
const CHUNK_SIZE = 1000;

function chunks(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// ── Per-record size guard (Task 32) ──────────────────────────────────────
// Rejects records whose JSON representation exceeds the configured ceiling
// before they touch the DB. This prevents runaway writes that could bloat
// the database or exceed Postgres's per-row / per-column limits.
// Override via MAX_RECORD_BYTES env var (bytes). Default: 10 MB.
const MAX_RECORD_BYTES = parseInt(process.env.MAX_RECORD_BYTES || "", 10) || 10 * 1024 * 1024;

function assertRecordSize(record) {
  const size = Buffer.byteLength(JSON.stringify(record), "utf8");
  if (size > MAX_RECORD_BYTES) {
    const err = new Error(`Record too large: ${size} bytes (max ${MAX_RECORD_BYTES})`);
    err.statusCode = 413;
    throw err;
  }
}

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

    async getAll(store, opts) {
      // opts = { cursor?: string, limit?: number }
      // When limit is absent, return all rows (backward compat).
      if (!opts || opts.limit === undefined || opts.limit === null) {
        const rows = await row.findMany({ where: { store }, orderBy: { uid: "asc" } });
        return rows.map(fromRow);
      }
      const { cursor, limit } = opts;
      const where = cursor
        ? { store, uid: { gt: cursor } }
        : { store };
      // Fetch one extra row to determine whether there are more pages.
      const rows = await row.findMany({
        where,
        orderBy: { uid: "asc" },
        take: limit + 1
      });
      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;
      const data = pageRows.map(fromRow);
      const nextCursor = hasMore ? pageRows[pageRows.length - 1].uid : null;
      return { data, nextCursor, hasMore };
    },

    async put(store, record) {
      if (!record) return record;
      assertRecordSize(record);
      const keyPath = keyPathFor(store);
      const payload = toRow(store, record, keyPath);
      // Pre-check existence so webhooks can distinguish create vs update.
      const existingRow = await row.findUnique({
        where: { store_uid: { store: payload.store, uid: payload.uid } },
        select: { uid: true },
      });
      await row.upsert({
        where: { store_uid: { store: payload.store, uid: payload.uid } },
        create: payload,
        update: {
          data: payload.data,
          syncVersion: payload.syncVersion,
          lastModifiedBy: payload.lastModifiedBy
        }
      });
      // Fire-and-forget: fire outgoing webhooks for record.created / record.updated.
      // Scoped to record.ownerId so each user only receives their own events.
      fireWebhooks(
        prisma,
        existingRow ? "record.updated" : "record.created",
        { store, uid: payload.uid },
        record.ownerId
      );
      // Fire-and-forget: generate and store an embedding vector for the record.
      // Non-blocking — failures are logged as warnings, never propagated to the caller.
      // Skipped silently when OPENAI_API_KEY / AI_API_KEY is absent.
      const embeddingText = buildEmbeddingText(record);
      if (embeddingText) {
        generateEmbedding(embeddingText).then(embedding => {
          if (embedding) {
            const vectorStr = `[${embedding.join(",")}]`;
            return prisma.$executeRaw`
              UPDATE storage_rows
              SET embedding = ${vectorStr}::vector
              WHERE store = ${store} AND uid = ${payload.uid}
            `;
          }
        }).catch(err => {
          // eslint-disable-next-line no-console
          console.warn("[embeddings] Async embedding update failed:", err.message);
        });
      }
      // Fire-and-forget: save a version snapshot so users can browse history
      // and restore previous versions from the DetailPage. Non-blocking —
      // failures are logged as warnings and never propagate to the caller.
      // Skipped when RecordVersion model is not yet available (e.g. migration
      // not yet run in development).
      const recordUid = record.uid ?? record.id ?? record.data?.uid;
      if (recordUid && prisma.recordVersion) {
        setImmediate(async () => {
          try {
            const latest = await prisma.recordVersion.findFirst({
              where: { store, recordUid: String(recordUid) },
              orderBy: { version: "desc" },
              select: { version: true },
            });
            await prisma.recordVersion.create({
              data: {
                store,
                recordUid: String(recordUid),
                version: (latest?.version ?? 0) + 1,
                snapshot: record,
                userId: record._updatedBy ?? null,
              },
            });
          } catch (err) {
            // Versioning is non-critical — log but don't throw
            // eslint-disable-next-line no-console
            console.warn("[versions] snapshot failed:", err.message);
          }
        });
      }
      return record;
    },

    async add(store, record) {
      if (!record) return record;
      assertRecordSize(record);
      const keyPath = keyPathFor(store);
      await row.create({ data: toRow(store, record, keyPath) });
      return record;
    },

    async delete(store, key) {
      if (key === undefined || key === null) return;
      // Fetch owner before deletion so the webhook is scoped to that user.
      const existing = await row.findUnique({
        where: { store_uid: { store, uid: String(key) } },
        select: { data: true },
      }).catch(() => null);
      const ownerId = existing?.data?.ownerId;
      await row.deleteMany({ where: { store, uid: String(key) } });
      // Fire-and-forget: fire outgoing webhooks for record.deleted.
      fireWebhooks(prisma, "record.deleted", { store, uid: String(key) }, ownerId);
    },

    async clear(store) {
      await row.deleteMany({ where: { store } });
    },

    async putBatch(store, items = []) {
      if (!items?.length) return items;
      const keyPath = keyPathFor(store);
      // Validate size for every item up-front so we can reject the whole batch
      // before touching the DB (fail-fast, no partial writes).
      const validItems = items.filter(Boolean);
      for (const record of validItems) {
        assertRecordSize(record);
      }
      const toInsert = validItems.map((record) => toRow(store, record, keyPath));
      // Use createMany in chunks to stay under Postgres's ~65 535-parameter
      // ceiling. skipDuplicates handles upsert-like behaviour: existing uid rows
      // are skipped rather than overwriting (acceptable for batch import; use
      // put() for authoritative single-record upserts).
      for (const chunk of chunks(toInsert, CHUNK_SIZE)) {
        await row.createMany({ data: chunk, skipDuplicates: true });
      }
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

    async snapshot(opts) {
      // opts = { store?: string, cursor?: string, limit?: number }
      // When opts contains a limit, returns a partial snapshot of one store
      // with pagination metadata. Without opts (or no limit), returns the full
      // dataset across all stores (existing behavior).
      //
      // Both paths run inside a REPEATABLE READ read transaction so the entire
      // export (or page) sees a consistent snapshot of the database. Without
      // this, concurrent writes between the per-store queries could produce a
      // snapshot that mixes data from different points in time.
      const txOpts = { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead };

      if (opts && opts.limit !== undefined && opts.limit !== null) {
        // Paginated partial snapshot — single store required.
        const { store: domainKey, cursor, limit } = opts;
        if (!domainKey) throw Object.assign(new Error("store is required for paginated snapshot"), { statusCode: 400 });
        const storeName = SNAPSHOT_COLLECTION_BY_DOMAIN_KEY[domainKey];
        if (!storeName) throw Object.assign(new Error(`Unknown store: ${domainKey}`), { statusCode: 400 });
        return prisma.$transaction(async (tx) => {
          const txRow = tx.storageRow;
          const where = cursor ? { store: storeName, uid: { gt: cursor } } : { store: storeName };
          const rows = await txRow.findMany({ where, orderBy: { uid: "asc" }, take: limit + 1 });
          const hasMore = rows.length > limit;
          const pageRows = hasMore ? rows.slice(0, limit) : rows;
          const data = pageRows.map(fromRow).filter(Boolean);
          const nextCursor = hasMore ? pageRows[pageRows.length - 1].uid : null;
          return {
            exportedAt: new Date().toISOString(),
            version: "2.0",
            store: domainKey,
            data,
            nextCursor,
            hasMore
          };
        }, txOpts);
      }

      return prisma.$transaction(async (tx) => {
        const txRow = tx.storageRow;
        const out = {
          exportedAt: new Date().toISOString(),
          version: "2.0"
        };
        // One query per store keeps the result-set bounded and avoids loading
        // unrelated stores into memory on Postgres-side. The SPA only reads
        // these specific keys so we don't gain anything from a single big query.
        for (const [domainKey, storeName] of Object.entries(SNAPSHOT_COLLECTION_BY_DOMAIN_KEY)) {
          const rows = await txRow.findMany({ where: { store: storeName }, orderBy: { uid: "asc" } });
          out[domainKey] = rows.map(fromRow).filter((value) => value !== undefined);
        }
        const settingsRow = await txRow.findUnique({
          where: { store_uid: { store: SETTINGS_COLLECTION, uid: SETTINGS_RECORD_KEY } }
        });
        out.settings = fromRow(settingsRow) || undefined;
        return out;
      }, txOpts);
    },

    async getByField(store, field, value) {
      // For the special case where `field` is the primary key column (uid/id),
      // use the unique index directly — fastest path.
      if (field === "uid" || field === "id") {
        const found = await row.findFirst({
          where: { store, uid: String(value) }
        });
        return fromRow(found);
      }
      // General case: JSONB field lookup. The raw query lets Postgres use a
      // functional index on data->>'field' when one exists (e.g. on `username`).
      // NOTE: field name is validated by the caller (RPC layer) to match
      // /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/ — no parameterisation needed for the
      // identifier itself, but we still use tagged-template literals for the value.
      const rows = await prisma.$queryRaw`
        SELECT * FROM "storage_rows"
        WHERE store = ${store}
          AND data->>${Prisma.raw(`'${field}'`)} = ${String(value)}
        LIMIT 1
      `;
      return rows[0] ? fromRow(rows[0]) : undefined;
    },

    async replaceAll(payload = {}) {
      if (!payload || typeof payload !== "object") {
        throw new Error("حمولة replaceAll غير صالحة.");
      }
      const counts = {};
      // Single REPEATABLE READ transaction — atomic across all stores (Postgres
      // can do what PocketBase couldn't). A failure mid-way rolls back the
      // entire import so the database never sits in a half-applied state.
      // REPEATABLE READ prevents phantom reads that could otherwise occur if
      // another writer inserts rows into a store between our deleteMany and
      // createMany calls within the same transaction.
      await prisma.$transaction(async (tx) => {
        const txRow = tx.storageRow;
        for (const [domainKey, store] of Object.entries(SNAPSHOT_COLLECTION_BY_DOMAIN_KEY)) {
          const records = Array.isArray(payload[domainKey]) ? payload[domainKey] : [];
          const shouldClear = domainKey !== "users" || records.length > 0;
          if (shouldClear) {
            await txRow.deleteMany({ where: { store } });
          }
          const keyPath = keyPathFor(store);
          const validRecords = records.filter(Boolean);
          // Validate size for each record before building the insert payload.
          for (const record of validRecords) {
            assertRecordSize(record);
          }
          const toInsert = validRecords.map((record) => toRow(store, record, keyPath));
          // Insert in chunks to stay under Postgres's ~65 535-parameter ceiling.
          // The store was just wiped so skipDuplicates is a safety net only.
          for (const chunk of chunks(toInsert, CHUNK_SIZE)) {
            await txRow.createMany({ data: chunk, skipDuplicates: true });
          }
          counts[domainKey] = toInsert.length;
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
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
      return counts;
    }
  };
}
