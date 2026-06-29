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
import { PrismaClient } from "../generated/prisma/client.js";

const log = createLogger("typed-migration");

interface StorageRow {
  uid: string;
  store: string;
  title: string;
  data?: Record<string, unknown>;
  isDeleted?: boolean;
  deletedAt?: string;
  syncVersion?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface MigrationResult {
  total: number;
  migrated: number;
  failed: number;
  dryRun?: boolean;
}

/**
 * Migrate a single StorageRow record to the typed ArchiveItem table.
 */
export async function migrateRowToTyped(prisma: PrismaClient, row: StorageRow): Promise<boolean> {
  const data = (typeof row.data === "object" ? row.data : {}) ?? {};

  try {
    await (prisma as any).archiveItem.upsert({
      where: { id: row.uid },
      create: {
        id: row.uid,
        store: row.store,
        title: (row.title || (data as any).title || (data as any).name || "(بدون عنوان)") as string,
        description: (data as any).description || (data as any).summary || null,
        documentType: (data as any).documentType || (data as any).type || null,
        mimeType: (data as any).mimeType || null,
        fileKey: (data as any).fileKey || (data as any).file || null,
        fileSizeBytes: (data as any).fileSizeBytes ? BigInt((data as any).fileSizeBytes) : null,
        pageCount: (data as any).pageCount ?? null,
        tags: Array.isArray((data as any).tags) ? (data as any).tags : [],
        categoryId: (data as any).categoryId || null,
        ocrText: (data as any).ocrText || null,
        summary: (data as any).summary || null,
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
    log.warn({ err: (err as any).message, uid: row.uid }, "Failed to migrate row.");
    return false;
  }
}

/**
 * Migrate all StorageRow records for a given store to typed ArchiveItem.
 */
export async function migrateStoreToTyped(prisma: PrismaClient, store: string, { dryRun = false } = {}): Promise<MigrationResult> {
  const total = await (prisma as any).storageRow.count({ where: { store } });
  log.info({ store, total, dryRun }, "Starting store migration.");

  if (dryRun) {
    log.info({ store, total }, "[DRY RUN] Would migrate records.");
    return { total, migrated: 0, failed: 0, dryRun: true };
  }

  let migrated = 0, failed = 0;
  const PAGE = 100;
  let cursor: string | undefined;

  do {
    const rows = await (prisma as any).storageRow.findMany({
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
