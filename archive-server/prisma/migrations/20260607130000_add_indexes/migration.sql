-- BTREE indexes (Prisma-managed)
CREATE INDEX IF NOT EXISTS "storage_rows_createdAt_idx" ON "storage_rows"("createdAt");
CREATE INDEX IF NOT EXISTS "storage_rows_syncVersion_idx" ON "storage_rows"("syncVersion");

-- GIN index on JSONB data column for fast JSON path queries and full-text search prep
-- (Cannot be expressed in Prisma schema, maintained here as a raw migration)
CREATE INDEX IF NOT EXISTS "storage_rows_data_gin_idx" ON "storage_rows" USING gin (data jsonb_path_ops);
