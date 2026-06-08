/**
 * Typed schema migration utility.
 * Migrates records from StorageRow (JSONB) to typed tables.
 * Run manually: node src/migration/typedSchemaMigration.js --dry-run
 * Or via API: POST /api/admin/migrate-typed --dry-run
 *
 * IMPORTANT: This is non-destructive. StorageRow data is never deleted.
 * The migration copies data to typed tables. Both can coexist.
 */
import { createLogger } from "../logger.js";
const log = createLogger("typed-migration");

/**
 * Migrate a single StorageRow record to the typed ArchiveItem table.
 * @param {object} prisma
 * @param {object} row - StorageRow
 * @returns {Promise<boolean>} true if migrated
 */
export async function migrateRowToTyped(prisma, row) {
  const data = (typeof row.data === "object" ? row.data : {}) ?? {};

  try {
    await prisma.archiveItem.upsert({
      where: { id: row.uid },
      create: {
        id: row.uid,
        store: row.store,
        title: row.title || data.title || data.name || "(بدون عنوان)",
        description: data.description || data.summary || null,
        documentType: data.documentType || data.type || null,
        mimeType: data.mimeType || null,
        fileKey: data.fileKey || data.file || null,
        fileSizeBytes: data.fileSizeBytes ? BigInt(data.fileSizeBytes) : null,
        pageCount: data.pageCount ?? null,
        tags: Array.isArray(data.tags) ? data.tags : [],
        categoryId: data.categoryId || null,
        ocrText: data.ocrText || null,
        summary: data.summary || null,
        isDeleted: row.isDeleted ?? false,
        deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
        syncVersion: row.syncVersion ?? 0,
        metadata: null,
        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
      },
      update: {}, // Don't overwrite if already migrated
    });
    return true;
  } catch (err) {
    log.warn({ err: err.message, uid: row.uid }, "Failed to migrate row.");
    return false;
  }
}

/**
 * Migrate all StorageRow records for a given store to typed ArchiveItem.
 * @param {object} prisma
 * @param {string} store - store name to migrate
 * @param {{ dryRun?: boolean }} opts
 */
export async function migrateStoreToTyped(prisma, store, { dryRun = false } = {}) {
  const total = await prisma.storageRow.count({ where: { store } });
  log.info({ store, total, dryRun }, "Starting store migration.");

  if (dryRun) {
    log.info({ store, total }, "[DRY RUN] Would migrate records.");
    return { total, migrated: 0, failed: 0, dryRun: true };
  }

  let migrated = 0, failed = 0;
  const PAGE = 100;
  let cursor;

  do {
    const rows = await prisma.storageRow.findMany({
      where: { store },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { uid: cursor } } : {}),
      orderBy: { uid: "asc" },
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].uid;

    for (const row of rows) {
      const ok = await migrateRowToTyped(prisma, row);
      if (ok) migrated++; else failed++;
    }
    log.info({ store, migrated, failed, progress: `${migrated}/${total}` }, "Migration progress.");
  } while (true);

  log.info({ store, migrated, failed, total }, "Store migration complete.");
  return { total, migrated, failed };
}
