-- Migration: retention_policy
-- Adds:
--   1. archived_at column to typed_archive_items
--   2. retention_rules table (DoD 5220.22-M / §22 retention policy)
--
-- This migration is CREATE-ONLY — not applied automatically.
-- Run:  pnpm --filter archive-server prisma:migrate
-- Or:   pnpm --filter archive-server prisma:migrate:dev --name retention_policy

-- 1. Add archived_at to typed_archive_items
ALTER TABLE "typed_archive_items"
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "typed_archive_items_archived_at_idx"
  ON "typed_archive_items"("archived_at");

-- 2. Create retention_rules table
CREATE TABLE IF NOT EXISTS "retention_rules" (
  "id"             TEXT         NOT NULL,
  "name"           TEXT         NOT NULL,
  "scope"          TEXT         NOT NULL DEFAULT 'all',
  "lifetime_days"  INTEGER      NOT NULL,
  "action"         TEXT         NOT NULL DEFAULT 'archive',
  "active"         BOOLEAN      NOT NULL DEFAULT TRUE,
  "created_by"     TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "retention_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "retention_rules_active_idx"  ON "retention_rules"("active");
CREATE INDEX IF NOT EXISTS "retention_rules_scope_idx"   ON "retention_rules"("scope");
